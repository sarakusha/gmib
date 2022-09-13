import { Box } from '@mui/material';
// import Backdrop from '@mui/material/Backdrop';
// import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';

import { selectMediaById, useGetMediaQuery } from '../api/media';
import { usePlayer } from '../api/player';
import { useGetPlaylistById } from '../api/playlists';
import useMediaStream from '../hooks/useMediaStream';
import { useSelector } from '../store';
import { selectCurrent } from '../store/selectors';

import type { MediaInfo } from '/@common/mediaInfo';

import ControlBar from './ControlBar';

type Props = {
  className?: string;
  playerId?: number;
};

const Player: React.FC<Props> = ({ className, playerId = 0 }) => {
  const { data: player } = usePlayer(playerId);
  const { data: playlist } = useGetPlaylistById(player?.playlistId);
  const { data: mediaData } = useGetMediaQuery();
  const { duration, position = 0, playbackState } = useSelector(selectCurrent);
  const { width = 320, height = 240 } = player ?? {};
  let current: MediaInfo | undefined;
  if (player && playlist?.items && mediaData) {
    const item = playlist.items[player.current % playlist.items.length];
    current = item && selectMediaById(mediaData, item.md5);
  }
  const pip = document.pictureInPictureElement; // useSelector(selectPiP);
  const stream = useMediaStream();
  const refVideo = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    const { current: video } = refVideo;
    if (video) {
      // console.log('UPDATE SRCOBJECT');
      video.srcObject = stream;
      video.played || video.play();
    }
  }, [stream]);
  const [show, setShow] = React.useState(false);
  // const [seeking, setSeeking] = React.useState(false);
  /*   React.useEffect(() => {
    const seekingHandler = () => setSeeking(true);
    const seekedHandler = () => setSeeking(false);
    video?.addEventListener('seeking', seekingHandler);
    video?.addEventListener('seeked', seekedHandler);
    return () => {
      video?.removeEventListener('seeked', seekedHandler);
      video?.removeEventListener('seeking', seekingHandler);
    };
  }, [video]); */
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
          ref={refVideo}
          autoPlay
          css={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: 'black',
          }}
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
