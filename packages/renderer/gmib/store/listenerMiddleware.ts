import { addListener, createListenerMiddleware } from '@reduxjs/toolkit';
import type { TypedAddListener, TypedStartListening } from '@reduxjs/toolkit';

import type { AppDispatch, RootState } from '.';

const listenerMiddleware = createListenerMiddleware();

export const startAppListening = listenerMiddleware.startListening as TypedStartListening<
  RootState,
  AppDispatch
>;
export const addAppListener = addListener as TypedAddListener<RootState, AppDispatch>;

export default listenerMiddleware;
