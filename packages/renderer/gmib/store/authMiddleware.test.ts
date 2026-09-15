import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it, vi } from 'vitest';

import authMiddleware from './authMiddleware';

const rejection = (response: Response) => ({
  type: 'api/query/rejected',
  payload: { status: 401, data: { identifier: 'remote-id' } },
  meta: {
    rejectedWithValue: true,
    requestId: 'request-id',
    requestStatus: 'rejected',
    baseQueryMeta: { response },
  },
});

describe('authMiddleware', () => {
  it('ignores authentication failures returned by a proxied GMIB master', async () => {
    vi.useFakeTimers();
    const reducer = vi.fn((state = 0) => state);
    const store = configureStore({
      reducer,
      middleware: getDefault => getDefault().concat(authMiddleware),
    });
    store.dispatch(
      rejection(new Response(null, { status: 401, headers: { 'x-from': 'master:9002' } })),
    );
    await vi.runAllTimersAsync();

    expect(reducer).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'current/setAuthRequired' }),
    );
    vi.useRealTimers();
  });

  it('requests a password for a direct authentication failure', async () => {
    vi.useFakeTimers();
    const reducer = vi.fn((state = 0) => state);
    const store = configureStore({
      reducer,
      middleware: getDefault => getDefault().concat(authMiddleware),
    });
    store.dispatch(rejection(new Response(null, { status: 401 })));
    await vi.runAllTimersAsync();

    expect(reducer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'current/setAuthRequired' }),
    );
    vi.useRealTimers();
  });
});
