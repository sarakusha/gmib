import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PlaybackIssue, PlaybackStatusSnapshot } from '/@common/playback';

const status: PlaybackStatusSnapshot = { issues: [] };

const loadStatus = async (search = '') => {
  window.history.replaceState({}, '', `/${search}`);
  vi.resetModules();
  Object.defineProperty(window, 'identify', {
    configurable: true,
    value: {
      generateSignature: vi.fn().mockResolvedValue(undefined),
      getIdentifier: vi.fn().mockReturnValue('test-id'),
      getSecret: vi.fn().mockReturnValue('test-secret'),
    },
  });
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(status), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);

  const { default: playbackApi } = await import('./playback');
  const store = configureStore({
    reducer: { [playbackApi.reducerPath]: playbackApi.reducer },
    middleware: getDefault => getDefault().concat(playbackApi.middleware),
  });
  const result = await store.dispatch(playbackApi.endpoints.getPlaybackStatus.initiate()).unwrap();
  const request = fetchMock.mock.calls[0]?.[0] as Request;
  return { playbackApi, request, result, store };
};

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('playback status transport', () => {
  it('retrieves the initial local snapshot over HTTP', async () => {
    const { request, result } = await loadStatus();

    expect(request.url).toBe('http://localhost:9002/api/playback/status');
    expect(result).toEqual(status);
  });

  it('retrieves the initial remote snapshot over the signed HTTP path', async () => {
    const { request, result } = await loadStatus('?host=remote.example&port=9001');

    expect(request.url).toBe('http://remote.example:9002/api/playback/status');
    expect(result).toEqual(status);
  });

  it('keeps the live socket status in the query cache for later subscribers', async () => {
    const { playbackApi, store } = await loadStatus();
    const active: PlaybackIssue = {
      event: 'quarantined',
      playerId: 1,
      mediaId: 'media-1',
      attempt: 3,
      playbackId: 'playback-1',
      timestamp: '2026-09-18T10:00:00.000Z',
      error: 'Decoder failed',
    };
    const { applyPlaybackStatusMessage } = await import('./updatePlayer');

    expect(
      applyPlaybackStatusMessage(store.dispatch, 'playback:status', [0, { issues: [active] }]),
    ).toBe(true);
    await vi.waitFor(() => {
      expect(playbackApi.endpoints.getPlaybackStatus.select()(store.getState()).data).toEqual({
        issues: [active],
      });
    });
  });

  it('leaves the visible issue intact when retry transport fails', async () => {
    window.history.replaceState({}, '', '/');
    vi.resetModules();
    Object.defineProperty(window, 'identify', {
      configurable: true,
      value: {
        generateSignature: vi.fn().mockResolvedValue(undefined),
        getIdentifier: vi.fn().mockReturnValue('test-id'),
        getSecret: vi.fn().mockReturnValue('test-secret'),
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'offline' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const { default: playbackApi } = await import('./playback');
    const { getPlaybackSnapshot, setPlaybackStatus } = await import('../playback/playbackStore');
    const store = configureStore({
      reducer: { [playbackApi.reducerPath]: playbackApi.reducer },
      middleware: getDefault => getDefault().concat(playbackApi.middleware),
    });
    const active: PlaybackIssue = {
      event: 'quarantined',
      playerId: 1,
      mediaId: 'media-1',
      attempt: 3,
      playbackId: 'playback-1',
      timestamp: '2026-09-18T10:00:00.000Z',
      error: 'Decoder failed',
    };
    setPlaybackStatus({ issues: [active] });

    await expect(
      store.dispatch(playbackApi.endpoints.retryPlayback.initiate(active.mediaId)).unwrap(),
    ).rejects.toMatchObject({ status: 503 });
    expect(getPlaybackSnapshot().issues).toEqual([active]);
  });
});
