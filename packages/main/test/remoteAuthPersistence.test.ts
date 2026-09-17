import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  createVerifierAndSalt,
  SRPClientSession,
  SRPParameters,
  SRPRoutines,
} from '@sarakusha/tssrp6a';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RemoteAuthCredentials } from '/@common/helpers';
import { srpSessionKeyToBuffer } from '/@common/srp';

const fixtures = vi.hoisted(() => ({
  configPath: '',
  dbPath: '',
  failConfigWrite: false,
  failIncomingDelete: false,
  readConfig: () => ({}) as Record<string, unknown>,
  readDb: () => ({ isecret: {}, osecret: {} }) as Record<string, Record<string, unknown>>,
  writeConfig: (_value: Record<string, unknown>) => undefined,
  writeDb: (_value: Record<string, Record<string, unknown>>) => undefined,
}));

vi.mock('electron', () => ({
  app: { whenReady: vi.fn(() => Promise.resolve()) },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}));

vi.mock('../src/localConfig', () => ({
  default: {
    get: (key: string) => fixtures.readConfig()[key],
    get store() {
      return fixtures.readConfig();
    },
    set store(value: Record<string, unknown>) {
      if (fixtures.failConfigWrite) throw new Error('config write failed');
      fixtures.writeConfig(value);
    },
  },
}));

vi.mock('../src/db', () => ({
  promisifyGet:
    (
      query: string,
      encode: (...args: unknown[]) => string,
      decode: (value: Record<string, unknown>) => unknown,
    ) =>
    async (...args: unknown[]) => {
      const table = query.includes('FROM isecret') ? 'isecret' : 'osecret';
      const id = encode(...args);
      const row = fixtures.readDb()[table]?.[id] as Record<string, unknown> | undefined;
      return row ? decode({ id, ...row }) : undefined;
    },
  promisifyRun:
    (query: string, encode?: (...args: unknown[]) => Record<string, unknown>) =>
    async (...args: unknown[]) => {
      const db = fixtures.readDb();
      if (query.startsWith('DELETE FROM isecret')) {
        if (fixtures.failIncomingDelete) throw new Error('isecret delete failed');
        db.isecret = {};
      } else {
        const values = encode?.(...args) ?? {};
        const table = query.includes('INTO isecret') ? 'isecret' : 'osecret';
        const id = values.$id as string;
        db[table] = {
          ...db[table],
          [id]: {
            secret: values.$secret,
            ...(values.$created === undefined ? {} : { created: values.$created }),
          },
        };
      }
      fixtures.writeDb(db);
      return { changes: 1, lastID: 0 };
    },
  removeNull: (value: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(value).filter(([, item]) => item != null)),
}));

const routines = () => new SRPRoutines(new SRPParameters());

const credentialsFor = async (password: string): Promise<RemoteAuthCredentials> => {
  const { s, v } = await createVerifierAndSalt(routines(), 'gmib', password);
  return { salt: `0x${s.toString(16)}`, verifier: `0x${v.toString(16)}`, revision: 0 };
};

const readJson = (filename: string): Record<string, unknown> =>
  JSON.parse(readFileSync(filename, 'utf8')) as Record<string, unknown>;

let fixtureRoot = '';

beforeEach(() => {
  vi.resetModules();
  fixtureRoot = mkdtempSync(path.join(tmpdir(), 'gmib-srp-persistence-'));
  fixtures.configPath = path.join(fixtureRoot, 'config.json');
  fixtures.dbPath = path.join(fixtureRoot, 'db.json');
  fixtures.failConfigWrite = false;
  fixtures.failIncomingDelete = false;
  fixtures.readConfig = () => readJson(fixtures.configPath);
  fixtures.writeConfig = value => writeFileSync(fixtures.configPath, JSON.stringify(value));
  fixtures.readDb = () => readJson(fixtures.dbPath) as Record<string, Record<string, unknown>>;
  fixtures.writeDb = value => writeFileSync(fixtures.dbPath, JSON.stringify(value));
});

afterEach(() => {
  rmSync(fixtureRoot, { force: true, recursive: true });
});

