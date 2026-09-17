import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCredentials: vi.fn(),
  releaseRead: undefined as (() => void) | undefined,
  revision: 0,
  waitForRead: Promise.resolve(),
}));

vi.mock('electron', () => ({
  app: { whenReady: vi.fn(() => Promise.resolve()) },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}));
vi.mock('../src/localConfig', () => ({
  default: { get: vi.fn(() => 'server-identifier') },
}));
vi.mock('../src/remoteAuthConfig', () => ({
  getRemoteAuthCredentials: mocks.getCredentials.mockImplementation(async () => ({
    revision: mocks.revision,
    salt: '0x2',
    verifier: '0x3',
  })),
}));
vi.mock('../src/db', () => ({
  promisifyGet:
    (query: string, _parameters: unknown, transform: (value: unknown) => unknown) => async () => {
      if (query.includes('isecret')) await mocks.waitForRead;
      return transform({
        id: 'remote-client',
        secret: `v1:0:${Buffer.from('old-secret').toString('base64')}`,
      });
    },
  promisifyRun: vi.fn(() => vi.fn(async () => undefined)),
  removeNull: vi.fn((value: unknown) => value),
}));

import { getIncomingSecretWithRevision } from '../src/secret';

describe('incoming secret revisions', () => {
  it('rejects a database result when credentials change during the read', async () => {
    mocks.getCredentials.mockClear();
    mocks.revision = 0;
    mocks.waitForRead = new Promise<void>(resolve => {
      mocks.releaseRead = resolve;
    });

    const result = getIncomingSecretWithRevision('remote-client');
    await Promise.resolve();
    mocks.revision = 1;
    mocks.releaseRead?.();

    await expect(result).resolves.toBeUndefined();
    expect(mocks.getCredentials).toHaveBeenCalledTimes(2);
  });
});
