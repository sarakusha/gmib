import type { SetStateAction } from 'react';
import type { Middleware, MiddlewareAPI } from '@reduxjs/toolkit';
import debugFactory from 'debug';
import { host, port } from '/@common/remote';
import type { Player } from '/@common/video';

import createDebouncedAsyncThunk from '../../common/createDebouncedAsyncThunk';

import type { AppDispatch, AppThunk, AppThunkConfig, RootState } from '../store';
import {
  setCurrentPlaylistItem,
  setDuration,
  setPlaybackState,
  setPosition,
} from '../store/currentSlice';
import { sourceId } from '../utils';

import playerApi, { playerAdapter, selectPlayer } from './player';
import playlistApi, { selectPlaylistById } from './playlists';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:updatePlayer`);

export const debouncedUpdatePlayer = createDebouncedAsyncThunk<void, Player, AppThunkConfig>(
  'playerApi/pendingUpdate',
  (player, { dispatch }) => {
    dispatch(playerApi.endpoints.updatePlayer.initiate(player));
  },
  200,
  { selectId: player => player.id, maxWait: 500 },
);

const selectPlaylistData = playlistApi.endpoints.getPlaylists.select();

const updatePlayer =
  (id: number, update: SetStateAction<Player>): AppThunk =>
  (dispatch, getState) => {
    dispatch(
      playerApi.util.updateQueryData('getPlayers', undefined, draft => {
        const prev = selectPlayer(draft, id);
        if (!prev) throw new Error(`Unknown player: ${id}`);
        const player: Player = typeof update === 'function' ? update(prev) : update;
        const playlistsData = selectPlaylistData(getState()).data;
        if (playlistsData && player.playlistId && player.current) {
          const playlist = selectPlaylistById(playlistsData, player.playlistId);
          const length = playlist?.items.length;
          if (length && player.current >= length) {
            player.current = 0;
          }
          // if (player.playlistId !== prev.playlistId) {
          //   window.mediaStream.setPlaylist(playlist);
          // }
        }
        // if (prev.current !== player.current) {
        //   window.mediaStream.setCurrent(player.current);
        // }
        // window.mediaStream.setFadeOptions({
        //   disableIn: player.disableFadeIn,
        //   disableOut: player.disableFadeOut,
        // });
        dispatch(debouncedUpdatePlayer(player));
        playerAdapter.setOne(draft, player);
      }),
    );
  };

export const playerPlay = () => updatePlayer(sourceId, props => ({ ...props, autoPlay: true }));
export const playerPause = () => updatePlayer(sourceId, props => ({ ...props, autoPlay: false }));
export const playerNext = () =>
  updatePlayer(sourceId, props => ({ ...props, current: props.current + 1 }));
export const playerStop = (): AppThunk => dispatch => {
  dispatch(updatePlayer(sourceId, props => ({ ...props, current: 0, autoPlay: false })));
  dispatch(setPosition(0));
  // dispatch(setDuration(0));
};
export const clearPlayer = (): AppThunk => dispatch => {
  updatePlayer(sourceId, props => ({ ...props, autoPlay: false, current: 0, playlistId: null }));
  dispatch(setPlaybackState('none'));
  dispatch(setPosition(0));
  dispatch(setDuration(0));
};

export const socketMiddleware: Middleware = api => {
  const { dispatch } = api as MiddlewareAPI<AppDispatch, RootState>;
  const socket = new WebSocket(`ws://${host}:${+port + 1}`);
  socket.onmessage = (e: MessageEvent<string>) => {
    try {
      const msg = JSON.parse(e.data);
      if (
        typeof msg === 'object' &&
        'event' in msg &&
        typeof msg.event === 'string' &&
        'data' in msg &&
        Array.isArray(msg.data) &&
        sourceId === msg.data[0]
      ) {
        switch (msg.event) {
          case 'setDuration':
            dispatch(setDuration(msg.data[1]));
            break;
          case 'setCurrentPlaylistItem':
            dispatch(setCurrentPlaylistItem(msg.data[1]));
            break;
          case 'setPosition':
            dispatch(setPosition(msg.data[1]));
            break;
          case 'setPlaybackState':
            dispatch(setPlaybackState(msg.data[1]));
            break;
          default:
            break;
        }
      }
    } catch (err) {
      debug(`unknown event: ${e.data}`);
    }
  };
  return next => action => next(action);
};

export default updatePlayer;
