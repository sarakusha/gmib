import PictureInPictureAltIcon from '@mui/icons-material/PictureInPictureAlt';
import IconButton from '@mui/material/IconButton';
import * as React from 'react';

import { useSelector } from '../../store';
import { selectPiP } from '../../store/selectors';

const PictureInPicture: React.FC = () => {
  const pip = useSelector(selectPiP);
  const toggleHandler = React.useCallback(() => {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
      const video = document.querySelector('video#player') as HTMLVideoElement;
      video?.requestPictureInPicture();
    }
  }, []);
  return (
    <IconButton
      onClick={toggleHandler}
      size="small"
      sx={{ mx: 1, color: pip ? 'secondary.main' : 'inherit' }}
      title="Toggle PiP"
    >
      <PictureInPictureAltIcon fontSize="inherit" />
    </IconButton>
  );
};

export default PictureInPicture;
