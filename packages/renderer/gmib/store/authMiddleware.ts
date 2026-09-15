import type { Middleware } from '@reduxjs/toolkit';
import { isRejectedWithValue } from '@reduxjs/toolkit';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

import type { Credentials } from './currentSlice';
import { setAuthRequired } from './currentSlice';

export function isFetchBaseQueryError(error: unknown): error is FetchBaseQueryError {
  return typeof error === 'object' && error != null && 'status' in error;
}

export const isAuthError = (payload: unknown): payload is { data: Credentials } =>
  isFetchBaseQueryError(payload) &&
  payload.status === 401 &&
  typeof payload.data === 'object' &&
  payload.data != null &&
  'identifier' in payload.data;

const getProxySource = (action: unknown): string | null => {
  if (typeof action !== 'object' || action == null || !('meta' in action)) return null;
  const { meta } = action;
  if (typeof meta !== 'object' || meta == null || !('baseQueryMeta' in meta)) return null;
  const { baseQueryMeta } = meta;
  if (
    typeof baseQueryMeta !== 'object' ||
    baseQueryMeta == null ||
    !('response' in baseQueryMeta) ||
    !(baseQueryMeta.response instanceof Response)
  ) {
    return null;
  }
  return baseQueryMeta.response.headers.get('x-from');
};

const authMiddleware: Middleware =
  ({ dispatch }) =>
  next =>
  action => {
    if (isRejectedWithValue(action)) {
      const { payload } = action;
      // A Novastar request may be proxied to another GMIB master. Its 401 belongs to that
      // master and entering the current remote kiosk password can never authorize it.
      if (isAuthError(payload) && !getProxySource(action)) {
        setTimeout(() => dispatch(setAuthRequired(payload.data)), 0);
      }
    }
    next(action);
  };

export default authMiddleware;
