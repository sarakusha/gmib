import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/externalRequest', () => ({
  externalRequest: async <T>(
    url: string,
    init: RequestInit,
    consume: (response: Response) => Promise<T>,
  ): Promise<T> => consume(await globalThis.fetch(url, init)),
}));

import { requestLicenseActivation, requestLicenseRefresh } from '../src/licenseClient';

const metadata = { name: 'test', os: 'test', version: 'test' };
const license = { payload: 'payload', signature: 'signature' };

afterEach(() => vi.unstubAllGlobals());

describe('license client', () => {
  it('preserves the HTTP status used to handle rejected licenses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Rejected', { status: 403 })));
    await expect(requestLicenseRefresh(license, metadata)).rejects.toMatchObject({
      status: 403,
      message: 'Rejected',
    });
  });

  it('validates response bodies inside the external request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ license }))));
    await expect(
      requestLicenseActivation({ ...metadata, key: 'synthetic', deviceId: 'synthetic' }),
    ).resolves.toEqual(license);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    await expect(requestLicenseRefresh(license, metadata)).rejects.toThrow('invalid response');
  });

  it('keeps the caller cancellation signal alongside the timeout', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ license })));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    await requestLicenseActivation(
      { ...metadata, key: 'synthetic', deviceId: 'synthetic' },
      controller.signal,
    );
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    controller.abort();
    expect(signal.aborted).toBe(true);
  });
});
