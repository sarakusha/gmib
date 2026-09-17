import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { promisify } from 'node:util';

import { createVerifierAndSalt, SRPParameters, SRPRoutines } from '@sarakusha/tssrp6a';
import express, { type RequestHandler } from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import generateSignature from '/@common/generateSignature';
import type { RemoteAuthCredentials } from '/@common/helpers';
import { srpSessionKeyToBuffer } from '/@common/srp';

import type { AuthorizationContext } from '../src/auth';
import { createSrpAuthRouter } from '../src/srpAuthRouter';
import { SrpAuthService } from '../src/srpAuthService';

import {
  GmibApiClient,
  GmibApiError,
  sessionKeyToBuffer,
} from '../../../scripts/gmib-api-client.mjs';

const execFileAsync = promisify(execFile);
const cliPath = new URL('../../../scripts/gmib-api.mjs', import.meta.url).pathname;
const routines = () => new SRPRoutines(new SRPParameters());

const credentialsFor = async (password: string): Promise<RemoteAuthCredentials> => {
  const { s, v } = await createVerifierAndSalt(routines(), 'gmib', password);
  return { salt: `0x${s.toString(16)}`, verifier: `0x${v.toString(16)}`, revision: 0 };
};

const servers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(close => close()));
});

const startServer = async ({
  failRevokeOnce = false,
  password = 'old-password',
  tamperM2 = false,
} = {}) => {
  let credentials = await credentialsFor(password);
  let applicationUnauthorizedCount = 0;
  let serverId = 'server-id';
  let shouldFailRevoke = failRevokeOnce;
  const incoming = new Map<string, { revision: number; secret: Buffer }>();
  const service = new SrpAuthService({
    credentials: {
      get: async () => credentials,
      set: async next => {
        credentials = next;
      },
    },
    incomingSecrets: {
      set: async (id, secret, revision) => {
        incoming.set(id, { revision, secret: srpSessionKeyToBuffer(secret) });
      },
      revokeAll: async () => {
        if (shouldFailRevoke) {
          shouldFailRevoke = false;
          throw new Error('isecret delete failed');
        }
        incoming.clear();
      },
    },
  });
  const auth: RequestHandler = (req, res, next) => {
    const id = req.headers['x-ni-identifier'];
    const timestamp = Number(req.headers['x-ni-timestamp']);
    const stored = typeof id === 'string' ? incoming.get(id) : undefined;
    const expected =
      stored && generateSignature(stored.secret, req.method, req.originalUrl, timestamp, req.body);
    if (
      stored &&
      stored.revision === credentials.revision &&
      Number.isFinite(timestamp) &&
      Math.abs(Date.now() - timestamp) < 60_000 &&
      expected === req.headers['x-ni-signature']
    ) {
      const authorization: AuthorizationContext = {
        identifier: id as string,
        kind: 'remote',
        revision: stored.revision,
      };
      Object.assign(res.locals, { authorization });
      next();
      return;
    }
    res.status(401).json({ identifier: serverId });
  };

  const app = express();
  app.use(express.json());
  app.get('/api/identifier', (_req, res) => res.send(serverId));
  if (tamperM2) {
    app.use('/api/login/:id', (_req, res, next) => {
      const sendJson = res.json.bind(res);
      res.json = body => sendJson({ ...(body as Record<string, unknown>), M2: '0x1' });
      next();
    });
  }
  app.use('/api', createSrpAuthRouter(service, auth));
  app.post('/api/echo', auth, (req, res) => {
    res.json({ body: req.body, query: req.query });
  });
  app.get('/api/echo', auth, (req, res) => {
    res.json({ query: req.query });
  });
  app.post('/api/application-unauthorized', auth, (_req, res) => {
    applicationUnauthorizedCount += 1;
    res.status(401).json({
      error: { code: 'plugin_auth_failed', message: 'Прикладная авторизация отклонена' },
    });
  });
  app.get('/api/slow-body', auth, (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.write('{"started":true');
    setTimeout(() => res.end('}'), 500).unref();
  });

  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start');
  const close = () =>
    new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve())),
    );
  servers.push(close);
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    changeServerIdentifier: (next: string) => {
      serverId = next;
      incoming.clear();
    },
    getApplicationUnauthorizedCount: () => applicationUnauthorizedCount,
  };
};

