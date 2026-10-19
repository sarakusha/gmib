import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LicensePayloadV2, SignedLicense } from '/@common/license';

const mocks = vi.hoisted(() => ({
  document: undefined as SignedLicense | undefined,
  legacy: undefined as Record<string, unknown> | undefined,
  setConfig: vi.fn(),
  verifyLicense: vi.fn(),
  requestLicenseActivation: vi.fn(),
  requestLicenseRefresh: vi.fn(),
}));

vi.mock('../src/localConfig', () => ({
  default: {
    get: vi.fn((key: string) => (key === 'signedLicense' ? mocks.document : undefined)),
    set: mocks.setConfig.mockImplementation((key: string, value: SignedLicense) => {
      if (key === 'signedLicense') mocks.document = value;
    }),
  },
}));
vi.mock('../src/legacyLicense', () => ({ decodeLegacyLicense: () => mocks.legacy }));
vi.mock('../src/machineId', () => ({ default: Promise.resolve('a'.repeat(64)) }));
vi.mock('../src/operatingSystem', () => ({ getOperatingSystem: () => 'Ubuntu 24.04.3 LTS' }));
vi.mock('../src/licenseClient', () => ({
  accessDeniedMessage: vi.fn(() => 'denied'),
  requestLicenseActivation: mocks.requestLicenseActivation,
  requestLicenseRefresh: mocks.requestLicenseRefresh,
}));
vi.mock('../src/licenseVerification', () => ({
  allowsCapability: (payload: LicensePayloadV2, capability: string) =>
    payload.capabilities.includes(capability),
  parsePublicKeys: vi.fn(() => new Map()),
  verifyLicense: mocks.verifyLicense,
}));

const signedLicense: SignedLicense = { payload: 'payload', signature: 'signature' };
const activePayload = (expiresAt = '2026-09-16T00:00:00.000Z'): LicensePayloadV2 => ({
  version: 2,
  issuer: 'app.nata-info.ru',
  audience: 'gmib',
  keyId: 'test-key',
  licenseId: 'synthetic-license',
  deviceId: 'a'.repeat(64),
  issuedAt: '2026-09-15T00:00:00.000Z',
  expiresAt,
  status: 'active',
  plan: 'plus',
  capabilities: ['plugins', 'taurus', 'novastar'],
  presentation: { version: 1, css: '' },
});

