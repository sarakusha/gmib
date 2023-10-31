import CloseIcon from '@mui/icons-material/Close';
import {
  Collapse,
  FormControl,
  FormLabel,
  IconButton,
  List,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import * as React from 'react';
import { TransitionGroup } from 'react-transition-group';

import { selectMediaById, useGetMediaQuery } from '../../api/media';
import { usePlayer } from '../../api/player';
import { useGetPlaylistById } from '../../api/playlists';
import { clearPlayer } from '../../api/updatePlayer';
import { useDispatch } from '../../store';
import { setCurrentPlaylistItem, setPlaybackState } from '../../store/currentSlice';

import PlaylistItem from './PlaylistItem';

type Props = {
  playerId: number;
  className?: string;
};

const CurrentPlaylist: React.FC<Props> = ({ playerId, className }) => {
  const { player } = usePlayer(playerId);
  const { current, playlistId } = player ?? {};
  const { data: currentPlaylist } = useGetPlaylistById(playlistId);
  const { data: mediaData } = useGetMediaQuery();
  const dispatch = useDispatch();
  const updateCurrentHandler = React.useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    e => {
      dispatch(setCurrentPlaylistItem(e.target.value));
      dispatch(setPlaybackState('playing'));
    },
    [dispatch],
  );
  if (!currentPlaylist || !mediaData) return null;
  return (
    <FormControl className={className} sx={{ width: 1 }}>
      <Stack direction="row" width={1} justifyContent="space-between" alignItems="center">
        <FormLabel id="current-playlist-name">
          <Typography variant="body2" noWrap>
            {currentPlaylist.name}
          </Typography>
        </FormLabel>
        <IconButton
          size="small"
          sx={{ my: 'auto' }}
          title="Очистить плеер"
          onClick={() => dispatch(clearPlayer())}
        >
          <CloseIcon fontSize="inherit" />
        </IconButton>
      </Stack>
      <RadioGroup
        aria-labelledby="current-playlist-name"
        name="current-playlist"
        value={current ?? null}
        onChange={updateCurrentHandler}
      >
        <List sx={{ width: 1 }}>
          <TransitionGroup>
            {currentPlaylist.items
              .map(({ md5, id }) => [id, selectMediaById(mediaData, md5)] as const)
              .map(
                ([id, media], index) =>
                  media && (
                    <Collapse key={id}>
                      <PlaylistItem value={id} index={index + 1} media={media} />
                    </Collapse>
                  ),
              )}
          </TransitionGroup>
        </List>
      </RadioGroup>
    </FormControl>
  );
};

CurrentPlaylist.displayName = 'CurrentPlaylist';

export default CurrentPlaylist;
