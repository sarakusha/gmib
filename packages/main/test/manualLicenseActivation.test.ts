import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  applyLegacyLicenseUpdate: vi.fn(),
  parseLegacyLicenseUpdate: vi.fn(),
  requestLicenseActivation: vi.fn(),
  saveActiveLicenseDocument: vi.fn(),
  localConfig: {},
}));

vi.mock('../src/legacyLicenseStorage', () => ({
  applyLegacyLicenseUpdate: mocks.applyLegacyLicenseUpdate,
  parseLegacyLicenseUpdate: mocks.parseLegacyLicenseUpdate,
}));
vi.mock('../src/licenseClient', () => ({
  requestLicenseActivation: mocks.requestLicenseActivation,
}));
vi.mock('../src/licenseState', () => ({
  saveActiveLicenseDocument: mocks.saveActiveLicenseDocument,
}));
vi.mock('../src/localConfig', () => ({ default: mocks.localConfig }));

import { completeLicenseActivation } from '../src/manualLicenseActivation';

const input = {
  key: 'SYNTHETIC-KEY',
  name: 'test',
  deviceId: 'a'.repeat(64),
  version: '0.0.0-test',
  os: 'test-os',
};
const document = { payload: 'payload', signature: 'signature' };

describe('manual license activation', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mocks.applyLegacyLicenseUpdate.mockReset();
    mocks.parseLegacyLicenseUpdate.mockReset();
    mocks.requestLicenseActivation.mockReset().mockResolvedValue(document);
    mocks.saveActiveLicenseDocument.mockReset().mockResolvedValue({ status: 'active' });
  });

  it('saves v2 and applies validated compatibility fields', async () => {
    const legacy = { announce: 'announce', iv: 'iv', autoUpdate: true };
    mocks.parseLegacyLicenseUpdate.mockReturnValue(legacy);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(legacy))));

    await expect(completeLicenseActivation(input, new AbortController().signal)).resolves.toEqual(
      document,
    );
    expect(mocks.saveActiveLicenseDocument).toHaveBeenCalledWith(document);
    expect(mocks.applyLegacyLicenseUpdate).toHaveBeenCalledWith(mocks.localConfig, legacy);
  });

  it.each([
    ['server error', () => Promise.resolve(new Response('failure', { status: 500 }))],
    ['invalid body', () => Promise.resolve(new Response('{invalid'))],
  ])('keeps saved v2 after a compatibility %s', async (_name, response) => {
    vi.stubGlobal('fetch', vi.fn(response));

    await expect(completeLicenseActivation(input, new AbortController().signal)).resolves.toEqual(
      document,
    );
    expect(mocks.saveActiveLicenseDocument).toHaveBeenCalledWith(document);
    expect(mocks.applyLegacyLicenseUpdate).not.toHaveBeenCalled();
  });

  it('bounds compatibility response body reading with the activation signal', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => new Promise(() => undefined),
      }),
    );

    const result = completeLicenseActivation(input, controller.signal);
    await Promise.resolve();
    await Promise.resolve();
    controller.abort(new Error('timeout'));
    await expect(result).resolves.toEqual(document);
    expect(mocks.saveActiveLicenseDocument).toHaveBeenCalledWith(document);
  });

  it('does not save or start compatibility work after v2 refusal', async () => {
    mocks.requestLicenseActivation.mockRejectedValue(new Error('refused'));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(completeLicenseActivation(input, new AbortController().signal)).rejects.toThrow(
      'refused',
    );
    expect(mocks.saveActiveLicenseDocument).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
