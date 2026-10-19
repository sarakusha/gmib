import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  send: vi.fn(),
}));

vi.mock('electron', () => ({ ipcRenderer: mocks }));
vi.mock('/@common/remote', () => ({ host: 'remote-host', port: 9001 }));

beforeEach(() => {
  vi.resetModules();
  mocks.invoke.mockReset().mockResolvedValue({
    identifier: 'local-client',
    remoteIdentifier: 'remote-device',
  });
  mocks.send.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe('remote login identity', () => {
  it('cancels login for the remote host while keeping the local signing identity', async () => {
    const identify = await import('./identify');
    await identify.initialized;

    identify.setSecret(null);

    expect(mocks.send).toHaveBeenCalledWith('setRemoteSecret', 'remote-device', null);
    expect(identify.getIdentifier()).toBe('local-client');
  });

  it('preserves an explicit authentication target supplied by the login dialog', async () => {
    const identify = await import('./identify');
    await identify.initialized;

    identify.setSecret(0x1234n, 'another-remote-device');

    expect(mocks.send).toHaveBeenCalledWith('setRemoteSecret', 'another-remote-device', 0x1234n);
    expect(identify.getIdentifier()).toBe('local-client');
    expect(identify.getSecret()).toBe(Buffer.from('1234', 'hex').toString('base64'));
  });
});
