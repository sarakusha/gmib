import StopIcon from '@mui/icons-material/Stop';
import IconButton from '@mui/material/IconButton';
import * as React from 'react';

import { useDispatch } from '../../store';
import { setPlaybackState } from '../../store/currentSlice';

const Stop: React.FC = () => {
  const dispatch = useDispatch();
  return (
    <IconButton
      size="small"
      color="inherit"
      title="Stop"
      onClick={() => {
        dispatch(setPlaybackState('none'));
      }}
    >
      <StopIcon fontSize="inherit" />
    </IconButton>
  );
};

Stop.displayName = 'Stop';

export default Stop;
