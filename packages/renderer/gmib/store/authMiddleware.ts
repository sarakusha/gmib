import type { Middleware } from '@reduxjs/toolkit';

import { setAuthRequired } from './currentSlice';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

export function isFetchBaseQueryError(error: unknown): error is FetchBaseQueryError {
  return typeof error === 'object' && error != null && 'status' in error;
}

export function hasError(action: unknown): action is { error: unknown } {
  return typeof action === 'object' && action != null && 'error' in action;
}


const authMiddleware: Middleware =
  ({ dispatch }) =>
  next =>
  action => {
    if ( hasError(action) && isFetchBaseQueryError(action.error) && action.error.status === 401) {
      setTimeout(() => dispatch(setAuthRequired(undefined)), 0);
    }
    next(action);
  };

export default authMiddleware;
