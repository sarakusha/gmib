import { createServer } from 'node:http';

import { createVerifierAndSalt, SRPParameters, SRPRoutines } from '@sarakusha/tssrp6a';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

import generateSignature from '/@common/generateSignature';
import type { RemoteAuthCredentials } from '/@common/helpers';

const mocks = vi.hoisted(() => ({
  identifier: 'server-identifier',
  localSecret: Buffer.from('local-secret'),
  remoteSecret: Buffer.from('remote-secret'),
}));

vi.mock('../src/localConfig', () => ({
  default: { get: vi.fn(() => mocks.identifier) },
}));
vi.mock('../src/secret', () => ({
  default: mocks.localSecret,
  getIncomingSecretWithRevision: vi.fn(async () => ({
    revision: 0,
    secret: mocks.remoteSecret,
  })),
}));

import auth, { isAuthorized } from '../src/auth';
import { mountApiAuth } from '../src/apiAuth';
import { createSrpAuthRouter } from '../src/srpAuthRouter';
import { SrpAuthService } from '../src/srpAuthService';

const routines = () => new SRPRoutines(new SRPParameters());

const credentialsFor = async (password: string): Promise<RemoteAuthCredentials> => {
  const { s, v } = await createVerifierAndSalt(routines(), 'gmib', password);
  return { salt: `0x${s.toString(16)}`, verifier: `0x${v.toString(16)}`, revision: 0 };
};

const createService = (
  initial: RemoteAuthCredentials,
  revokeAll: () => Promise<void> = async () => undefined,
) => {
  let credentials = initial;
  const service = new SrpAuthService({
    credentials: {
      get: async () => credentials,
      set: async next => {
        credentials = next;
      },
    },
    incomingSecrets: {
      set: async () => undefined,
      revokeAll,
    },
  });
  return { service, credentials: () => credentials };
};

const listen = async (app: express.Express) => {
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve())),
      ),
  };
};

const createApp = (service: SrpAuthService, unsafeMode: boolean, licenseStatus = 'unlicensed') => {
  const app = express();
  app.use(express.json());
  app.use((_, res, next) => {
    Object.assign(res.locals, { receivedAt: Date.now() });
    next();
  });
  const api = express.Router();
  mountApiAuth(api, {
    auth,
    getLicenseStatus: () => licenseStatus,
    srpRouter: createSrpAuthRouter(service, auth),
    unsafeMode,
  });
  app.use('/api', api);
  return app;
};

const signedHeaders = (body: unknown, timestamp = Date.now()) => ({
  'content-type': 'application/json',
  'x-ni-identifier': 'remote-client',
  'x-ni-timestamp': String(timestamp),
  'x-ni-signature': generateSignature(
    mocks.remoteSecret,
    'PUT',
    '/api/manage/v1/auth/password',
    timestamp,
    body,
  ),
});

const servers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(close => close()));
});

describe('password route middleware', () => {
  it('requires authorization under unsafeMode and before license activation', async () => {
    const current = await credentialsFor('old-password');
    const replacement = await credentialsFor('new-password');
    const { service } = createService(current);
    const server = await listen(createApp(service, true, 'unlicensed'));
    servers.push(server.close);
    const body = { salt: replacement.salt, verifier: replacement.verifier };

    const unauthorized = await fetch(`${server.baseUrl}/api/manage/v1/auth/password`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(unauthorized.status).toBe(401);

    const authorized = await fetch(`${server.baseUrl}/api/manage/v1/auth/password`, {
      method: 'PUT',
      headers: signedHeaders(body),
      body: JSON.stringify(body),
    });
    expect(authorized.status).toBe(200);
    await expect(authorized.json()).resolves.toEqual({ reauthenticateRequired: true });
  });

  it('rejects the second concurrent rotation authorized by the revoked revision', async () => {
    let releaseRevoke!: () => void;
    let revokeStarted!: () => void;
    const started = new Promise<void>(resolve => {
      revokeStarted = resolve;
    });
    const blocked = new Promise<void>(resolve => {
      releaseRevoke = resolve;
    });
    const current = await credentialsFor('old-password');
    const first = await credentialsFor('first-password');
    const second = await credentialsFor('second-password');
    const harness = createService(current, async () => {
      revokeStarted();
      await blocked;
    });
    const server = await listen(createApp(harness.service, true, 'unlicensed'));
    servers.push(server.close);
    const firstBody = { salt: first.salt, verifier: first.verifier };
    const secondBody = { salt: second.salt, verifier: second.verifier };

    const firstRequest = fetch(`${server.baseUrl}/api/manage/v1/auth/password`, {
      method: 'PUT',
      headers: signedHeaders(firstBody),
      body: JSON.stringify(firstBody),
    });
    await started;
    const secondRequest = fetch(`${server.baseUrl}/api/manage/v1/auth/password`, {
      method: 'PUT',
      headers: signedHeaders(secondBody),
      body: JSON.stringify(secondBody),
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    releaseRevoke();
    const [firstResponse, secondResponse] = await Promise.all([firstRequest, secondRequest]);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(409);
    await expect(secondResponse.json()).resolves.toMatchObject({
      error: { code: 'authorization_stale', reauthenticateRequired: true },
    });
    expect(harness.credentials()).toMatchObject({
      salt: first.salt,
      verifier: first.verifier,
      revision: 1,
    });
  });
});

describe('signed request compatibility', () => {
  it('keeps local Bearer authorization', async () => {
    const request = {
      headers: { authorization: `Bearer ${mocks.localSecret.toString('base64')}` },
    } as express.Request;

    await expect(isAuthorized(request)).resolves.toBe(true);
  });

  it('keeps query and body in the HMAC input', async () => {
    const timestamp = Date.now();
    const body = { value: 42, label: 'тест' };
    const request = {
      body,
      headers: {
        'x-ni-identifier': 'remote-client',
        'x-ni-timestamp': String(timestamp),
        'x-ni-signature': generateSignature(
          mocks.remoteSecret,
          'PUT',
          '/api/example?mode=one',
          timestamp,
          body,
        ),
      },
      method: 'PUT',
      originalUrl: '/api/example?mode=one',
    } as express.Request;

    await expect(isAuthorized(request, timestamp)).resolves.toBe(true);
    request.headers['x-ni-signature'] = generateSignature(
      mocks.remoteSecret,
      'PUT',
      '/api/example',
      timestamp,
      body,
    );
    await expect(isAuthorized(request, timestamp)).resolves.toBe(false);
  });
});
