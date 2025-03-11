import type { Middleware } from '@reduxjs/toolkit';
import { isRejectedWithValue } from '@reduxjs/toolkit';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

import type { Credentials } from './currentSlice';
import { setAuthRequired } from './currentSlice';

export function isFetchBaseQueryError(error: unknown): error is FetchBaseQueryError {
  return typeof error === 'object' && error != null && 'status' in error;
}

const isAuthError = (payload: unknown): payload is { data: Credentials } =>
  isFetchBaseQueryError(payload) &&
  payload.status === 401 &&
  typeof payload.data === 'object' &&
  payload.data != null &&
  'identifier' in payload.data;

const authMiddleware: Middleware =
  ({ dispatch }) =>
  next =>
  action => {
    if (isRejectedWithValue(action)) {
      const { payload } = action;
      if (isAuthError(payload)) {
        setTimeout(() => dispatch(setAuthRequired(payload.data)), 0);
      }
    }
    next(action);
  };

export default authMiddleware;
