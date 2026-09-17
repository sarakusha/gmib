import {
  createVerifierAndSalt,
  SRPClientSession,
  SRPParameters,
  SRPRoutines,
} from '@sarakusha/tssrp6a';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RemoteAuthCredentials } from '/@common/helpers';

import { SrpAuthError, SrpAuthService } from '../src/srpAuthService';

const routines = () => new SRPRoutines(new SRPParameters());

const credentialsFor = async (password: string, revision = 0): Promise<RemoteAuthCredentials> => {
  const { s, v } = await createVerifierAndSalt(routines(), 'gmib', password);
  return { salt: `0x${s.toString(16)}`, verifier: `0x${v.toString(16)}`, revision };
};

type Harness = ReturnType<typeof createHarness>;

const createHarness = (initial: RemoteAuthCredentials, overrides: Record<string, unknown> = {}) => {
  let credentials = initial;
  const secrets = new Map<string, { revision: number; secret: bigint }>();
  const credentialStore = {
    get: vi.fn(async () => credentials),
    set: vi.fn(async (next: RemoteAuthCredentials) => {
      credentials = next;
    }),
  };
  const incomingSecrets = {
    set: vi.fn(async (id: string, secret: bigint, revision: number) => {
      secrets.set(id, { secret, revision });
    }),
    revokeAll: vi.fn(async () => {
      secrets.clear();
    }),
  };
  const service = new SrpAuthService({
    credentials: credentialStore,
    incomingSecrets,
    ...overrides,
  });
  return {
    credentialStore,
    get credentials() {
      return credentials;
    },
    incomingSecrets,
    secrets,
    service,
  };
};

const startLogin = async (service: SrpAuthService, id: string, password: string) => {
  const client = new SRPClientSession(routines());
  const [first, challenge] = await Promise.all([
    client.step1('gmib', password),
    service.createHandshake(id),
  ]);
  const proof = await first.step2(BigInt(challenge.salt), BigInt(challenge.B));
  return {
    client: proof,
    request: { A: `0x${proof.A.toString(16)}`, M1: `0x${proof.M1.toString(16)}` },
  };
};

const finishLogin = async (harness: Harness, id: string, password: string) => {
  const login = await startLogin(harness.service, id, password);
  const response = await harness.service.completeLogin(id, login.request);
  await login.client.step3(BigInt(response.M2));
  return login;
};

afterEach(() => {
  vi.useRealTimers();
});

