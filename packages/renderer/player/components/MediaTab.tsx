import { Box, Collapse, Container, List } from '@mui/material';
// import debugFactory from 'debug';
import orderBy from 'lodash/orderBy';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDrop } from 'react-dnd';
import { NativeTypes } from 'react-dnd-html5-backend';
import { TransitionGroup } from 'react-transition-group';

import FixedHeadLayout from '../../common/FixedHeadLayout';
import mediaApi, {
  mediaAdapter,
  type MediaTransferProgress,
  uploadMediaFile,
  useDeleteMediaByIdMutation,
  useGetMedia,
} from '../api/media';
import { useDispatch, useSelector } from '../store';
import {
  selectCurrentTab,
  selectDescending,
  selectSearch,
  selectSortOrder,
} from '../store/selectors';

import MediaItem from './MediaItem';
import MediaTabToolbar from './MediaTabToolbar';
import type { MediaInfo } from '/@common/mediaInfo';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:media`);

type DragFiles = {
  files: File[];
};

type CollectedProps = {
  isOver: boolean;
  canDrop: boolean;
};

type UploadEntry = {
  tempId: string;
  file: File;
  media: MediaInfo;
  progress?: MediaTransferProgress;
  error?: unknown;
};

const MediaTab: React.FC = () => {
  const dispatch = useDispatch();
  const { data = [] } = useGetMedia();
  const [deleteMedia] = useDeleteMediaByIdMutation();
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();
  const sortOrder = useSelector(selectSortOrder);
  const descending = useSelector(selectDescending);
  const search = useSelector(selectSearch);
  const tab = useSelector(selectCurrentTab);
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const previousTab = useRef(tab);
  const currentUpload = useRef<string | undefined>(undefined);
  const controllers = useRef(new Map<string, AbortController>());

  const updateUpload = useCallback((tempId: string, update: Partial<UploadEntry>) => {
    setUploads(items =>
      items.map(item => (item.tempId === tempId ? { ...item, ...update } : item)),
    );
  }, []);

  const removeUpload = useCallback((tempId: string) => {
    setUploads(items => items.filter(item => item.tempId !== tempId));
  }, []);

  const startUpload = useCallback(
    (upload: UploadEntry) => {
      const controller = new AbortController();
      currentUpload.current = upload.tempId;
      controllers.current.set(upload.tempId, controller);
      updateUpload(upload.tempId, { progress: { phase: 'uploading', progress: 0 } });

      void (async () => {
        try {
          const result = await uploadMediaFile(
            upload.file,
            progress => {
              updateUpload(upload.tempId, { progress });
            },
            controller.signal,
          );
          dispatch(
            mediaApi.util.updateQueryData('getMedia', undefined, draft => {
              mediaAdapter.setAll(draft, result);
            }),
          );
          removeUpload(upload.tempId);
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            removeUpload(upload.tempId);
          } else {
            updateUpload(upload.tempId, {
              progress: { phase: 'failed', error },
              error,
            });
          }
        } finally {
          controllers.current.delete(upload.tempId);
          if (currentUpload.current === upload.tempId) currentUpload.current = undefined;
        }
      })();
    },
    [dispatch, removeUpload, updateUpload],
  );

  useEffect(() => {
    if (previousTab.current === 'media' && tab !== 'media') {
      setUploads(items => items.filter(item => item.progress?.phase !== 'failed'));
    }
    previousTab.current = tab;
  }, [tab]);

  useEffect(() => {
    if (currentUpload.current) return;
    const nextUpload = uploads.find(item => item.progress?.phase === 'queued');
    if (nextUpload) startUpload(nextUpload);
  }, [startUpload, uploads]);

  const visibleItems = useMemo(() => {
    const pending = uploads.map(upload => ({
      key: upload.tempId,
      media: upload.media,
      uploadProgress:
        upload.progress ??
        (upload.error ? { phase: 'failed' as const, error: upload.error } : undefined),
    }));
    const published = data.map(media => ({
      key: media.md5,
      media,
      uploadProgress: undefined,
    }));
    const items = orderBy([...pending, ...published], [item => item.media[sortOrder]], ['asc']);
    return descending ? items.reverse() : items;
  }, [data, descending, sortOrder, uploads]);

  const deleteHandler = useCallback(
    (md5: string) => {
      deleteMedia(md5)
        .unwrap()
        .catch((error: unknown) => {
          const isObject = typeof error === 'object' && error !== null;
          const isConstraintError =
            isObject &&
            'status' in error &&
            error.status === 409 &&
            'data' in error &&
            typeof error.data === 'object' &&
            error.data !== null &&
            'code' in error.data &&
            error.data.code === 'SQLITE_CONSTRAINT';

          const message =
            isObject &&
            'data' in error &&
            typeof error.data === 'object' &&
            error.data !== null &&
            'message' in error.data &&
            typeof error.data.message === 'string'
              ? error.data.message
              : 'Неизвестная ошибка';

          enqueueSnackbar(
            isConstraintError
              ? 'Нельзя удалить медиа, если оно включено в плейлист'
              : `Ошибка при удалении: ${message}`,
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

  const enqueueUploads = useCallback((files: File[] | FileList) => {
    const now = Date.now();
    setUploads(items => [
      ...items,
      ...[...files].map((file, index) => {
        const tempId = `temp-${now}-${index}`;
        return {
          tempId,
          file,
          media: {
            md5: tempId,
            filename: file.name,
            original: {
              md5: tempId,
              filename: file.name,
            },
            duration: 0,
            size: file.size,
            streams: 0,
            width: 0,
            height: 0,
            uploadTime: new Date(now + index).toISOString(),
          },
          progress: { phase: 'queued' as const },
        };
      }),
    ]);
  }, []);

  const cancelUpload = useCallback(
    (tempId: string) => {
      const controller = controllers.current.get(tempId);
      if (controller) {
        controller.abort();
        return;
      }
      removeUpload(tempId);
    },
    [removeUpload],
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
        enqueueUploads(item.files);
      },
      collect(monitor) {
        return {
          isOver: monitor.isOver(),
          canDrop: monitor.canDrop(),
        };
      },
    }),
    [enqueueUploads],
  );
  return (
    <Box
      ref={node => {
        drop(node as HTMLDivElement | null);
      }}
      sx={{
        width: 1,
        height: 1,
        p: 0,
      }}
    >
      <Container maxWidth="sm" disableGutters sx={{ height: 1 }}>
        <FixedHeadLayout gap={0}>
          <MediaTabToolbar upload={enqueueUploads} />
          <List sx={{ overflow: 'auto', mx: 'auto' }}>
            <TransitionGroup>
              {visibleItems
                .filter(item => !search || item.media.filename.toLocaleLowerCase().includes(search))
                .map(item => (
                  <Collapse key={item.key}>
                    <MediaItem
                      id={item.media.md5.startsWith('temp-') ? undefined : item.media.md5}
                      media={item.media}
                      onDelete={deleteHandler}
                      deleteTitle="Удалить безвозвратно"
                      uploadProgress={item.uploadProgress}
                      onCancelUpload={
                        item.media.md5.startsWith('temp-')
                          ? () => cancelUpload(item.media.md5)
                          : undefined
                      }
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
