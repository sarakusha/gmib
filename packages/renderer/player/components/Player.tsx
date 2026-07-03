import TvOffIcon from '@mui/icons-material/TvOff';
import { Box } from '@mui/material';
import React from 'react';

import { selectMediaById, useGetMediaQuery } from '../api/media';
import { usePlayer } from '../api/player';
import { usePlayerMappings } from '../api/mapping';
import { useGetPlaylistById } from '../api/playlists';
import { useDispatch, useSelector } from '../store';
import { setPosition } from '../store/currentSlice';
import { selectCurrent, selectOutputHidden, selectPosition } from '../store/selectors';

import { supportsFeature } from '/@common/capabilities';
import type { MediaInfo } from '/@common/mediaInfo';
import { isRemoteSession, version } from '/@common/remote';
import type { ObjectFitMode } from '/@common/video';

import ControlBar from './ControlBar';

type Props = {
  className?: string;
  playerId?: number;
};

const Player: React.FC<Props> = ({ className, playerId = 0 }) => {
  const { player } = usePlayer(playerId);
  const { mappings = [] } = usePlayerMappings();
  const { data: playlist } = useGetPlaylistById(player?.playlistId);
  const { data: mediaData } = useGetMediaQuery();
  const { duration, playbackState } = useSelector(selectCurrent);
  const position = useSelector(selectPosition);
  const dispatch = useDispatch();
  const outputHidden = useSelector(selectOutputHidden);
  const isSeekSupported = supportsFeature('playerSeek', version, isRemoteSession);
  const { width = 320, height = 240 } = player ?? {};
  const previewObjectFit: ObjectFitMode =
    mappings.find(item => item.player === playerId)?.objectFit ?? 'cover';
  let current: MediaInfo | undefined;
  if (player && playlist?.items && mediaData) {
    const item = playlist.items.find(({ id }) => id === player.current) ?? playlist.items[0];
    current = item && selectMediaById(mediaData, item.md5);
  }
  const pip = document.pictureInPictureElement; // useSelector(selectPiP);
  React.useEffect(() => {
    window.mediaStream.updateSrcObject('video#player');
  }, []);
  const stopped = playbackState === 'none';
  React.useEffect(() => {
    if (stopped) {
      dispatch(setPosition(0));
      if (isRemoteSession) window.mediaStream.clearSrcObject?.('video#player');
    } else if (isRemoteSession) {
      window.mediaStream.updateSrcObject('video#player');
    }
  }, [dispatch, stopped]);
  // const isCaptureEngine = player?.playbackEngine === 'capture';
  // const onTimeUpdate = React.useCallback<React.ReactEventHandler<HTMLVideoElement>>(
  //   e => {
  //     const { currentTime } = e.target as HTMLVideoElement;
  //     // dispatch(setPosition(stopped ? 0 : currentTime));
  //   },
  //   [dispatch, stopped],
  // );
  return (
    <Box sx={{ width: 1, position: 'relative' }}>
      <Box
        sx={{
          width: 1,
          aspectRatio: `${width}/${height}`,
          position: 'relative',
          overflow: 'hidden',
          maxHeight: '50vh',
          mx: 'auto',
          '&:hover': {
            '& .control-bar': {
              opacity: 1,
            },
          },
        }}
        className={className}
      >
        <video
          id="player"
          autoPlay
          css={{
            width: '100%',
            height: '100%',
            objectFit: previewObjectFit,
            backgroundColor: 'black',
          }}
          // onTimeUpdate={isRemoteSession || isCaptureEngine ? undefined : onTimeUpdate}
        >
          {current?.filename}
        </video>
        {outputHidden && (
          <TvOffIcon
            aria-label="Вывод отключен"
            sx={{
              position: 'absolute',
              inset: 0,
              m: 'auto',
              width: '34%',
              height: '34%',
              minWidth: 96,
              minHeight: 96,
              maxWidth: 220,
              maxHeight: 220,
              color: 'rgba(255,255,255,0.62)',
              filter: 'drop-shadow(0 4px 18px rgba(0,0,0,0.65))',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        )}
        <ControlBar
          className="control-bar"
          duration={duration}
          position={position}
          seek={isSeekSupported}
          sx={{
            backgroundColor: 'rgba(0,0,0,0.4)',
            color: 'white',
            position: 'absolute',
            width: 1,
            bottom: 0,
            left: 0,
            opacity: playbackState !== 'playing' || pip ? 1 : 0,
            transition: 'opacity 0.4s',
            zIndex: 2,
          }}
        />
        {/*       <Backdrop
        sx={{ color: '#fff', zIndex: theme => theme.zIndex.drawer + 1, position: 'absolute' }}
        open={seeking}
      >
        <CircularProgress color="inherit" />
      </Backdrop> */}
      </Box>
    </Box>
  );
};

Player.displayName = 'Player';

export default Player;
