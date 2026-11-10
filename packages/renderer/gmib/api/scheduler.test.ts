import { configureStore } from '@reduxjs/toolkit';
import { afterEach, expect, it, vi } from 'vitest';
import type { GmibSchedulerJobInput } from '/@common/scheduler';

const job: GmibSchedulerJobInput = {
  name: 'Morning',
  kind: 'cron',
  enabled: true,
  priority: 0,
  action: 'set-brightness',
  brightness: 50,
  expiresAt: '2026-11-14T14:00:00',
};
const load = async (hostVersion?: string, local = false, configVersion?: string, status = 200) => {
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
        status,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  const { default: api } = await import('./scheduler');
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer, config: () => ({ version: configVersion }) },
    middleware: getDefault => getDefault().concat(api.middleware),
  });
  return { api, store, fetchMock };
};
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});
it.each([
  ['5.7.7', false, false],
  ['5.7.8', false, true],
  ['5.8.0', false, true],
  ['5.7.7', true, true],
])('gates create/update expiry payload on %s local=%s', async (version, local, supported) => {
  const { api, store, fetchMock } = await load(version as string, local as boolean);
  await store.dispatch(api.endpoints.createSchedulerJob.initiate(job)).unwrap();
  await store.dispatch(api.endpoints.updateSchedulerJob.initiate({ id: 'job', job })).unwrap();
  for (const [request] of fetchMock.mock.calls) {
    const body = await (request as Request).json();
    if (supported) expect(body.expiresAt).toBe(job.expiresAt);
    else expect(body).not.toHaveProperty('expiresAt');
  }
});
it('uses the connected host config version in preference to URL hints', async () => {
  const { api, store, fetchMock } = await load('5.8.0', false, '5.7.7');
  await store.dispatch(api.endpoints.createSchedulerJob.initiate(job)).unwrap();
  expect(await (fetchMock.mock.calls[0][0] as Request).json()).not.toHaveProperty('expiresAt');
});
it('clears expiry explicitly over JSON', async () => {
  const { api, store, fetchMock } = await load('5.7.8');
  await store
    .dispatch(
      api.endpoints.updateSchedulerJob.initiate({
        id: 'job',
        job: { ...job, expiresAt: undefined },
      }),
    )
    .unwrap();
  expect(await (fetchMock.mock.calls[0][0] as Request).json()).toMatchObject({ expiresAt: '' });
});
it('preserves missing endpoint errors on unknown-version hosts', async () => {
  const { api, store } = await load(undefined, false, undefined, 404);
  await expect(
    store.dispatch(api.endpoints.createSchedulerJob.initiate(job)).unwrap(),
  ).rejects.toMatchObject({ status: 404 });
});
