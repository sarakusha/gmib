import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import {
  Collapse,
  Container,
  css,
  FormLabel,
  IconButton,
  InputAdornment,
  List,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Form, Formik } from 'formik';
import { bindMenu, bindTrigger, usePopupState } from 'material-ui-popup-state/hooks';
import React, { useCallback, useMemo } from 'react';
import { useResizeDetector } from 'react-resize-detector';
import { TransitionGroup } from 'react-transition-group';

import { supportsFeature } from '/@common/capabilities';
import { isRemoteSession, version } from '/@common/remote';

import FixedHeadLayout from '../../common/FixedHeadLayout';
import SubmitListener from '../../common/SubmitListener';
import { selectMediaById, useGetMediaQuery } from '../api/media';
import { useGetPlaylistTimingStatisticsQuery } from '../api/playback';
import { usePlayer } from '../api/player';
import {
  moveItem,
  updatePlaylist,
  useGetPlaylistById,
  useGetPlaylists,
  useRemoveMediaMutation,
} from '../api/playlists';
import { useDispatch, useSelector } from '../store';
import { setCurrentPlaylist } from '../store/currentSlice';
import { selectCurrentPlaylist } from '../store/selectors';
import { sourceId } from '../utils';
import { selectPlaybackIssue } from '../playback/playbackStore';
import { usePlaybackIssues, useRetryPlayback } from '../playback/usePlaybackIssues';

import { notEmpty } from '/@common/helpers';

import CurrentPlaylist from './CurrentPlaylist';
import MediaItem from './MediaItem';
import Player from './Player';
import PlaylistDuration, { getPlaylistDurationDisplay } from './PlaylistDuration';
import PlaylistsToolbar from './PlaylistsToolbar';
import extendStyled from './extendStyled';

const PopupIndicator = extendStyled(IconButton, { open: false })(({ open }) => ({
  padding: 2,
  marginRight: -2,
  ...(open && { transform: 'rotate(180deg)' }),
}));

const PlaylistsTab: React.FC = () => {
  const { player } = usePlayer(sourceId);
  const current = useSelector(selectCurrentPlaylist);
  const { data: playlists = [] } = useGetPlaylists();
  const { data: currentPlaylist } = useGetPlaylistById(current ?? player?.playlistId);
  const [removeMedia] = useRemoveMediaMutation();
  const { data: mediaData } = useGetMediaQuery();
  const { currentData: timingStatistics } = useGetPlaylistTimingStatisticsQuery(sourceId, {
    skip:
      !player ||
      playlists.length === 0 ||
      !supportsFeature('playlistTimingStatistics', version, isRemoteSession),
    pollingInterval: 60_000,
    refetchOnMountOrArgChange: 60,
  });
  const durations = useMemo(
    () =>
      new Map(
        player
          ? playlists.map(
              playlist =>
                [
                  playlist.id,
                  getPlaylistDurationDisplay(
                    playlist,
                    mediaData?.entities ?? {},
                    player,
                    timingStatistics,
                  ),
                ] as const,
            )
          : [],
      ),
    [playlists, mediaData, player, timingStatistics],
  );
  const dispatch = useDispatch();
  const { width, ref } = useResizeDetector();
  const popupState = usePopupState({ variant: 'popover', popupId: 'playlists' });
  const { issues: playbackIssues } = usePlaybackIssues();
  const retryPlayback = useRetryPlayback();
  const { setAnchorEl } = popupState;
  React.useEffect(() => {
    setAnchorEl(ref.current);
  }, [ref, setAnchorEl]);
  const removeItemHandler = useCallback(
    (id: string) => {
      if (current) void removeMedia({ id: current, itemId: id });
    },
    [current, removeMedia],
  );
  const moveHandler = useCallback(
    (from: number, to: number): void => {
      current && dispatch(moveItem(current, from, to));
    },
    [current, dispatch],
  );
  const moveFinishedHandler = useCallback(() => {
    current && dispatch(updatePlaylist(current, playlist => playlist));
  }, [current, dispatch]);
  // React.useEffect(() => {
  //   console.log('TRY');
  //   const timer = setTimeout(createRemotes, 200);
  //   return () => {
  //     clearTimeout(timer);
  //   };
  // }, []);
  return (
    <Container
      maxWidth="md"
      disableGutters
      sx={{
        height: 1,
        display: 'flex',
        gap: 2,
      }}
    >
      <FixedHeadLayout
        css={css`
          width: 320px;
        `}
      >
        <Player playerId={sourceId} />
        <CurrentPlaylist playerId={sourceId} />
      </FixedHeadLayout>
      <FixedHeadLayout
        css={css`
          flex: 1;
          // overflow-y: auto;
          min-width: 0;
        `}
      >
        <div>
          <PlaylistsToolbar />
          {playlists.length > 0 && (
            <Formik
              initialValues={currentPlaylist ?? { id: 0, name: '', flags: 0, items: [] }}
              enableReinitialize
              onSubmit={(values, actions) => {
                dispatch(updatePlaylist(current, values));
                actions.setSubmitting(false);
              }}
            >
              {formik => (
                <Form>
                  <Stack
                    direction="row"
                    sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mt: 1 }}
                  >
                    <FormLabel htmlFor="name" sx={{ fontSize: '0.75rem' }}>
                      Название
                    </FormLabel>
                    <PlaylistDuration value={durations.get(formik.values.id)} />
                  </Stack>
                  <TextField
                    ref={ref}
                    variant="standard"
                    fullWidth
                    id="name"
                    name="name"
                    value={formik.values.name}
                    onChange={formik.handleChange}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <PopupIndicator {...bindTrigger(popupState)} title="Выбрать плейлист">
                              <ArrowDropDownIcon />
                            </PopupIndicator>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <SubmitListener />
                  {playlists && (
                    <Menu {...bindMenu(popupState)} sx={{ '& .MuiMenu-paper': { width } }}>
                      {playlists.map(({ id, name }) => (
                        <MenuItem
                          key={id}
                          sx={{ gap: 2, justifyContent: 'space-between' }}
                          onClick={() => {
                            dispatch(setCurrentPlaylist(id));
                            popupState.close();
                          }}
                        >
                          <Typography component="span" noWrap sx={{ minWidth: 0 }}>
                            {name}
                          </Typography>
                          <PlaylistDuration value={durations.get(id)} />
                        </MenuItem>
                      ))}
                    </Menu>
                  )}
                </Form>
              )}
            </Formik>
          )}
        </div>
        {mediaData && currentPlaylist?.items && (
          <List sx={{ overflowY: 'auto' }}>
            <TransitionGroup>
              {currentPlaylist.items
                .map(({ md5, id }) => [id, selectMediaById(mediaData, md5)] as const)
                .map(
                  ([id, media], index) =>
                    media && (
                      <Collapse key={id}>
                        <MediaItem
                          id={id}
                          media={media}
                          pos={index}
                          onDelete={removeItemHandler}
                          onMove={moveHandler}
                          onMoveFinished={moveFinishedHandler}
                          deleteTitle="Удалить из плейлиста"
                          playbackIssue={selectPlaybackIssue(playbackIssues, media.md5)}
                          onRetryPlayback={retryPlayback}
                        />
                      </Collapse>
                    ),
                )
                .filter(notEmpty)}
            </TransitionGroup>
          </List>
        )}
      </FixedHeadLayout>
    </Container>
  );
};

PlaylistsTab.displayName = 'PlaylistsTab';

export default PlaylistsTab;
