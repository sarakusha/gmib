import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authRequest: vi.fn(),
  decodeLegacyLicense: vi.fn(),
}));

vi.mock('../src/authRequest', () => ({ default: mocks.authRequest }));
vi.mock('../src/legacyLicense', () => ({ decodeLegacyLicense: mocks.decodeLegacyLicense }));

import getAnnounce from '../src/getAnnounce';

// cspell:ignore Dejli Vgvtzts

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

    const result = await getAnnounce('remote', 9002);
    expect(result).toMatchObject({
      machineId: 'remote-device',
      licenseProtocol: 2,
      licenseState,
      license: { payload: 'payload', signature: 'signature' },
      plan: 'plus',
      useProxy: true,
    });
    expect(result?.message).toContain('yu6ODejliBoLEEgGBmOEe');
    expect(mocks.decodeLegacyLicense).not.toHaveBeenCalled();
  });

  it('uses the v2 presentation when legacy reports a lower plan', async () => {
    mocks.authRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          announce: 'encrypted',
          iv: 'vector',
          key: 'remote-device',
          licenseProtocol: 2,
          licenseState: {
            status: 'active',
            plan: 'plus',
            expiresAt: '2026-10-01T00:00:00.000Z',
            capabilities: ['novastar', 'plugins', 'taurus'],
          },
        }),
      ),
    );
    mocks.decodeLegacyLicense.mockReturnValue({
      plan: 'basic',
      renew: '2026-09-01',
      useProxy: false,
      message: 'legacy-css',
    });

    const result = await getAnnounce('remote', 9002);
    expect(result).toMatchObject({
      plan: 'plus',
      renew: '2026-10-01T00:00:00.000Z',
      useProxy: true,
    });
    expect(result?.message).not.toContain('legacy-css');
    expect(result?.message).toContain('yu6ODejliBoLEEgGBmOEe');
  });

  it('removes stale legacy presentation after a v2 downgrade', async () => {
    mocks.authRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          announce: 'encrypted',
          iv: 'vector',
          key: 'remote-device',
          licenseProtocol: 2,
          licenseState: {
            status: 'active',
            plan: 'standard',
            capabilities: ['overheat'],
          },
        }),
      ),
    );
    mocks.decodeLegacyLicense.mockReturnValue({
      plan: 'plus',
      renew: '2026-10-01',
      useProxy: true,
      message: 'legacy-plus-css',
    });

    const result = await getAnnounce('remote', 9002);
    expect(result).toMatchObject({ plan: 'standard', useProxy: false });
    expect(result).not.toHaveProperty('renew');
    expect(result?.message).not.toContain('legacy-plus-css');
    expect(result?.message).toContain('kTVgvtztsObADJyScNLdK');
  });

  it('removes all presentation rights for an inactive remote session', async () => {
    mocks.authRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          announce: 'encrypted',
          iv: 'vector',
          key: 'remote-device',
          licenseProtocol: 2,
          licenseState: { status: 'disabled', plan: 'plus', capabilities: ['novastar'] },
        }),
      ),
    );
    mocks.decodeLegacyLicense.mockReturnValue({
      plan: 'plus',
      renew: '2026-10-01',
      useProxy: true,
      message: 'legacy-plus-css',
    });

    const result = await getAnnounce('remote', 9002);
    expect(result).toMatchObject({ useProxy: false });
    expect(result).not.toHaveProperty('plan');
    expect(result).not.toHaveProperty('renew');
    expect(result).not.toHaveProperty('message');
  });
});
