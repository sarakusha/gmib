import type { Middleware, MiddlewareAPI } from '@reduxjs/toolkit';
import debugFactory from 'debug';
import type { SetStateAction } from 'react';

import { host, port } from '/@common/remote';
import type { Player } from '/@common/video';

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

type SocketMessage = {
  event: string;
  data: unknown[];
};

const selectPlayersData = playerApi.endpoints.getPlayers.select();
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
        let player: Player = typeof update === 'function' ? update(prev) : update;
        if (isValidItemFactory(getState)(player.playlistId, player.current) === false) {
          player = { ...player, current: getFirstItemFactory(getState)(player.playlistId) };
        }
        void dispatch(debouncedUpdatePlayer(player));
        playerAdapter.setOne(draft, player);
      }),
    );
  };

export const playerPlay = () => updatePlayer(sourceId, props => ({ ...props, autoPlay: true }));
export const playerPause = () => updatePlayer(sourceId, props => ({ ...props, autoPlay: false }));
export const playerNext = (): AppThunk => (dispatch, getState) => {
  const playersData = selectPlayersData(getState()).data;
  const player = playersData && selectPlayer(playersData, sourceId);
  const next = getNextItemFactory(getState)(player?.playlistId, player?.current);
  if (next && next === player?.current) {
    window.mediaStream.seek?.(0);
    dispatch(setPosition(0));
  }
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
      const msg: unknown = JSON.parse(e.data);
      if (
        typeof msg === 'object' &&
        msg !== null &&
        'event' in msg &&
        typeof (msg as SocketMessage).event === 'string' &&
        'data' in msg &&
        Array.isArray((msg as SocketMessage).data) &&
        (sourceId === (msg as SocketMessage).data[0] || (msg as SocketMessage).data[0] === 0)
      ) {
        const { event, data } = msg as SocketMessage;
        switch (event) {
          case 'setDuration':
            dispatch(setDuration(data[1] as number));
            break;
          case 'setCurrentPlaylistItem':
            {
              const [, itemId, mediaId] = data;
              dispatch(
                setCurrentPlaylistItem(
                  typeof itemId === 'string'
                    ? {
                        itemId,
                        ...(typeof mediaId === 'string' ? { mediaId } : {}),
                      }
                    : undefined,
                ),
              );
            }
            break;
          case 'setPosition':
            {
              const [, position, duration] = data;
              if (typeof duration === 'number') dispatch(setDuration(duration));
              if (typeof position === 'number') dispatch(setPosition(position));
            }
            break;
          case 'setPlaybackState':
            dispatch(setPlaybackState(data[1] as Parameters<typeof setPlaybackState>[0]));
            break;
          case 'media':
            void dispatch(
              mediaApi.endpoints.getMedia.initiate(undefined, {
                subscribe: false,
                forceRefetch: true,
              }),
            );
            break;
          case 'player':
            void dispatch(
              playerApi.endpoints.getPlayers.initiate(undefined, {
                subscribe: false,
                forceRefetch: true,
              }),
            );
            break;
          case 'playlist':
            void dispatch(
              playlistApi.endpoints.getPlaylists.initiate(undefined, {
                subscribe: false,
                forceRefetch: true,
              }),
            );
            break;
          case 'mapping':
            void dispatch(
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
    } catch {
      debug(`unknown event: ${e.data}`);
    }
  };
  return next => action => next(action);
};

export default updatePlayer;
