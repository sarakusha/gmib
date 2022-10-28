import { Box, Collapse, Container, List } from '@mui/material';
// import debugFactory from 'debug';
import orderBy from 'lodash/orderBy';
import { useSnackbar } from 'notistack';
import React, { useCallback } from 'react';
import { useDrop } from 'react-dnd';
import { NativeTypes } from 'react-dnd-html5-backend';
import { TransitionGroup } from 'react-transition-group';

import { useDeleteMediaByIdMutation, useGetMedia, useUploadMediaMutation } from '../api/media';
import { useSelector } from '../store';
import { selectDescending, selectSearch, selectSortOrder } from '../store/selectors';

import FixedHeadLayout from '../../common/FixedHeadLayout';
import MediaItem from './MediaItem';
import MediaTabToolbar from './MediaTabToolbar';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:media`);

type DragFiles = {
  files: File[];
};

type CollectedProps = {
  isOver: boolean;
  canDrop: boolean;
};

const MediaTab: React.FC = () => {
  const { data } = useGetMedia();
  const [upload] = useUploadMediaMutation();
  const [deleteMedia] = useDeleteMediaByIdMutation();
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();
  const sortOrder = useSelector(selectSortOrder);
  const descending = useSelector(selectDescending);
  const search = useSelector(selectSearch);
  const deleteHandler = useCallback(
    (md5: string) => {
      deleteMedia(md5)
        .unwrap()
        .catch(error => {
          enqueueSnackbar(
            error.status === 409 && error.data?.code === 'SQLITE_CONSTRAINT'
              ? 'Нельзя удалить медиа, если оно включено в плейлист'
              : `Ошибка при удалении: ${error.data?.message}`,
            {
              variant: 'error',
              preventDuplicate: true,
              autoHideDuration: 3000,
              onClose: () => closeSnackbar(),
            },
          );
        });
    },
    [closeSnackbar, deleteMedia, enqueueSnackbar],
  );
  /*
    const [, setToolbar] = useToolbar();
    const tab = useSelector(selectCurrentTab);
    useEffect(() => {
      if (tab === 'media') {
        setToolbar(<MediaTabToolbar />);
        return () => setToolbar(null);
      }
      return noop;
    }, [setToolbar, tab, upload]);
  */
  const [, drop] = useDrop<DragFiles, void, CollectedProps>(
    () => ({
      accept: [NativeTypes.FILE],
      canDrop(item) {
        return item.files?.some(
          file =>
            file.type.startsWith('image/') ||
            file.type.startsWith('video/') ||
            file.name.endsWith('.mkv'),
        );
      },
      drop(item) {
        upload(item.files);
      },
      collect(monitor) {
        return {
          isOver: monitor.isOver(),
          canDrop: monitor.canDrop(),
        };
      },
    }),
    [upload],
  );
  let items = data ? orderBy(data, sortOrder) : [];
  if (descending && items.length) items = items.reverse();
  if (search) items = items.filter(media => media.filename.toLocaleLowerCase().includes(search));
  return (
    <Box width={1} height={1} p={0} ref={drop}>
      <Container maxWidth="sm" disableGutters sx={{ height: 1 }}>
        <FixedHeadLayout gap={0}>
          <MediaTabToolbar />
          <List sx={{ overflow: 'auto', mx: 'auto' }}>
            <TransitionGroup>
              {items.map(media => (
                <Collapse key={media.original.md5}>
                  <MediaItem
                    id={media.md5.startsWith('temp-') ? undefined : media.md5}
                    media={media}
                    onDelete={deleteHandler}
                    deleteTitle="Удалить безвозвратно"
                  />
                </Collapse>
              ))}
            </TransitionGroup>
          </List>
        </FixedHeadLayout>
      </Container>
    </Box>
  );
};

MediaTab.displayName = 'MediaTab';

export default MediaTab;