describe('main license retry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T12:00:00.000Z'));
    mocks.document = signedLicense;
    mocks.legacy = undefined;
    mocks.verifyLicense.mockReset().mockResolvedValue(activePayload());
    mocks.setConfig.mockClear();
    mocks.requestLicenseActivation.mockReset();
    mocks.requestLicenseRefresh.mockReset().mockResolvedValue(signedLicense);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('keeps an active snapshot when storage already contains disabled terms', async () => {
    const service = await import('../src/licenseState');
    await service.bootstrapLicense();
    mocks.verifyLicense.mockClear();
    mocks.document = { payload: 'disabled', signature: 'replacement' };

    await expect(service.retryLicense()).resolves.toEqual({
      state: expect.objectContaining({ status: 'active', plan: 'plus' }),
      relaunchRequired: false,
    });
    expect(mocks.verifyLicense).not.toHaveBeenCalled();
    expect(service.hasLicenseCapability('plugins')).toBe(true);
  });

  it('keeps an active snapshot after its wall-clock expiry', async () => {
    mocks.verifyLicense.mockResolvedValue(activePayload('2026-09-15T12:01:00.000Z'));
    const service = await import('../src/licenseState');
    await service.bootstrapLicense();
    vi.setSystemTime(new Date('2026-09-15T12:02:00.000Z'));

    const result = await service.retryLicense();
    expect(result.state.status).toBe('active');
    expect(result.relaunchRequired).toBe(false);
    expect(service.hasLicenseCapability('taurus')).toBe(true);
  });

  it('does not create an active session snapshot after restart with an expired document', async () => {
    mocks.verifyLicense.mockResolvedValue(activePayload('2026-09-15T11:59:00.000Z'));
    mocks.requestLicenseRefresh.mockRejectedValue(new Error('offline'));
    const service = await import('../src/licenseState');

    await expect(service.bootstrapLicense()).resolves.toMatchObject({ status: 'expired' });
    expect(service.getSessionLicenseDocument()).toBeUndefined();
    expect(service.getSessionLicensePayload()).toBeUndefined();
    expect(service.getAnnouncedLicenseDocument()).toBe(signedLicense);
  });

  it('keeps the signed presentation snapshot until restart after refresh', async () => {
    const initialDocument = signedLicense;
    const refreshedDocument = { payload: 'refreshed', signature: 'replacement' };
    const initialPayload = activePayload();
    initialPayload.presentation.css = 'session-css';
    const refreshedPayload = activePayload();
    refreshedPayload.presentation.css = 'next-session-css';
    mocks.verifyLicense.mockImplementation((document: SignedLicense) =>
      Promise.resolve(document === refreshedDocument ? refreshedPayload : initialPayload),
    );
    mocks.requestLicenseRefresh.mockResolvedValue(refreshedDocument);

    const service = await import('../src/licenseState');
    await service.bootstrapLicense();
    expect(service.getSessionLicenseDocument()).toBe(initialDocument);
    expect(service.getSessionLicensePayload()?.presentation.css).toBe('session-css');

    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
    expect(mocks.document).toBe(refreshedDocument);
    expect(service.getSessionLicenseDocument()).toBe(initialDocument);
    expect(service.getSessionLicensePayload()?.presentation.css).toBe('session-css');
    expect(service.getLicenseState()).toMatchObject({
      status: 'active',
      restartRequired: true,
    });
  });

  it('shares concurrent inactive retries and requests one relaunch', async () => {
    let resolveDocument: (document: SignedLicense) => void = () => undefined;
    mocks.requestLicenseRefresh.mockImplementation(
      () => new Promise<SignedLicense>(resolve => (resolveDocument = resolve)),
    );
    const service = await import('../src/licenseState');

    const first = service.retryLicense();
    const second = service.retryLicense();
    expect(second).toBe(first);
    await Promise.resolve();
    await Promise.resolve();
    resolveDocument(signedLicense);
    await expect(first).resolves.toEqual({
      state: expect.objectContaining({ status: 'active' }),
      relaunchRequired: true,
    });
    expect(mocks.requestLicenseRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.requestLicenseRefresh).toHaveBeenCalledWith(
      signedLicense,
      expect.objectContaining({ os: 'Ubuntu 24.04.3 LTS' }),
    );
  });

  it('boots an active signed license without contacting the server', async () => {
    mocks.requestLicenseRefresh.mockImplementation(() => new Promise(() => {}));
    const service = await import('../src/licenseState');
    await expect(service.bootstrapLicense()).resolves.toMatchObject({ status: 'active' });
    expect(mocks.requestLicenseRefresh).not.toHaveBeenCalled();
    expect(service.hasLicenseCapability('plugins')).toBe(true);
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
    expect(service.getLicenseState().status).toBe('active');
  });

  it.each(['expired', 'disabled'] as const)(
    'boots %s terms without waiting for renewal',
    async status => {
      mocks.verifyLicense.mockResolvedValue({ ...activePayload(), status });
      mocks.requestLicenseRefresh.mockImplementation(() => new Promise(() => {}));
      const service = await import('../src/licenseState');
      await expect(service.bootstrapLicense()).resolves.toMatchObject({ status });
      await vi.advanceTimersByTimeAsync(0);
      expect(mocks.requestLicenseRefresh).toHaveBeenCalledOnce();
      expect(service.hasLicenseCapability('plugins')).toBe(false);
    },
  );

  it('preserves a legacy activation and its presentation when migration is offline', async () => {
    mocks.document = undefined;
    mocks.legacy = { key: 'synthetic', plan: 'standard', useProxy: true, message: 'legacy-css' };
    mocks.requestLicenseActivation.mockRejectedValue(new Error('offline'));
    const service = await import('../src/licenseState');
    await expect(service.bootstrapLicense()).resolves.toMatchObject({
      status: 'active',
      plan: 'standard',
    });
    expect(mocks.requestLicenseActivation).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(0);
    expect(service.getLicenseState().status).toBe('active');
    expect(service.getSessionLicensePresentation()).toMatchObject({
      message: 'legacy-css',
      useProxy: true,
    });
    expect(service.hasLicenseCapability('novastar')).toBe(true);
    expect(service.hasLicenseCapability('plugins')).toBe(false);
    expect(mocks.setConfig).not.toHaveBeenCalled();
    await expect(service.retryLicense()).resolves.toMatchObject({ relaunchRequired: false });
  });

  it.each([
    [{ key: 'synthetic', plan: 'standard', renew: '2026-09-15T11:59:00.000Z' }, 'expired'],
    [{ key: 'synthetic', plan: 'unknown' }, 'migration-required'],
    [{ key: 'synthetic', plan: 'standard', renew: 'not-a-date' }, 'migration-required'],
    [{ key: 'synthetic', plan: 'standard', renew: 123 }, 'migration-required'],
    [undefined, 'unlicensed'],
  ])('does not grant legacy rights for invalid or expired terms: %j', async (legacy, status) => {
    mocks.document = undefined;
    mocks.legacy = legacy;
    const service = await import('../src/licenseState');
    await expect(service.bootstrapLicense()).resolves.toMatchObject({ status });
    expect(service.hasLegacyLicenseSession()).toBe(false);
    expect(service.hasLicenseCapability('novastar')).toBe(false);
    expect(mocks.requestLicenseActivation).not.toHaveBeenCalled();
  });

  it('keeps the active legacy snapshot on explicit retry as well', async () => {
    mocks.document = undefined;
    mocks.legacy = { key: 'synthetic', plan: 'standard', useProxy: true };
    const service = await import('../src/licenseState');
    await service.bootstrapLicense();
    mocks.document = signedLicense;
    mocks.verifyLicense.mockResolvedValue({ ...activePayload(), status: 'disabled' });
    await expect(service.retryLicense()).resolves.toMatchObject({
      state: { status: 'active', plan: 'standard' },
      relaunchRequired: false,
    });
    expect(service.hasLicenseCapability('novastar')).toBe(true);
    expect(mocks.requestLicenseRefresh).not.toHaveBeenCalled();
  });

  it('does not resurrect legacy rights when a signed document is disabled or invalid', async () => {
    mocks.legacy = { key: 'synthetic', plan: 'premium', useProxy: true };
    mocks.verifyLicense.mockResolvedValue({ ...activePayload(), status: 'disabled' });
    const service = await import('../src/licenseState');
    await service.bootstrapLicense();
    expect(service.hasLicenseCapability('novastar')).toBe(false);
    expect(service.hasLegacyLicenseSession()).toBe(false);
    mocks.verifyLicense.mockRejectedValue(new Error('invalid signature'));
    await expect(service.bootstrapLicense()).resolves.toMatchObject({ status: 'invalid' });
    expect(service.hasLicenseCapability('novastar')).toBe(false);
  });

  it('saves a verified migration for the next launch without swapping the live snapshot', async () => {
    mocks.document = undefined;
    mocks.legacy = { key: 'synthetic', plan: 'standard', useProxy: true };
    mocks.requestLicenseActivation.mockResolvedValue(signedLicense);
    const service = await import('../src/licenseState');
    await service.bootstrapLicense();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.requestLicenseActivation).toHaveBeenCalledWith(
      expect.objectContaining({ os: 'Ubuntu 24.04.3 LTS' }),
    );
    expect(service.getLicenseState()).toMatchObject({
      status: 'active',
      plan: 'standard',
      restartRequired: true,
    });
    expect(service.getSessionLicenseDocument()).toBeUndefined();
    expect(mocks.document).toBe(signedLicense);
    await expect(service.bootstrapLicense()).resolves.toMatchObject({
      status: 'active',
      plan: 'plus',
    });
    expect(service.hasLegacyLicenseSession()).toBe(false);
  });

  it('does not store an invalid manual activation document', async () => {
    mocks.verifyLicense.mockRejectedValue(new Error('invalid signature'));
    const service = await import('../src/licenseState');

    await expect(service.saveActiveLicenseDocument(signedLicense)).rejects.toThrow(
      'invalid signature',
    );
    expect(mocks.setConfig).not.toHaveBeenCalled();
  });
});
