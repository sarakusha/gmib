import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LicensePayloadV2, SignedLicense } from '/@common/license';

const mocks = vi.hoisted(() => ({
  document: undefined as SignedLicense | undefined,
  verifyLicense: vi.fn(),
  requestLicenseActivation: vi.fn(),
  requestLicenseRefresh: vi.fn(),
}));

vi.mock('../src/localConfig', () => ({
  default: {
    get: vi.fn((key: string) => (key === 'signedLicense' ? mocks.document : undefined)),
    set: vi.fn((key: string, value: SignedLicense) => {
      if (key === 'signedLicense') mocks.document = value;
    }),
  },
}));
vi.mock('../src/machineId', () => ({ default: Promise.resolve('a'.repeat(64)) }));
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
});

describe('main license retry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T12:00:00.000Z'));
    mocks.document = signedLicense;
    mocks.verifyLicense.mockReset().mockResolvedValue(activePayload());
    mocks.requestLicenseActivation.mockReset();
    mocks.requestLicenseRefresh.mockReset();
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

  it('shares concurrent inactive retries and requests one relaunch', async () => {
    let resolvePayload: (payload: LicensePayloadV2) => void = () => undefined;
    mocks.verifyLicense.mockImplementation(
      () => new Promise<LicensePayloadV2>(resolve => (resolvePayload = resolve)),
    );
    const service = await import('../src/licenseState');

    const first = service.retryLicense();
    const second = service.retryLicense();
    expect(second).toBe(first);
    await Promise.resolve();
    await Promise.resolve();
    resolvePayload(activePayload());
    await expect(first).resolves.toEqual({
      state: expect.objectContaining({ status: 'active' }),
      relaunchRequired: true,
    });
    expect(mocks.verifyLicense).toHaveBeenCalledTimes(1);
  });
});
