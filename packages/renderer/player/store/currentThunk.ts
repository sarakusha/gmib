import { isAnyOf } from '@reduxjs/toolkit';

import playerApi, { selectPlayer } from '../api/player';
import { playerPause, playerPlay, playerStop } from '../api/updatePlayer';
import { sourceId } from '../utils';

import {
  setDuration,
  setPlaybackRate,
  setPlaybackState,
  setPosition,
  togglePlaybackState,
} from './currentSlice';
import { startAppListening } from './listenerMiddleware';
import { selectCurrent, selectPlaybackState } from './selectors';

const selectPlayersData = playerApi.endpoints.getPlayers.select();

startAppListening({
  matcher: isAnyOf(setPosition, setDuration, setPlaybackRate),
  effect(_, { getState }) {
    const { duration, position, playbackRate } = selectCurrent(getState());
    if (!duration) return;
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate,
      position: position && Math.min(duration, position),
    });
  },
});

startAppListening({
  matcher: isAnyOf(setPlaybackState, togglePlaybackState),
  effect(_, { dispatch, getState }) {
    const playbackState = selectPlaybackState(getState());
    navigator.mediaSession.playbackState = playbackState;
    switch (playbackState) {
      case 'none':
        setTimeout(() => dispatch(playerStop()), 0);
        break;
      case 'paused':
        dispatch(playerPause());
        break;
      case 'playing':
        dispatch(playerPlay());
        break;
      default:
        throw new TypeError(`Unknown playbackState: ${playbackState}`);
    }
  },
});

startAppListening({
  predicate: (_, currentState) =>
    selectCurrent(currentState).playbackState == null &&
    selectPlayersData(currentState).data != null,
  effect: (_, { getState, dispatch }) => {
    const { data } = selectPlayersData(getState());
    if (data) {
      const player = selectPlayer(data, sourceId);
      if (player && player.autoPlay) dispatch(setPlaybackState('playing'));
    }
  },
});
