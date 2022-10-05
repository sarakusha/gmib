import { isRejectedWithValue } from '@reduxjs/toolkit';
import type { Middleware } from '@reduxjs/toolkit';

import { setLoggedIn } from './currentSlice';

const authMiddleware: Middleware =
  ({ dispatch }) =>
  next =>
  action => {
    if (isRejectedWithValue(action) && action.payload.originalStatus === 401) {
      setTimeout(() => dispatch(setLoggedIn(false)), 0);
    }
    next(action);
  };

export default authMiddleware;
