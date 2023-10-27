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

const getFirstItemFactory =
  (getState: () => RootState) =>
  (playlistId?: number | null): string | undefined => {
    const playlistsData = selectPlaylistData(getState()).data;
    return playlistId && playlistsData
      ? selectPlaylistById(playlistsData, playlistId)?.items[0]?.id
      : undefined;
  };

const getNextItemFactory =
  (getState: () => RootState) =>
  (playlistId?: number | null, current?: string): string | undefined => {
    const playlistsData = selectPlaylistData(getState()).data;
    if (!playlistId || !playlistsData) return undefined;
    const playlist = selectPlaylistById(playlistsData, playlistId);
    if (!playlist || playlist.items.length === 0) return undefined;
    if (!current) return playlist.items[0].id;
    const index = playlist.items.findIndex(item => item.id === current);
    const next = (index + 1) % playlist.items.length;
    return playlist.items[next].id;
  };

const isValidItemFactory =
  (getState: () => RootState) =>
  (playlistId?: number | null, current?: string): boolean | undefined => {
    const playlistsData = selectPlaylistData(getState()).data;
    if (!playlistId || !playlistsData) return undefined;
    const playlist = selectPlaylistById(playlistsData, playlistId);
    if (!playlist || playlist.items.length === 0) return undefined;
    if (!current) return false;
    const index = playlist.items.findIndex(item => item.id === current);
    return index !== -1;
  };
const updatePlayer =
  (id: number, update: SetStateAction<Player>): AppThunk =>
  (dispatch, getState) => {
    dispatch(
      playerApi.util.updateQueryData('getPlayers', undefined, draft => {
        const prev = selectPlayer(draft, id);
        if (!prev) throw new Error(`Unknown player: ${id}`);
        const player: Player = typeof update === 'function' ? update(prev) : update;
        if (isValidItemFactory(getState)(player.playlistId, player.current) === false) {
          player.current = getFirstItemFactory(getState)(player.playlistId);
        }
        dispatch(debouncedUpdatePlayer(player));
        playerAdapter.setOne(draft, player);
      }),
    );
  };

export const playerPlay = () => updatePlayer(sourceId, props => ({ ...props, autoPlay: true }));
export const playerPause = () => updatePlayer(sourceId, props => ({ ...props, autoPlay: false }));
export const playerNext = (): AppThunk => (dispatch, getState) => {
  dispatch(
    updatePlayer(sourceId, props => ({
      ...props,
      current: getNextItemFactory(getState)(props.playlistId, props.current),
    })),
  );
};
export const playerStop = (): AppThunk => dispatch => {
  dispatch(
    updatePlayer(sourceId, props => ({
      ...props,
      current: undefined,
      autoPlay: false,
    })),
  );
  dispatch(setPosition(0));
  // dispatch(setDuration(0));
};
export const clearPlayer = (): AppThunk => dispatch => {
  updatePlayer(sourceId, props => ({
    ...props,
    autoPlay: false,
    current: undefined,
    playlistId: null,
  }));
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
