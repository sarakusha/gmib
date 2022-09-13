import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import IconButton from '@mui/material/IconButton';
import * as React from 'react';

import { useDispatch, useSelector } from '../../store';
import { togglePlaybackState } from '../../store/currentSlice';
import { selectPlaybackState } from '../../store/selectors';

const PlayToggle: React.FC = () => {
  const dispatch = useDispatch();
  const playbackState = useSelector(selectPlaybackState);
  const paused = playbackState !== 'playing';
  const clickHandler = () => {
    dispatch(togglePlaybackState());
  };
  const icon = paused ? (
    <PlayArrowIcon color="inherit" fontSize="inherit" />
  ) : (
    <PauseIcon fontSize="inherit" />
  );
  const title = paused ? 'Play' : 'Pause';
  return (
    <IconButton onClick={clickHandler} size="small" color="inherit" title={title}>
      {icon}
    </IconButton>
  );
};

export default PlayToggle;