describe('SRP authentication lifecycle', () => {
  it('keeps the current wire exchange and consumes a handshake once', async () => {
    const harness = createHarness(await credentialsFor('old-password'));
    const login = await finishLogin(harness, 'client-one', 'old-password');

    expect(harness.secrets.get('client-one')).toEqual({
      revision: 0,
      secret: login.client.S,
    });
    await expect(harness.service.completeLogin('client-one', login.request)).rejects.toMatchObject({
      code: 'handshake_not_found',
      status: 404,
    });
  });

  it('allows only one concurrent completion for a handshake', async () => {
    const harness = createHarness(await credentialsFor('old-password'));
    const login = await startLogin(harness.service, 'client-one', 'old-password');
    const results = await Promise.allSettled([
      harness.service.completeLogin('client-one', login.request),
      harness.service.completeLogin('client-one', login.request),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
  });

  it('does not let an older timeout delete a replacement handshake', async () => {
    vi.useFakeTimers();
    const harness = createHarness(await credentialsFor('old-password'));
    await harness.service.createHandshake('client-one');
    await vi.advanceTimersByTimeAsync(9_000);
    const login = await startLogin(harness.service, 'client-one', 'old-password');
    await vi.advanceTimersByTimeAsync(1_001);

    await expect(
      harness.service.completeLogin('client-one', login.request),
    ).resolves.toHaveProperty('M2');
  });

  it('reserves capacity while a handshake is being created', async () => {
    let release!: () => void;
    const waiting = new Promise<void>(resolve => {
      release = resolve;
    });
    const initial = await credentialsFor('old-password');
    const harness = createHarness(initial, {
      maxPendingHandshakes: 1,
      credentials: {
        get: vi.fn(async () => {
          await waiting;
          return initial;
        }),
        set: vi.fn(),
      },
    });
    const first = harness.service.createHandshake('client-one');
    await Promise.resolve();
    await expect(harness.service.createHandshake('client-two')).rejects.toMatchObject({
      code: 'too_many_handshakes',
      status: 429,
    });
    release();
    await first;
  });

  it('rejects malformed values and legacy password mutation fields', async () => {
    const harness = createHarness(await credentialsFor('old-password'));
    await expect(harness.service.createHandshake('../client')).rejects.toMatchObject({
      status: 400,
    });
    await harness.service.createHandshake('client-one');
    await expect(
      harness.service.completeLogin('client-one', {
        A: '0x2',
        M1: '0x2',
        salt: '0x2',
        verifier: '0x3',
      }),
    ).rejects.toMatchObject({ code: 'password_rotation_moved', status: 400 });
  });
});

describe('SRP password rotation', () => {
  it('revokes multiple clients, rejects an in-flight old login and accepts the new password', async () => {
    const harness = createHarness(await credentialsFor('old-password'));
    await finishLogin(harness, 'client-one', 'old-password');
    await finishLogin(harness, 'client-two', 'old-password');
    const inFlight = await startLogin(harness.service, 'client-three', 'old-password');
    const replacement = await credentialsFor('new-password');

    await expect(
      harness.service.rotateCredentials(
        { salt: replacement.salt, verifier: replacement.verifier },
        0,
      ),
    ).resolves.toEqual({ reauthenticateRequired: true });
    expect(harness.secrets.size).toBe(0);
    expect(harness.credentials.revision).toBe(1);
    await expect(
      harness.service.completeLogin('client-three', inFlight.request),
    ).rejects.toMatchObject({ code: 'handshake_not_found' });

    const oldLogin = await startLogin(harness.service, 'old-client', 'old-password');
    await expect(
      harness.service.completeLogin('old-client', oldLogin.request),
    ).rejects.toMatchObject({ code: 'authentication_failed', status: 401 });
    await expect(finishLogin(harness, 'new-client', 'new-password')).resolves.toBeDefined();
  });

  it('allows only the first of two rotations authorized by the same revision', async () => {
    const harness = createHarness(await credentialsFor('old-password'));
    const first = await credentialsFor('first-password');
    const second = await credentialsFor('second-password');
    const results = await Promise.allSettled([
      harness.service.rotateCredentials({ salt: first.salt, verifier: first.verifier }, 0),
      harness.service.rotateCredentials({ salt: second.salt, verifier: second.verifier }, 0),
    ]);

    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: expect.objectContaining({ code: 'authorization_stale', status: 409 }),
    });
    expect(harness.credentials).toMatchObject({
      salt: first.salt,
      verifier: first.verifier,
      revision: 1,
    });
  });

  it('does not revoke sessions when credential persistence fails', async () => {
    const harness = createHarness(await credentialsFor('old-password'));
    const replacement = await credentialsFor('new-password');
    harness.credentialStore.set.mockRejectedValueOnce(new Error('disk failure'));

    await expect(
      harness.service.rotateCredentials({ salt: replacement.salt, verifier: replacement.verifier }),
    ).rejects.toMatchObject({ code: 'rotation_failed', status: 500 });
    expect(harness.credentials.revision).toBe(0);
    expect(harness.incomingSecrets.revokeAll).not.toHaveBeenCalled();
  });

  it('reports incomplete cleanup after persisting a revision that rejects old sessions', async () => {
    const harness = createHarness(await credentialsFor('old-password'));
    const replacement = await credentialsFor('new-password');
    harness.incomingSecrets.revokeAll.mockRejectedValueOnce(new Error('database failure'));

    await expect(
      harness.service.rotateCredentials({ salt: replacement.salt, verifier: replacement.verifier }),
    ).rejects.toMatchObject({
      code: 'revocation_incomplete',
      reauthenticateRequired: true,
      status: 500,
    });
    expect(harness.credentials.revision).toBe(1);
  });

  it('rejects zero, one, modulus and oversized credential values', async () => {
    const harness = createHarness(await credentialsFor('old-password'));
    const modulus = new SRPParameters().primeGroup.N;
    for (const [salt, verifier] of [
      ['0x0', '0x2'],
      ['0x2', '0x1'],
      ['0x2', `0x${modulus.toString(16)}`],
      [`0x${'a'.repeat(257)}`, '0x2'],
    ]) {
      await expect(harness.service.rotateCredentials({ salt, verifier })).rejects.toBeInstanceOf(
        SrpAuthError,
      );
    }
  });
});
