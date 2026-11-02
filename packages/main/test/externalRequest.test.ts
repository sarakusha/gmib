import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ ready: vi.fn(), fetch: vi.fn() }));
vi.mock('electron', () => ({ app: { whenReady: mocks.ready }, net: { fetch: mocks.fetch } }));

import { externalRequest } from '../src/externalRequest';

const url = 'https://example.test/catalog';

describe('externalRequest', () => {
  beforeEach(() => {
    mocks.ready.mockReset().mockResolvedValue(undefined);
    mocks.fetch.mockReset();
  });

  it('waits for Electron and uses its proxy-aware transport with the caller options', async () => {
    let ready!: () => void;
    mocks.ready.mockReturnValue(
      new Promise<void>(resolve => {
        ready = resolve;
      }),
    );
    mocks.fetch.mockResolvedValue(new Response('catalog'));
    const options = { signal: new AbortController().signal, redirect: 'follow' as const };
    const result = externalRequest(url, options, response => response.text());
    expect(mocks.fetch).not.toHaveBeenCalled();
    ready();
    await expect(result).resolves.toBe('catalog');
    expect(mocks.fetch).toHaveBeenCalledWith(url, options);
  });

  it('does not send a request already aborted while waiting for Electron', async () => {
    const controller = new AbortController();
    controller.abort(new DOMException('Timed out', 'TimeoutError'));
    await expect(
      externalRequest(url, { signal: controller.signal }, r => r.text()),
    ).rejects.toThrow(/тайм|время|Timeout/i);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('includes underlying transport errors without exposing URL credentials or query', async () => {
    mocks.fetch.mockRejectedValue(
      new TypeError('fetch failed', {
        cause: Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' }),
      }),
    );
    await expect(
      externalRequest('https://user:secret@example.test/private?key=hidden', {}, r => r.text()),
    ).rejects.toThrow(/ECONNREFUSED/);
    try {
      await externalRequest('https://user:secret@example.test/private?key=hidden', {}, r =>
        r.text(),
      );
    } catch (error) {
      expect((error as Error).message).not.toMatch(/secret|hidden|private/);
    }
  });

  it('annotates failures during streamed response consumption', async () => {
    mocks.fetch.mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error('net::ERR_CONNECTION_RESET'));
          },
        }),
      ),
    );
    await expect(externalRequest(url, {}, r => r.arrayBuffer())).rejects.toThrow(
      /ERR_CONNECTION_RESET/,
    );
  });

  it('preserves server error status for callers', async () => {
    mocks.fetch.mockResolvedValue(new Response('denied', { status: 403 }));
    await expect(
      externalRequest(url, {}, async response => {
        throw Object.assign(new Error(await response.text()), { status: response.status });
      }),
    ).rejects.toMatchObject({ status: 403, message: expect.stringContaining('denied') });
  });
});
