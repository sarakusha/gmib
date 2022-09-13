import type { Middleware } from '@reduxjs/toolkit';

import type { AppDispatch, RootState } from './index';

export type AsyncInitializer = (dispatch: AppDispatch, getState: () => RootState) => void;

export default function asyncInitializer(initializer: AsyncInitializer): Middleware {
  return ({ dispatch, getState }) => {
    setTimeout(() => initializer(dispatch as AppDispatch, getState), 0);
    return next => action => {
      next(action);
    };
  };
}
