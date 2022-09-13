import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { ListItemButton, Radio } from '@mui/material';
import FormControlLabel from '@mui/material/FormControlLabel';
import { useRadioGroup } from '@mui/material/RadioGroup';
import * as React from 'react';

import type { MediaInfo } from '/@common/mediaInfo';

import { playerPlay } from '../../api/updatePlayer';
import { useDispatch, useSelector } from '../../store';
import { selectDuration, selectPlaybackState } from '../../store/selectors';
import Numbered from '../Numbered';

type Props = {
  value: number;
  media: MediaInfo;
};

const PlaylistItem: React.FC<Props> = ({ value, media }) => {
  const radioGroup = useRadioGroup();
  const current: number = radioGroup?.value ?? 0;
  const paused = useSelector(selectPlaybackState) !== 'playing';
  const duration = useSelector(selectDuration);
  const pausedIcon = duration ? <PauseCircleIcon /> : <StopCircleIcon />;
  const dispatch = useDispatch();
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (current === value && ref.current)
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [current, value]);
  return (
    <ListItemButton dense selected={value === current} ref={ref}>
      <FormControlLabel
        sx={{ width: 1 }}
        disableTypography
        value={value}
        label={<Numbered index={value + 1} text={media.filename} />}
        onClick={e => {
          if (!e.shiftKey && !e.altKey && !e.ctrlKey) dispatch(playerPlay());
        }}
        control={<Radio sx={{ p: 0.5 }} checkedIcon={paused ? pausedIcon : <PlayCircleIcon />} />}
      />
    </ListItemButton>
  );
};

export default PlaylistItem;
