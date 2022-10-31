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
import React, { useState } from 'react';


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
import useShiftAlert from '../hooks/useShiftAlert';
import { useDispatch, useSelector } from '../store';
import { setCurrentPlaylist } from '../store/currentSlice';
import { selectCurrentPlaylist } from '../store/selectors';
import { shuffleItems, sourceId } from '../utils';

import Toolbar from './StyledToolbar';

type Props = {
  size?: IconButtonProps['size'];
};

const PlaylistsToolbar: React.FC<Props> = ({ size }) => {
  const [create] = useCreatePlaylistMutation();
  const [remove] = useDeletePlaylistMutation();
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
          onClick={() =>
            create({ name: 'Новый плейлист', flags: 0 }).then(res => {
              'data' in res && dispatch(setCurrentPlaylist(res.data.id));
            })
          }
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
            onClick={async () => {
              if (currentPlaylist) {
                const { id, creationTime, items, ...copy } = currentPlaylist;
                const res = await create(copy);
                if ('data' in res) {
                  dispatch(updatePlaylist(res.data.id, value => ({ ...value, items })));
                  dispatch(setCurrentPlaylist(res.data.id));
                }
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
            onClick={() =>
              dispatch(
                updatePlayer(sourceId, prev => ({ ...prev, playlistId: current, current: 0 })),
              )
            }
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
            disabled={!current}
            onClick={async e => {
              if (!e.shiftKey) showAlert();
              else if (current) {
                const index = findIndex(playlists, { id: current });
                const near = index > 0 ? index - 1 : 1;
                dispatch(setCurrentPlaylist(playlists[near]?.id));
                remove(current);
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
            disabled={!current}
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
            disabled={!current || empty}
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
            disabled={!current || empty}
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
