import ClearAllIcon from '@mui/icons-material/ClearAll';
import DeleteIcon from '@mui/icons-material/Delete';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import ShuffleIcon from '@mui/icons-material/Shuffle';
// import QueuePlayNextIcon from '@mui/icons-material/QueuePlayNext';
// import ShareIcon from '@mui/icons-material/Share';
// import SubscriptionsIcon from '@mui/icons-material/Subscriptions';
import type { IconButtonProps } from '@mui/material';
import { IconButton, Tooltip } from '@mui/material';
import findIndex from 'lodash/findIndex';
import { useSnackbar } from 'notistack';
import React, { useState } from 'react';

import useShiftAlert from '../../common/useShiftAlert';
import {
  selectPlaylistById,
  selectPlaylists,
  updatePlaylist,
  useCreatePlaylistMutation,
  useDeletePlaylistMutation,
  useGetPlaylistsQuery,
} from '../api/playlists';
import updatePlayer from '../api/updatePlayer';
import AddMediaDialog from '../dialogs/AddMediaDialog';
import { useDispatch, useSelector } from '../store';
import { setCurrentPlaylist } from '../store/currentSlice';
import { selectCurrentPlaylist } from '../store/selectors';
import { shuffleItems, sourceId } from '../utils';

import Toolbar from './StyledToolbar';

type Props = {
  size?: IconButtonProps['size'];
};

const getDeleteErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof error.message === 'string') return error.message;
    if ('name' in error && typeof error.name === 'string') return error.name;
    if ('data' in error) {
      if (typeof error.data === 'string') return error.data;
      if (typeof error.data === 'object' && error.data !== null && 'message' in error.data) {
        const { message } = error.data;
        if (typeof message === 'string') return message;
      }
    }
    if ('error' in error && typeof error.error === 'string') return error.error;
    if ('status' in error) return `HTTP ${String(error.status)}`;
    const json = JSON.stringify(error);
    if (json && json !== '{}') return json;
    const keys = Object.keys(error);
    if (keys.length > 0) return `Ошибка без сообщения, поля: ${keys.join(', ')}`;
  }
  if (typeof error === 'string' && error.length > 0) return error;
  return `Неизвестная ошибка (${String(error)})`;
};

const PlaylistsToolbar: React.FC<Props> = ({ size }) => {
  const [create] = useCreatePlaylistMutation();
  const [remove] = useDeletePlaylistMutation();
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();
  const { data } = useGetPlaylistsQuery();
  const playlists = data ? selectPlaylists(data) : [];
  const dispatch = useDispatch();
  const current = useSelector(selectCurrentPlaylist);
  const currentPlaylist = current != null && data ? selectPlaylistById(data, current) : undefined;
  const empty = Boolean(currentPlaylist && currentPlaylist.items.length === 0);
  const showAlert = useShiftAlert();
  const [openDialog, setOpenDialog] = useState(false);
  return (
    <Toolbar>
      <Tooltip title="Новый плейлист">
        <IconButton
          size={size}
          color="inherit"
          onClick={() => {
            void create({ name: 'Новый плейлист', flags: 0 }).then(res => {
              'data' in res && res.data && dispatch(setCurrentPlaylist(res.data.id));
            });
          }}
          disabled={empty}
        >
          <InsertDriveFileIcon fontSize="inherit" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Создать копию">
        <div>
          <IconButton
            size={size}
            color="inherit"
            disabled={!currentPlaylist || empty}
            onClick={() => {
              if (currentPlaylist) {
                void (async () => {
                  const { id: _, creationTime: __, ...copy } = currentPlaylist;
                  const res = await create(copy);
                  if ('data' in res && res.data) {
                    dispatch(setCurrentPlaylist(res.data.id));
                  }
                })();
              }
            }}
          >
            <FileCopyIcon fontSize="inherit" />
          </IconButton>
        </div>
      </Tooltip>
      <Tooltip title="Сменить плейлист на экране">
        <div>
          <IconButton
            color="inherit"
            disabled={!currentPlaylist || empty}
            size={size}
            onClick={() => {
              void dispatch(
                updatePlayer(sourceId, prev => ({
                  ...prev,
                  playlistId: current,
                  current: undefined,
                })),
              );
            }}
          >
            <OndemandVideoIcon fontSize="inherit" />
          </IconButton>
        </div>
      </Tooltip>
      <Tooltip title="Удалить плейлист">
        <div>
          <IconButton
            size={size}
            color="inherit"
            disabled={current == null}
            onClick={e => {
              if (!e.shiftKey) showAlert();
              else if (current != null) {
                const index = findIndex(playlists, { id: current });
                const near = index > 0 ? index - 1 : 1;
                dispatch(setCurrentPlaylist(playlists[near]?.id ?? null));
                void remove(current)
                  .unwrap()
                  .catch((error: unknown) => {
                    dispatch(setCurrentPlaylist(current));
                    const message = getDeleteErrorMessage(error);
                    enqueueSnackbar(`Ошибка при удалении плейлиста: ${message}`, {
                      variant: 'error',
                      preventDuplicate: true,
                      autoHideDuration: 5000,
                      onClose: () => closeSnackbar(),
                    });
                  });
              }
            }}
          >
            <DeleteIcon fontSize="inherit" />
          </IconButton>
        </div>
      </Tooltip>
      <Tooltip title="Добавить в плейлист">
        <div>
          <IconButton
            color="inherit"
            disabled={current == null}
            onClick={() => setOpenDialog(true)}
            size={size}
          >
            <PlaylistAddIcon />
          </IconButton>
        </div>
      </Tooltip>
      <Tooltip title="Очистить плейлист">
        <div>
          <IconButton
            size={size}
            color="inherit"
            disabled={current == null || empty}
            onClick={() => {
              dispatch(updatePlaylist(current, playlist => ({ ...playlist, items: [] })));
            }}
          >
            <ClearAllIcon fontSize="inherit" />
          </IconButton>
        </div>
      </Tooltip>
      <Tooltip title="Перемешать плейлист">
        <div>
          <IconButton
            size={size}
            color="inherit"
            disabled={current == null || empty}
            onClick={() => {
              dispatch(
                updatePlaylist(current, ({ items, ...playlist }) => ({
                  ...playlist,
                  items: shuffleItems(items ?? []),
                })),
              );
            }}
          >
            <ShuffleIcon fontSize="inherit" />
          </IconButton>
        </div>
      </Tooltip>
      <AddMediaDialog open={openDialog} onClose={() => setOpenDialog(false)} id={current} />
    </Toolbar>
  );
};

PlaylistsToolbar.displayName = 'PlaylistsToolbar';

export default React.memo(PlaylistsToolbar);