describe('standalone GMIB API client', () => {
  it('matches the legacy odd-length session-key codec', () => {
    expect(sessionKeyToBuffer(0xabcn)).toEqual(srpSessionKeyToBuffer(0xabcn));
  });

  it('signs encoded query and Unicode JSON body like the server', async () => {
    const { baseUrl } = await startServer();
    const client = new GmibApiClient({
      baseUrl,
      clientId: 'automation-client',
      password: 'old-password',
    });
    const result = await client.request('/api/echo?label=Привет мир&mode=one', {
      method: 'POST',
      body: { label: 'Экран №1', value: 42 },
    });

    expect(result).toMatchObject({
      data: {
        body: { label: 'Экран №1', value: 42 },
        query: { label: 'Привет мир', mode: 'one' },
      },
      serverId: 'server-id',
      status: 200,
    });
  });

  it('rejects a bad password and a mismatched server proof', async () => {
    const normal = await startServer();
    const wrongPassword = new GmibApiClient({
      baseUrl: normal.baseUrl,
      clientId: 'bad-password-client',
      password: 'wrong-password',
    });
    await expect(wrongPassword.login()).rejects.toMatchObject({
      code: 'authentication_failed',
      status: 401,
    });

    const tampered = await startServer({ tamperM2: true });
    const wrongProof = new GmibApiClient({
      baseUrl: tampered.baseUrl,
      clientId: 'bad-proof-client',
      password: 'old-password',
    });
    await expect(wrongProof.login()).rejects.toMatchObject({ code: 'server_proof_mismatch' });
  });

  it('cannot reuse a revoked session and accepts the new password', async () => {
    const { baseUrl } = await startServer();
    const rotating = new GmibApiClient({
      baseUrl,
      clientId: 'rotating-client',
      password: 'old-password',
    });
    const revoked = new GmibApiClient({
      baseUrl,
      clientId: 'revoked-client',
      password: 'old-password',
    });
    await Promise.all([rotating.login(), revoked.login()]);

    const rotation = await rotating.rotatePassword('new-password');
    expect(rotation.data).toEqual({ reauthenticateRequired: true });
    await expect(rotating.request('/api/echo')).resolves.toMatchObject({ status: 200 });
    await expect(revoked.request('/api/echo')).rejects.toMatchObject({
      code: 'authentication_failed',
      status: 401,
    });

    const current = new GmibApiClient({
      baseUrl,
      clientId: 'current-client',
      password: 'new-password',
    });
    await expect(current.request('/api/echo')).resolves.toMatchObject({ status: 200 });
  });

  it('uses the new password after incomplete physical revocation', async () => {
    const { baseUrl } = await startServer({ failRevokeOnce: true });
    const client = new GmibApiClient({
      baseUrl,
      clientId: 'rotation-recovery-client',
      password: 'old-password',
    });

    await expect(client.rotatePassword('new-password')).rejects.toMatchObject({
      code: 'revocation_incomplete',
      reauthenticateRequired: true,
      status: 500,
    });
    await expect(client.request('/api/echo')).resolves.toMatchObject({ status: 200 });
  });

  it('keeps the previous password when another rotation made authorization stale', async () => {
    const client = new GmibApiClient({
      baseUrl: 'http://127.0.0.1:9002',
      clientId: 'stale-rotation-client',
      password: 'old-password',
    });
    client.request = async () => {
      throw new GmibApiError('Авторизация была отозвана', {
        code: 'authorization_stale',
        reauthenticateRequired: true,
        status: 409,
      });
    };

    await expect(client.rotatePassword('losing-new-password')).rejects.toMatchObject({
      code: 'authorization_stale',
    });
    expect(client.password).toBe('old-password');
  });

  it('does not replay an application 401 after its handler ran', async () => {
    const server = await startServer();
    const client = new GmibApiClient({
      baseUrl: server.baseUrl,
      clientId: 'application-401-client',
      password: 'old-password',
    });

    await expect(
      client.request('/api/application-unauthorized', { method: 'POST', body: { value: 1 } }),
    ).rejects.toMatchObject({ code: 'plugin_auth_failed', status: 401 });
    expect(server.getApplicationUnauthorizedCount()).toBe(1);
  });

  it('reauthenticates once when the server identifier changes', async () => {
    const server = await startServer();
    const client = new GmibApiClient({
      baseUrl: server.baseUrl,
      clientId: 'server-change-client',
      password: 'old-password',
    });
    await expect(client.request('/api/echo')).resolves.toMatchObject({ serverId: 'server-id' });

    server.changeServerIdentifier('replacement-server-id');

    await expect(client.request('/api/echo')).resolves.toMatchObject({
      serverId: 'replacement-server-id',
      status: 200,
    });
  });

  it('applies the timeout while reading the response body', async () => {
    const { baseUrl } = await startServer();
    const client = new GmibApiClient({
      baseUrl,
      clientId: 'timeout-client',
      password: 'old-password',
      timeoutMs: 100,
    });

    await expect(client.request('/api/slow-body')).rejects.toMatchObject({
      code: 'request_timeout',
    });
  });

  it('runs the CLI in plain Node and emits JSON without the password', async () => {
    const password = 'cli-password-not-in-output';
    const passwordServer = await startServer({ password });
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [
        cliPath,
        'request',
        '--base-url',
        passwordServer.baseUrl,
        '--client-id',
        'cli-client',
        '--password-env',
        'GMIB_TEST_PASSWORD',
        '--path',
        '/api/echo?source=cli',
      ],
      { env: { ...process.env, GMIB_TEST_PASSWORD: password } },
    );

    expect(stderr).toBe('');
    expect(stdout).not.toContain(password);
    expect(JSON.parse(stdout)).toMatchObject({
      data: { query: { source: 'cli' } },
      ok: true,
      serverId: 'server-id',
      status: 200,
    });
  });

  it('rejects an unknown CLI option before any request', async () => {
    let error: unknown;
    try {
      await execFileAsync(process.execPath, [cliPath, 'login', '--chek', 'true']);
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({ code: 2 });
    const stdout = (error as { stdout: string }).stdout;
    const stderr = (error as { stderr: string }).stderr;
    expect(JSON.parse(stdout)).toMatchObject({
      error: { code: 'invalid_arguments' },
      ok: false,
    });
    expect(stderr).toContain('Неизвестная опция: --chek');
  });

  it('skips password rotation in CLI check mode without reading secrets or using the network', async () => {
    const { stdout, stderr } = await execFileAsync(process.execPath, [
      cliPath,
      'password-set',
      '--check',
    ]);

    expect(stderr).toBe('');
    expect(JSON.parse(stdout)).toEqual({
      changed: false,
      checkMode: true,
      command: 'password-set',
      ok: true,
      skipped: true,
    });
  });

  it('reports client validation errors without exposing secret values', () => {
    const password = 'do-not-print-me';
    expect(
      () =>
        new GmibApiClient({
          baseUrl: 'file:///tmp/gmib',
          clientId: 'automation-client',
          password,
        }),
    ).toThrow(GmibApiError);
  });
});
