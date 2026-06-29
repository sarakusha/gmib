import { isAnyOf } from '@reduxjs/toolkit';

import playerApi, { selectPlayer } from '../api/player';
import updatePlayer, { playerPause, playerPlay, playerStop } from '../api/updatePlayer';
import { sourceId } from '../utils';

import {
  setCurrentPlaylistItem,
  setDuration,
  setPlaybackRate,
  setPlaybackState,
  setPosition,
  togglePlaybackState,
} from './currentSlice';
import { startAppListening } from './listenerMiddleware';
import { selectCurrent, selectDuration, selectPlaybackState } from './selectors';
import type { AppDispatch, RootState } from './index';

import { isRemoteSession } from '/@common/remote';

const selectPlayersData = playerApi.endpoints.getPlayers.select();
// const selectPlaylistsData = playlistApi.endpoints.getPlaylists.select();
const DEFAULT_SEEK_OFFSET = 10;

const getSeekPosition = (position: number | undefined, offset: number): number =>
  Math.max(0, (position ?? 0) + offset);

export const setupMediaSessionActionHandlers = (
  dispatch: AppDispatch,
  getState: () => RootState,
): void => {
  const mediaSession = navigator.mediaSession;
  if (!mediaSession?.setActionHandler) return;

  const setSeekHandler = (
    action: MediaSessionAction,
    handler: (details: MediaSessionActionDetails) => void,
  ): void => {
    try {
      mediaSession.setActionHandler(action, handler);
    } catch {
      // Ignore unsupported media session actions in this browser.
    }
  };

  setSeekHandler('play', () => {
    dispatch(setPlaybackState('playing'));
  });
  setSeekHandler('pause', () => {
    dispatch(setPlaybackState('paused'));
  });
  setSeekHandler('stop', () => {
    dispatch(setPlaybackState('none'));
  });
  setSeekHandler('seekbackward', ({ seekOffset }) => {
    const { position } = selectCurrent(getState());
    window.mediaStream.seek?.(getSeekPosition(position, -(seekOffset ?? DEFAULT_SEEK_OFFSET)));
  });
  setSeekHandler('seekforward', ({ seekOffset }) => {
    const { position } = selectCurrent(getState());
    window.mediaStream.seek?.(getSeekPosition(position, seekOffset ?? DEFAULT_SEEK_OFFSET));
  });
  setSeekHandler('seekto', ({ seekTime }) => {
    if (typeof seekTime !== 'number') return;
    window.mediaStream.seek?.(seekTime);
  });
};

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

if (!isRemoteSession) {
  startAppListening({
    actionCreator: setPosition,
    effect: (action, { getState }) => {
      const duration = selectDuration(getState());
      window.socket.broadcast('setPosition', action.payload, duration);
    },
  });
  startAppListening({
    actionCreator: setDuration,
    effect: action => {
      window.socket.broadcast('setDuration', action.payload);
    },
  });
  startAppListening({
    actionCreator: setCurrentPlaylistItem,
    effect: action => {
      window.socket.broadcast(
        'setCurrentPlaylistItem',
        action.payload?.itemId,
        action.payload?.mediaId,
      );
    },
  });
  // startAppListening({
  //   actionCreator: setPlaybackState,
  //   effect: action => {
  //     window.socket.broadcast('setPlaybackState', action.payload);
  //   },
  // });
}

startAppListening({
  matcher: isAnyOf(setPlaybackState, togglePlaybackState),
  effect(_, { dispatch, getState }) {
    const playbackState = selectPlaybackState(getState());
    // window.mediaStream.updatePlaybackState(playbackState);
    navigator.mediaSession.playbackState = playbackState;
    if (!isRemoteSession) window.socket.broadcast('setPlaybackState', playbackState);
    switch (playbackState) {
      case 'none':
        setTimeout(() => dispatch(playerStop()), 0);
        void dispatch(playerApi.endpoints.stopPlayer.initiate());
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

startAppListening({
  actionCreator: setCurrentPlaylistItem,
  effect: ({ payload: current }, { dispatch }) => {
    dispatch(
      updatePlayer(sourceId, props => ({
        ...props,
        current: current?.itemId,
      })),
    );
  },
});

/* startAppListening({
  predicate: (action, state) => {
    if (playerApi.endpoints.getPlayers.matchFulfilled(action)) return true;
    const getPlaylists = playlistApi.endpoints.getPlaylists.matchFulfilled(action);
    const updatePlaylists = playlistApi.endpoints.updatePlaylist.matchFulfilled(action);
    const { data } = selectPlayersData(state);
    const player = data && selectPlayer(data, sourceId);
    return Boolean(
      player?.playlistId &&
        (getPlaylists || (updatePlaylists && action.payload.id === player.playlistId)),
    );
  },
  effect(_, { getState }) {
    const state = getState();
    const { data: players } = selectPlayersData(state);
    const { data: playlists } = selectPlaylistsData(state);
    const player = players && selectPlayer(players, sourceId);
    const playlist =
      playlists && player?.playlistId && selectPlaylistById(playlists, player.playlistId);
    // console.log({ playlist });
    window.mediaStream.setPlaylist(playlist || undefined, player?.current);
    const { disableFadeIn, disableFadeOut } = player ?? {};
    window.mediaStream.setFadeOptions({ disableIn: disableFadeIn, disableOut: disableFadeOut });
  },
}); */
