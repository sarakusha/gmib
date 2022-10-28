import { isRejectedWithValue } from '@reduxjs/toolkit';
import type { Middleware } from '@reduxjs/toolkit';

import { setAuthRequired } from './currentSlice';

const authMiddleware: Middleware =
  ({ dispatch }) =>
  next =>
  action => {
    if (isRejectedWithValue(action) && action.payload.status === 401) {
      setTimeout(() => dispatch(setAuthRequired(action.payload.data)), 0);
    }
    next(action);
  };

export default authMiddleware;
