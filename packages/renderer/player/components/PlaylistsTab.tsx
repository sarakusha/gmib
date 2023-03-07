import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import {
  Collapse,
  Container,
  css,
  IconButton,
  InputAdornment,
  List,
  TextField,
} from '@mui/material';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Form, Formik } from 'formik';
import { bindMenu, bindTrigger, usePopupState } from 'material-ui-popup-state/hooks';
import React, { useCallback } from 'react';
import { useResizeDetector } from 'react-resize-detector';
import { TransitionGroup } from 'react-transition-group';

import FixedHeadLayout from '../../common/FixedHeadLayout';
import SubmitListener from '../../common/SubmitListener';
import { selectMediaById, useGetMediaQuery } from '../api/media';
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

import { notEmpty } from '/@common/helpers';

import CurrentPlaylist from './CurrentPlaylist';
import MediaItem from './MediaItem';
import Player from './Player';
import PlaylistsToolbar from './PlaylistsToolbar';
import extendStyled from './extendStyled';

const PopupIndicator = extendStyled(IconButton, { open: false })(({ open }) => ({
  padding: 2,
  marginRight: -2,
  ...(open && { transform: 'rotate(180deg)' }),
}));

const PlaylistsTab: React.FC = () => {
  const current = useSelector(selectCurrentPlaylist);
  const { data: playlists = [] } = useGetPlaylists();
  const { data: currentPlaylist } = useGetPlaylistById(current);
  const [removeMedia] = useRemoveMediaMutation();
  const { data: mediaData } = useGetMediaQuery();
  const dispatch = useDispatch();
  const { width, ref } = useResizeDetector();
  const popupState = usePopupState({ variant: 'popover', popupId: 'playlists' });
  React.useEffect(() => {
    popupState.setAnchorEl(ref.current);
  }, [popupState, ref]);
  const removeItemHandler = useCallback(
    (id: string) => {
      // console.log({ id });
      current && removeMedia({ id: current, itemId: id });
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
                  <TextField
                    ref={ref}
                    variant="standard"
                    fullWidth
                    id="name"
                    label="Название"
                    name="name"
                    value={formik.values.name}
                    onChange={formik.handleChange}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <PopupIndicator
                            {...bindTrigger(popupState)}
                            title="Выбрать плейлист"
                          >
                            <ArrowDropDownIcon />
                          </PopupIndicator>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <SubmitListener />
                  {playlists && (
                    <Menu {...bindMenu(popupState)} sx={{ '& .MuiMenu-paper': { width } }}>
                      {playlists.map(({ id, name }) => (
                        <MenuItem
                          key={id}
                          onClick={() => {
                            dispatch(setCurrentPlaylist(id));
                            popupState.close();
                          }}
                        >
                          {name}
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
