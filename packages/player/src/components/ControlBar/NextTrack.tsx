import SkipNextIcon from '@mui/icons-material/SkipNext';
import IconButton from '@mui/material/IconButton';
import * as React from 'react';

import { playerNext } from '../../api/updatePlayer';
import { useDispatch } from '../../store';

const NextTrack: React.FC = () => {
  const dispatch = useDispatch();
  return (
    <IconButton
      onClick={() => dispatch(playerNext())}
      size="small"
      sx={{ mx: 1 }}
      color="inherit"
      title="Next"
    >
      <SkipNextIcon fontSize="inherit" />
    </IconButton>
  );
};

export default NextTrack;
