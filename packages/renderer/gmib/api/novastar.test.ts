import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => ({
  baseQuery: vi.fn(),
  open: undefined as (() => void) | undefined,
}));

vi.mock('../../common/authBaseQuery', () => ({ default: transport.baseQuery }));
vi.mock('./novastarConnection', () => ({
  connectNovastarEvents: vi.fn((_url, options: { onOpen: () => void }) => {
    transport.open = options.onOpen;
    return vi.fn();
  }),
}));
vi.mock('./scheduler', () => ({ default: { util: { invalidateTags: vi.fn() } } }));
vi.mock('./screens', () => ({ default: { util: { invalidateTags: vi.fn() } } }));
vi.mock('../store/currentSlice', () => ({
  setBroadcastDetected: vi.fn(),
  setCurrentDevice: vi.fn(),
  setGmibDiscoveryBlocked: vi.fn(),
}));
vi.mock('../store/selectors', () => ({ selectCurrentDeviceId: vi.fn() }));
vi.mock('../store/sensorsSlice', () => ({ pushSensorValue: vi.fn() }));
vi.mock('../store/telemetrySlice', () => ({
  addCabinetInfo: vi.fn(),
  finishNovastarTelemetry: vi.fn(),
  startNovastarTelemetry: vi.fn(),
}));

const load = async (enabled = true, search = '') => {
  window.history.replaceState({}, '', `/${search}`);
  vi.resetModules();
  transport.baseQuery.mockReset();
  Object.defineProperty(window, 'initializeNovastar', {
    configurable: true,
    value: vi.fn().mockResolvedValue(enabled),
  });
  const { default: api, sse } = await import('./novastar');
  const requests: boolean[] = [];
  const recordRequests: Middleware = () => next => action => {
    const candidate = action as {
      type: string;
      meta?: { arg?: { subscribe?: boolean } };
    };
    if (candidate.type === `${api.reducerPath}/executeQuery/pending`) {
      requests.push(candidate.meta?.arg?.subscribe ?? false);
    }
    return next(action);
  };
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: getDefault => getDefault().concat(recordRequests, api.middleware, sse),
  });
  return { api, store, requests };
};

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('NovaStar event snapshot recovery', () => {
  it.each([
    '',
    '?host=10.20.0.123&version=5.6.7',
    '?host=10.20.0.123&version=5.6.8',
    '?host=10.20.0.123&version=5.6.9',
    '?host=10.20.0.123',
  ])('replaces cached devices on reconnect without subscriptions (%s)', async search => {
    const { api, store, requests } = await load(true, search);
    transport.baseQuery.mockResolvedValueOnce({ data: [{ path: 'old-device' }] });
    await store.dispatch(api.endpoints.getNovastars.initiate()).unwrap();

    transport.baseQuery.mockResolvedValueOnce({ data: [{ path: 'MCTRL-300' }] });
    transport.open?.();
    await vi.waitFor(() => {
      expect(api.endpoints.getNovastars.select()(store.getState()).data?.ids).toEqual([
        'MCTRL-300',
      ]);
    });
    expect(requests).toEqual([true, false]);

    transport.baseQuery.mockResolvedValueOnce({ data: [] });
    transport.open?.();
    await vi.waitFor(() => {
      expect(api.endpoints.getNovastars.select()(store.getState()).data?.ids).toEqual([]);
    });
    expect(requests).toEqual([true, false, false]);
    store.dispatch(api.util.resetApiState());
  });

  it('reloads after a request started before reconnect finishes', async () => {
    const { api, store, requests } = await load();
    let finishOldRequest!: (value: { data: { path: string }[] }) => void;
    transport.baseQuery.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishOldRequest = resolve;
        }),
    );
    const oldRequest = store.dispatch(api.endpoints.getNovastars.initiate());
    transport.baseQuery.mockResolvedValueOnce({ data: [{ path: 'MCTRL-300' }] });
    transport.open?.();
    await Promise.resolve();
    expect(transport.baseQuery).toHaveBeenCalledTimes(1);
    finishOldRequest({ data: [{ path: 'stale-device' }] });
    await oldRequest;
    await vi.waitFor(() => {
      expect(api.endpoints.getNovastars.select()(store.getState()).data?.ids).toEqual([
        'MCTRL-300',
      ]);
    });
    expect(requests).toEqual([true, false]);
    store.dispatch(api.util.resetApiState());
  });

  it('does not request NovaStar data when the capability is disabled', async () => {
    const { api, store } = await load(false);
    transport.open?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(transport.baseQuery).not.toHaveBeenCalled();
    store.dispatch(api.util.resetApiState());
  });
});
