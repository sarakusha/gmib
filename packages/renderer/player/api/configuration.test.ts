import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';

const configuration = { format: 'gmib-player-configuration', version: 1, players: [] } as const;
const load = async (remoteVersion?: string, local = false) => {
  window.history.replaceState(
    {},
    '',
    local
      ? '/'
      : `/?host=remote.example&port=9001${remoteVersion ? `&version=${remoteVersion}` : ''}`,
  );
  vi.resetModules();
  Object.defineProperty(window, 'identify', {
    configurable: true,
    value: {
      getSecret: () => 'test',
      getIdentifier: () => 'test',
      generateSignature: vi.fn().mockResolvedValue('signed'),
    },
  });
  const fetchMock = vi
    .fn()
    .mockImplementation((request: Request) =>
      Promise.resolve(
        new Response(
          JSON.stringify(request.url.endsWith('/player-configuration') ? configuration : []),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
  vi.stubGlobal('fetch', fetchMock);
  const { default: api } = await import('./configuration');
  const { default: mappings } = await import('./mapping');
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer, [mappings.reducerPath]: mappings.reducer },
    middleware: getDefault => getDefault().concat(api.middleware, mappings.middleware),
  });
  return { api, store, fetchMock };
};
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('configuration transport compatibility', () => {
  it.each(['5.6.9', '5.0.0'])('does not send export or import requests to %s', async version => {
    const { api, store, fetchMock } = await load(version);
    await expect(
      store.dispatch(api.endpoints.exportConfiguration.initiate()).unwrap(),
    ).rejects.toMatchObject({ status: 'CUSTOM_ERROR' });
    await expect(
      store
        .dispatch(api.endpoints.importConfiguration.initiate({ ...configuration, players: [] }))
        .unwrap(),
    ).rejects.toMatchObject({ status: 'CUSTOM_ERROR' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(['5.6.10', '5.7.0', undefined])('exports on remote %s', async version => {
    const { api, store, fetchMock } = await load(version);
    expect(await store.dispatch(api.endpoints.exportConfiguration.initiate()).unwrap()).toEqual(
      configuration,
    );
    expect((fetchMock.mock.calls[0][0] as Request).url).toBe(
      'http://remote.example:9002/api/player-configuration',
    );
  });
  it('keeps local export available', async () => {
    const { api, store } = await load('5.6.9', true);
    expect(await store.dispatch(api.endpoints.exportConfiguration.initiate()).unwrap()).toEqual(
      configuration,
    );
  });
  it('preserves 404 for the missing endpoint fallback', async () => {
    const { api, store, fetchMock } = await load();
    fetchMock.mockResolvedValue(
      new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } }),
    );
    await expect(
      store.dispatch(api.endpoints.exportConfiguration.initiate()).unwrap(),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('preserves HTML 404 status for the missing endpoint fallback', async () => {
    const { api, store, fetchMock } = await load();
    fetchMock.mockResolvedValue(
      new Response('<html>Cannot GET /api/player-configuration</html>', { status: 404 }),
    );
    await expect(
      store.dispatch(api.endpoints.exportConfiguration.initiate()).unwrap(),
    ).rejects.toMatchObject({ status: 'PARSING_ERROR', originalStatus: 404 });
  });
  it('validates before submitting and refreshes caches after import', async () => {
    const { api, store, fetchMock } = await load('5.6.10');
    await store
      .dispatch(api.endpoints.importConfiguration.initiate({ ...configuration, players: [] }))
      .unwrap();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.method).toBe('POST');
    expect(await request.json()).toEqual(configuration);
    expect(request.headers.get('x-ni-signature')).toBe('signed');
  });
});