describe('remote authentication persistence', () => {
  it('keeps revoked legacy sessions invalid after failed cleanup and module reload', async () => {
    const legacy = await credentialsFor('old-password');
    const replacement = await credentialsFor('new-password');
    const legacySecret = Buffer.from('legacy-incoming-secret');
    const outgoingSecret = Buffer.from('outgoing-secret');
    fixtures.writeConfig({
      identifier: 'persistent-server-id',
      salt: legacy.salt,
      verifier: legacy.verifier,
    });
    fixtures.writeDb({
      isecret: {
        'legacy-client': { secret: legacySecret.toString('base64'), created: 1 },
      },
      osecret: {
        'other-gmib': { secret: outgoingSecret.toString('base64') },
      },
    });

    const remoteAuth = await import('../src/remoteAuthConfig');
    const secret = await import('../src/secret');
    const { SrpAuthService } = await import('../src/srpAuthService');
    await expect(remoteAuth.getRemoteAuthCredentials()).resolves.toEqual(legacy);
    await expect(secret.getIncomingSecretWithRevision('legacy-client')).resolves.toEqual({
      revision: 0,
      secret: legacySecret,
    });

    fixtures.failIncomingDelete = true;
    const service = new SrpAuthService({
      credentials: {
        get: remoteAuth.getRemoteAuthCredentials,
        set: remoteAuth.setRemoteAuthCredentials,
      },
      incomingSecrets: { set: secret.setIncomingSecret, revokeAll: secret.clearIncomingSecrets },
    });
    await expect(
      service.rotateCredentials({ salt: replacement.salt, verifier: replacement.verifier }, 0),
    ).rejects.toMatchObject({ code: 'revocation_incomplete', reauthenticateRequired: true });

    expect(fixtures.readDb().isecret).toHaveProperty('legacy-client');
    expect(fixtures.readConfig()).toMatchObject({
      identifier: 'persistent-server-id',
      remoteAuth: { ...replacement, revision: 1 },
      salt: replacement.salt,
      verifier: replacement.verifier,
    });
    expect(fixtures.readDb().osecret).toEqual({
      'other-gmib': { secret: outgoingSecret.toString('base64') },
    });

    vi.resetModules();
    fixtures.failIncomingDelete = false;
    const reloadedRemoteAuth = await import('../src/remoteAuthConfig');
    const reloadedSecret = await import('../src/secret');
    const { SrpAuthService: ReloadedSrpAuthService } = await import('../src/srpAuthService');
    await expect(reloadedRemoteAuth.getRemoteAuthCredentials()).resolves.toEqual({
      ...replacement,
      revision: 1,
    });
    await expect(
      reloadedSecret.getIncomingSecretWithRevision('legacy-client'),
    ).resolves.toBeUndefined();
    await expect(reloadedSecret.getOutgoingSecret('other-gmib')).resolves.toEqual(outgoingSecret);
    expect(fixtures.readConfig().identifier).toBe('persistent-server-id');

    const reloadedService = new ReloadedSrpAuthService({
      credentials: {
        get: reloadedRemoteAuth.getRemoteAuthCredentials,
        set: reloadedRemoteAuth.setRemoteAuthCredentials,
      },
      incomingSecrets: {
        set: reloadedSecret.setIncomingSecret,
        revokeAll: reloadedSecret.clearIncomingSecrets,
      },
    });
    const client = new SRPClientSession(routines());
    const [first, challenge] = await Promise.all([
      client.step1('gmib', 'new-password'),
      reloadedService.createHandshake('new-client'),
    ]);
    const proof = await first.step2(BigInt(challenge.salt), BigInt(challenge.B));
    const login = await reloadedService.completeLogin('new-client', {
      A: `0x${proof.A.toString(16)}`,
      M1: `0x${proof.M1.toString(16)}`,
    });
    await proof.step3(BigInt(login.M2));
    await expect(reloadedSecret.getIncomingSecretWithRevision('new-client')).resolves.toEqual({
      revision: 1,
      secret: srpSessionKeyToBuffer(proof.S),
    });
  });

  it('does not publish credentials when the atomic config write fails', async () => {
    const legacy = await credentialsFor('old-password');
    const replacement = await credentialsFor('new-password');
    fixtures.writeConfig({
      identifier: 'persistent-server-id',
      salt: legacy.salt,
      verifier: legacy.verifier,
    });
    fixtures.writeDb({ isecret: {}, osecret: {} });
    const remoteAuth = await import('../src/remoteAuthConfig');
    await remoteAuth.getRemoteAuthCredentials();
    const before = fixtures.readConfig();

    fixtures.failConfigWrite = true;
    await expect(
      remoteAuth.setRemoteAuthCredentials({ ...replacement, revision: 1 }),
    ).rejects.toThrow('config write failed');

    expect(fixtures.readConfig()).toEqual(before);
    await expect(remoteAuth.getRemoteAuthCredentials()).resolves.toEqual(legacy);
  });
});
