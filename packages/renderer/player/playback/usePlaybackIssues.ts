import { useSnackbar } from 'notistack';
import * as React from 'react';

import type { PlaybackStatusSnapshot } from '/@common/playback';

import { useGetPlaybackStatusQuery, useRetryPlaybackMutation } from '../api/playback';
import {
  getPlaybackSnapshot,
  selectPlaybackIssue,
  setPlaybackStatus,
  subscribePlaybackStatus,
} from './playbackStore';

let playbackUnsupported = false;

const errorStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  return typeof error.status === 'number' ? error.status : undefined;
};

const usePlaybackStatusResource = () => {
  const [enabled, setEnabled] = React.useState(!playbackUnsupported);
  const status = useGetPlaybackStatusQuery(undefined, {
    skip: !enabled,
    refetchOnFocus: true,
  });
  React.useEffect(() => {
    if (errorStatus(status.error) === 404) {
      playbackUnsupported = true;
      setEnabled(false);
    }
  }, [status.error]);
  return status;
};

export const usePlaybackIssues = (): PlaybackStatusSnapshot => {
  const status = usePlaybackStatusResource();
  React.useEffect(() => {
    if (status.data) setPlaybackStatus(status.data);
  }, [status.data]);
  return React.useSyncExternalStore(
    subscribePlaybackStatus,
    getPlaybackSnapshot,
    getPlaybackSnapshot,
  );
};

export const usePlaybackFeatureAvailable = (): boolean => usePlaybackStatusResource().isSuccess;

export const usePlaybackIssue = (mediaId: string, playerId?: number) => {
  const { issues } = usePlaybackIssues();
  return selectPlaybackIssue(issues, mediaId, playerId);
};

export const useRetryPlayback = (): ((mediaId: string) => void) => {
  const [retry] = useRetryPlaybackMutation();
  const { enqueueSnackbar } = useSnackbar();
  return React.useCallback(
    (mediaId: string) => {
      void retry(mediaId)
        .unwrap()
        .catch(() => {
          enqueueSnackbar('Не удалось повторить воспроизведение', {
            variant: 'error',
            preventDuplicate: true,
            autoHideDuration: 3000,
          });
        });
    },
    [enqueueSnackbar, retry],
  );
};
