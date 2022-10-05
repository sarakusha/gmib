import type { Action, ThunkAction } from '@reduxjs/toolkit';
import { configureStore } from '@reduxjs/toolkit';
import type { TypedUseSelectorHook } from 'react-redux';
import { useDispatch as origUseDispatch, useSelector as origUseSelector } from 'react-redux';

import type { AppThunkConfig as OriginalAppThunkConfig } from '../../common/createDebouncedAsyncThunk';
import * as api from '../api';

import currentReducer, { setPiP } from './currentSlice';
import listenerMiddleware from './listenerMiddleware';

import './currentThunk';
// import playerReducer from './playerSlice';
// import './playerThunks';
// import { selectPlayerSate } from './selectors';
// import { updatePlayerState } from './playerThunks';

const store = configureStore({
  reducer: {
    current: currentReducer,
    // player: playerReducer,
    ...api.reducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware()
      .prepend(listenerMiddleware.middleware)
      .concat(...api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  undefined,
  Action<string>
>;
export type AppThunkConfig = OriginalAppThunkConfig<RootState, AppDispatch>;

export const useDispatch = (): AppDispatch => origUseDispatch<AppDispatch>();
export const useSelector: TypedUseSelectorHook<RootState> = origUseSelector;

/*
window.addEventListener('message', ({ data, source }) => {
  if (source !== window || data == null || typeof data !== 'object' || 'source' in data) return;
  // console.log('message', data);
  if ('timer' in data && typeof data.timer === 'number') store.dispatch(setTimer(data.timer));
  if ('dropped' in data && typeof data.dropped === 'number')
    store.dispatch(setDropped(data.dropped));
  if ('playerState' in data && typeof data.playerState === 'string')
    store.dispatch(updatePlayerState(data.playerState));
  if ('playerError' in data) store.dispatch(setError(data.playerError));
  if ('start' in data) {
    console.log('START', data.start, data.uri);
    store.dispatch(playerSetNext());
  }
  if ('finished' in data) {
    store.dispatch(playerFinished());
  }
});
*/

document.addEventListener('enterpictureinpicture', () => store.dispatch(setPiP(true)));
document.addEventListener('leavepictureinpicture', () => store.dispatch(setPiP(false)));

// window.mediaStream.setMediaInfoGetter(id => {
//   const { data } = mediaApi.endpoints.getMedia.select()(store.getState());
//   return data && selectMediaById(data, id);
// });

export default store;
