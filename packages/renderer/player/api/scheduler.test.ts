import { configureStore } from '@reduxjs/toolkit';
import { afterEach, expect, it, vi } from 'vitest';
import type { PlayerSchedulerJobInput } from '/@common/scheduler';

const job: PlayerSchedulerJobInput = {
  playerId: 1,
  name: 'Два круга',
  kind: 'once',
  runAt: '2026-11-02T18:00:00Z',
  enabled: true,
  priority: 0,
  action: 'play-playlist-times',
  playlistId: 2,
  repeatCount: 2,
  completionAction: 'hide',
};
const load = async (hostVersion?: string, local = false, responseStatus = 200) => {
  window.history.replaceState(
    {},
    '',
    local ? '/' : `/?host=remote.example&port=9001${hostVersion ? `&version=${hostVersion}` : ''}`,
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
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ id: 'job', ...job }), {
        status: responseStatus,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  const { default: api } = await import('./scheduler');
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: getDefault => getDefault().concat(api.middleware),
  });
  return { store, api, fetchMock };
};
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

it('blocks repeat create, update and run before any request on old hosts', async () => {
  const { api, store, fetchMock } = await load('5.7.3');
  for (const request of [
    api.endpoints.createSchedulerJob.initiate(job),
    api.endpoints.updateSchedulerJob.initiate({ id: 'job', job }),
    api.endpoints.runSchedulerJob.initiate({ id: 'job', action: job.action }),
  ])
    await expect(store.dispatch(request).unwrap()).rejects.toMatchObject({ status: 404 });
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each([
  ['5.7.4', false],
  ['5.8.0', false],
  [undefined, true],
])('sends repeat parameters on %s local=%s', async (version, local) => {
  const { api, store, fetchMock } = await load(version as string | undefined, local as boolean);
  await store.dispatch(api.endpoints.createSchedulerJob.initiate(job)).unwrap();
  expect(await (fetchMock.mock.calls[0][0] as Request).json()).toMatchObject({
    repeatCount: 2,
    completionAction: 'hide',
  });
});
it('strips repeat-only payload fields for ordinary actions on older hosts', async () => {
  const { api, store, fetchMock } = await load('5.7.3');
  await store
    .dispatch(
      api.endpoints.updateSchedulerJob.initiate({ id: 'job', job: { ...job, action: 'play' } }),
    )
    .unwrap();
  const body = await (fetchMock.mock.calls[0][0] as Request).json();
  expect(body.action).toBe('play');
  expect(body).not.toHaveProperty('repeatCount');
  expect(body).not.toHaveProperty('completionAction');
});
it('preserves HTTP 404 when an unknown-version host lacks support', async () => {
  const { api, store } = await load(undefined, false, 404);
  await expect(
    store.dispatch(api.endpoints.createSchedulerJob.initiate(job)).unwrap(),
  ).rejects.toMatchObject({ status: 404 });
});
