import { Box } from '@mui/material';
import React from 'react';

import { selectMediaById, useGetMediaQuery } from '../api/media';
import { usePlayer } from '../api/player';
import { useGetPlaylistById } from '../api/playlists';
import { useDispatch, useSelector } from '../store';
import { selectCurrent, selectPosition } from '../store/selectors';

import type { MediaInfo } from '/@common/mediaInfo';

import ControlBar from './ControlBar';
import { setPosition } from '../store/currentSlice';
import { isRemoteSession } from '/@common/remote';

type Props = {
  className?: string;
  playerId?: number;
};

const Player: React.FC<Props> = ({ className, playerId = 0 }) => {
  const { player } = usePlayer(playerId);
  const { data: playlist } = useGetPlaylistById(player?.playlistId);
  const { data: mediaData } = useGetMediaQuery();
  const { duration, playbackState } = useSelector(selectCurrent);
  const position = useSelector(selectPosition);
  const dispatch = useDispatch();
  const { width = 320, height = 240 } = player ?? {};
  let current: MediaInfo | undefined;
  if (player && playlist?.items && mediaData) {
    const item = playlist.items.find(({ id }) => id === player.current) ?? playlist.items[0];
    current = item && selectMediaById(mediaData, item.md5);
  }
  const pip = document.pictureInPictureElement; // useSelector(selectPiP);
  React.useEffect(() => {
    window.mediaStream.updateSrcObject('video#player');
  }, []);
  const [show, setShow] = React.useState(false);

  const stopped = playbackState === 'none';
  const onTimeUpdate = React.useCallback<React.ReactEventHandler<HTMLVideoElement>>(
    e => {
      const { currentTime } = e.target as HTMLVideoElement;
      dispatch(setPosition(stopped ? 0 : currentTime));
    },
    [dispatch, stopped],
  );
  return (
    <Box sx={{ width: 1, position: 'relative' }}>
      <Box
        sx={{
          width: 1,
          aspectRatio: `${width}/${height}`,
          // position: 'relative',
          overflow: 'hidden',
          maxHeight: '50vh',
          mx: 'auto',
        }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className={className}
      >
        <video
          id="player"
          autoPlay
          css={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: 'black',
          }}
          onTimeUpdate={isRemoteSession ? undefined : onTimeUpdate}
        >
          {current?.filename}
        </video>
        <ControlBar
          duration={duration}
          position={position}
          sx={{
            backgroundColor: 'rgba(0,0,0,0.4)',
            color: 'white',
            position: 'absolute',
            width: 1,
            bottom: 0,
            left: 0,
            opacity: show || playbackState !== 'playing' || pip ? 1 : 0,
            transition: 'opacity 0.4s',
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
