import type { Middleware, MiddlewareAPI } from '@reduxjs/toolkit';
import debugFactory from 'debug';
import type { SetStateAction } from 'react';

import { host, port } from '/@common/remote';
import type { Player } from '/@common/video';
import type { PlaylistItem } from '/@common/playlist';

import type { AppDispatch, AppThunk, RootState } from '../store';
import {
  setCurrentPlaylistItem,
  setDuration,
  setPlaybackState,
  setPosition,
} from '../store/currentSlice';
import { sourceId } from '../utils';

import mappingApi from './mapping';
import mediaApi from './media';
import playerApi, { debouncedUpdatePlayer, playerAdapter, selectPlayer } from './player';
import playlistApi, { selectPlaylistById } from './playlists';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:updatePlayer`);

const selectPlaylistData = playlistApi.endpoints.getPlaylists.select();

const getFirstItemFactory =
  (getState: () => RootState) =>
  (playlistId?: number | null): PlaylistItem | undefined => {
    const playlistsData = selectPlaylistData(getState()).data;
    return playlistId && playlistsData
      ? selectPlaylistById(playlistsData, playlistId)?.items[0]
      : undefined;
  };

const getNextItemFactory =
  (getState: () => RootState) =>
  (playlistId?: number | null, current?: string): PlaylistItem | undefined => {
    const playlistsData = selectPlaylistData(getState()).data;
    if (!playlistId || !playlistsData) return undefined;
    const playlist = selectPlaylistById(playlistsData, playlistId);
    if (!playlist || playlist.items.length === 0) return undefined;
    if (!current) return playlist.items[0];
    const index = playlist.items.findIndex(item => item.id === current);
    const next = (index + 1) % playlist.items.length;
    return playlist.items[next];
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
        let player: Player = typeof update === 'function' ? update(prev) : update;
        if (isValidItemFactory(getState)(player.playlistId, player.current) === false) {
          const item = getFirstItemFactory(getState)(player.playlistId);
          item && window.socket.broadcast('setCurrentPlaylistItem', item.id, item.md5);
          player = { ...player, current: item?.id };
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
    updatePlayer(sourceId, props => {
      const item = getNextItemFactory(getState)(props.playlistId, props.current);
      item && window.socket.broadcast('setCurrentPlaylistItem', item.id, item.md5);
      return {
        ...props,
        current: item?.id,
      };
    }),
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
  dispatch(
    updatePlayer(sourceId, props => ({
      ...props,
      autoPlay: false,
      current: undefined,
      playlistId: null,
    })),
  );
  dispatch(setPlaybackState('none'));
  dispatch(setPosition(0));
  dispatch(setDuration(0));
};

export const socketMiddleware: Middleware = api => {
  const { dispatch } = api as MiddlewareAPI<AppDispatch, RootState>;
  const socket = new WebSocket(`ws://${host}:${+port + 1}`);
  socket.onopen = () => socket.send(JSON.stringify({ sourceId }));
  socket.onmessage = (e: MessageEvent<string>) => {
    try {
      const msg = JSON.parse(e.data);
      if (
        typeof msg === 'object' &&
        'event' in msg &&
        typeof msg.event === 'string' &&
        'data' in msg &&
        Array.isArray(msg.data) &&
        (sourceId === msg.data[0] || msg.data[0] === 0)
      ) {
        switch (msg.event) {
          case 'setDuration':
            dispatch(setDuration(msg.data[1]));
            break;
          case 'setCurrentPlaylistItem':
            {
              const [, itemId, mediaId] = msg.data;
              dispatch(setCurrentPlaylistItem(itemId ? { itemId, mediaId } : undefined));
            }
            break;
          case 'setPosition':
            {
              const [, position, duration] = msg.data;
              if (typeof duration === 'number') dispatch(setDuration(duration));
              dispatch(setPosition(position));
            }
            break;
          case 'setPlaybackState':
            dispatch(setPlaybackState(msg.data[1]));
            break;
          case 'media':
            dispatch(
              mediaApi.endpoints.getMedia.initiate(undefined, {
                subscribe: false,
                forceRefetch: true,
              }),
            );
            break;
          case 'player':
            dispatch(
              playerApi.endpoints.getPlayers.initiate(undefined, {
                subscribe: false,
                forceRefetch: true,
              }),
            );
            break;
          case 'playlist':
            dispatch(
              playlistApi.endpoints.getPlaylists.initiate(undefined, {
                subscribe: false,
                forceRefetch: true,
              }),
            );
            break;
          case 'mapping':
            dispatch(
              mappingApi.endpoints.getMappings.initiate(undefined, {
                subscribe: false,
                forceRefetch: true,
              }),
            );
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
