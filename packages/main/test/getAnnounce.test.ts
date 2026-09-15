import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authRequest: vi.fn(),
  decodeLegacyLicense: vi.fn(),
}));

vi.mock('../src/authRequest', () => ({ default: mocks.authRequest }));
vi.mock('../src/legacyLicense', () => ({ decodeLegacyLicense: mocks.decodeLegacyLicense }));

import getAnnounce from '../src/getAnnounce';

describe('getAnnounce remote compatibility', () => {
  beforeEach(() => {
    mocks.authRequest.mockReset();
    mocks.decodeLegacyLicense.mockReset();
  });

  it('reads the legacy response used by older remote GMIB versions', async () => {
    mocks.authRequest.mockResolvedValue(
      new Response(JSON.stringify({ announce: 'encrypted', iv: 'vector', key: 'remote-device' })),
    );
    mocks.decodeLegacyLicense.mockReturnValue({ plan: 'plus', renew: '2026-10-01' });

    await expect(getAnnounce('remote', 9002)).resolves.toEqual({
      machineId: 'remote-device',
      plan: 'plus',
      renew: '2026-10-01',
    });
  });

  it('preserves the signed state announced by a current remote GMIB', async () => {
    const licenseState = {
      status: 'active',
      plan: 'plus',
      capabilities: ['novastar', 'plugins', 'taurus'],
    };
    mocks.authRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          key: 'remote-device',
          licenseProtocol: 2,
          licenseState,
          license: { payload: 'payload', signature: 'signature' },
        }),
      ),
    );

    await expect(getAnnounce('remote', 9002)).resolves.toEqual({
      machineId: 'remote-device',
      licenseProtocol: 2,
      licenseState,
      license: { payload: 'payload', signature: 'signature' },
    });
    expect(mocks.decodeLegacyLicense).not.toHaveBeenCalled();
  });
});
