import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authRequest: vi.fn(),
  decodeLegacyLicense: vi.fn(),
  getRemoteCredentials: vi.fn(),
  verifyLicenseSessionAssertion: vi.fn(),
  verifyLicense: vi.fn(),
}));

vi.mock('../src/authRequest', () => ({ default: mocks.authRequest }));
vi.mock('../src/legacyLicense', () => ({ decodeLegacyLicense: mocks.decodeLegacyLicense }));
vi.mock('../src/licenseSessionAssertion', () => ({
  verifyLicenseSessionAssertion: mocks.verifyLicenseSessionAssertion,
}));
vi.mock('../src/licenseVerification', () => ({
  parsePublicKeys: vi.fn(() => new Map()),
  verifyLicense: mocks.verifyLicense,
}));
vi.mock('../src/secret', () => ({ getRemoteCredentials: mocks.getRemoteCredentials }));

import getAnnounce from '../src/getAnnounce';

// cspell:ignore Dejli Vgvtzts

describe('getAnnounce remote compatibility', () => {
  beforeEach(() => {
    mocks.authRequest.mockReset();
    mocks.decodeLegacyLicense.mockReset();
    mocks.getRemoteCredentials.mockReset().mockResolvedValue({ apiSecret: Buffer.alloc(32, 1) });
    mocks.verifyLicenseSessionAssertion.mockReset().mockReturnValue(true);
    mocks.verifyLicense.mockReset();
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
    const deviceId = 'b'.repeat(64);
    const licenseState = {
      status: 'active',
      plan: 'plus',
      capabilities: ['novastar', 'plugins', 'taurus'],
    };
    mocks.verifyLicense.mockReturnValue({
      version: 2,
      issuer: 'app.nata-info.ru',
      audience: 'gmib',
      keyId: 'test',
      licenseId: '7e4b72c0-5d55-4a79-98e4-d432afdc2021',
      deviceId,
      issuedAt: '2026-09-15T10:00:00.000Z',
      expiresAt: null,
      ...licenseState,
      presentation: { version: 1, css: 'server-signed-css' },
    });
    mocks.authRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          key: deviceId,
          licenseProtocol: 2,
          licenseState,
          license: { payload: 'payload', signature: 'signature' },
        }),
      ),
    );

    const result = await getAnnounce('remote', 9002);
    expect(result).toMatchObject({
      machineId: deviceId,
      licenseProtocol: 2,
      licenseState,
      license: { payload: 'payload', signature: 'signature' },
      plan: 'plus',
      useProxy: true,
    });
    expect(result?.message).toBe('server-signed-css');
    expect(mocks.verifyLicense).toHaveBeenCalledWith(
      { payload: 'payload', signature: 'signature' },
      deviceId,
      expect.any(Map),
    );
    expect(mocks.verifyLicenseSessionAssertion).toHaveBeenCalled();
    expect(mocks.decodeLegacyLicense).not.toHaveBeenCalled();
  });

  it('uses the v2 presentation when legacy reports a lower plan', async () => {
    const deviceId = 'c'.repeat(64);
    mocks.verifyLicense.mockReturnValue({
      version: 2,
      issuer: 'app.nata-info.ru',
      audience: 'gmib',
      keyId: 'test',
      licenseId: '7e4b72c0-5d55-4a79-98e4-d432afdc2021',
      deviceId,
      issuedAt: '2026-09-15T10:00:00.000Z',
      expiresAt: '2026-10-01T00:00:00.000Z',
      status: 'active',
      plan: 'plus',
      capabilities: ['novastar', 'plugins', 'taurus'],
      presentation: { version: 1, css: 'server-v2-css' },
    });
    mocks.authRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          announce: 'encrypted',
          iv: 'vector',
          key: deviceId,
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
    expect(result?.message).toBe('server-v2-css');
  });

  it('removes stale legacy presentation after a v2 downgrade', async () => {
    const deviceId = 'd'.repeat(64);
    mocks.verifyLicense.mockReturnValue({
      version: 2,
      issuer: 'app.nata-info.ru',
      audience: 'gmib',
      keyId: 'test',
      licenseId: '7e4b72c0-5d55-4a79-98e4-d432afdc2021',
      deviceId,
      issuedAt: '2026-09-15T10:00:00.000Z',
      expiresAt: null,
      status: 'active',
      plan: 'standard',
      capabilities: ['overheat'],
      presentation: { version: 1, css: 'server-standard-css' },
    });
    mocks.authRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          announce: 'encrypted',
          iv: 'vector',
          key: deviceId,
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
    expect(result?.message).toBe('server-standard-css');
  });

  it('removes all presentation rights for an inactive remote session', async () => {
    const deviceId = 'e'.repeat(64);
    mocks.verifyLicense.mockReturnValue({
      version: 2,
      issuer: 'app.nata-info.ru',
      audience: 'gmib',
      keyId: 'test',
      licenseId: '7e4b72c0-5d55-4a79-98e4-d432afdc2021',
      deviceId,
      issuedAt: '2026-09-15T10:00:00.000Z',
      expiresAt: null,
      status: 'disabled',
      plan: 'plus',
      capabilities: ['novastar'],
      presentation: { version: 1, css: '' },
    });
    mocks.authRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          announce: 'encrypted',
          iv: 'vector',
          key: deviceId,
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
    expect(result?.licenseState).toMatchObject({ status: 'disabled' });
    expect(result).not.toHaveProperty('plan');
    expect(result).not.toHaveProperty('renew');
    expect(result).not.toHaveProperty('message');
  });

  it('does not fall back to legacy CSS when a signed remote response is invalid', async () => {
    mocks.verifyLicense.mockImplementation(() => {
      throw new Error('Invalid license signature');
    });
    mocks.authRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          announce: 'encrypted',
          iv: 'vector',
          key: 'f'.repeat(64),
          licenseProtocol: 2,
          license: { payload: 'tampered', signature: 'tampered' },
        }),
      ),
    );
    mocks.decodeLegacyLicense.mockReturnValue({
      plan: 'enterprise',
      useProxy: true,
      message: 'legacy-bypass-css',
    });

    const result = await getAnnounce('remote', 9002);
    expect(result?.licenseState).toMatchObject({ status: 'invalid' });
    expect(result).not.toHaveProperty('plan');
    expect(result).not.toHaveProperty('useProxy');
    expect(result).not.toHaveProperty('message');
  });

  it('does not use an active signed presentation without a verified host session', async () => {
    const deviceId = '1'.repeat(64);
    mocks.verifyLicenseSessionAssertion.mockReturnValue(false);
    mocks.verifyLicense.mockReturnValue({
      version: 2,
      issuer: 'app.nata-info.ru',
      audience: 'gmib',
      keyId: 'test',
      licenseId: '7e4b72c0-5d55-4a79-98e4-d432afdc2021',
      deviceId,
      issuedAt: '2026-09-15T10:00:00.000Z',
      expiresAt: '2026-10-01T00:00:00.000Z',
      status: 'active',
      plan: 'plus',
      capabilities: ['novastar', 'plugins', 'taurus'],
      presentation: { version: 1, css: 'signed-but-not-in-session' },
    });
    mocks.authRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          key: deviceId,
          licenseProtocol: 2,
          license: { payload: 'payload', signature: 'signature' },
        }),
      ),
    );

    const result = await getAnnounce('remote', 9002);
    expect(result?.licenseState).toMatchObject({ status: 'invalid', capabilities: [] });
    expect(result).not.toHaveProperty('message');
    expect(result).not.toHaveProperty('plan');
    expect(result?.useProxy).toBe(false);
  });
});
