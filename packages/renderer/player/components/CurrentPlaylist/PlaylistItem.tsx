import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import ReplayIcon from '@mui/icons-material/Replay';
import { IconButton, ListItemButton, Radio, Stack, Typography } from '@mui/material';
import FormControlLabel from '@mui/material/FormControlLabel';
import { useRadioGroup } from '@mui/material/RadioGroup';
import * as React from 'react';

import type { MediaInfo } from '/@common/mediaInfo';
import type { PlaybackIssue } from '/@common/playback';

import { playerPlay } from '../../api/updatePlayer';
import { useDispatch, useSelector } from '../../store';
import { selectDuration, selectPlaybackState } from '../../store/selectors';
import Numbered from '../Numbered';
import { playbackIssueText } from '../../playback/playbackStore';

type Props = {
  index: number;
  value: string;
  media: MediaInfo;
  playbackIssue?: PlaybackIssue;
  onRetryPlayback?: (mediaId: string) => void;
};

const PlaylistItem: React.FC<Props> = ({ value, media, index, playbackIssue, onRetryPlayback }) => {
  const radioGroup = useRadioGroup();
  const current = radioGroup?.value;
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
        label={
          <Stack sx={{ minWidth: 0 }}>
            <Numbered index={index} text={media.filename} />
            {playbackIssue && (
              <Typography variant="caption" color="error" noWrap>
                {playbackIssueText(playbackIssue)}
              </Typography>
            )}
          </Stack>
        }
        onClick={e => {
          if (!e.shiftKey && !e.altKey && !e.ctrlKey) dispatch(playerPlay());
        }}
        control={<Radio sx={{ p: 0.5 }} checkedIcon={paused ? pausedIcon : <PlayCircleIcon />} />}
      />
      {playbackIssue && onRetryPlayback && (
        <IconButton
          size="small"
          color="error"
          aria-label={`Повторить воспроизведение ${media.filename}`}
          title="Повторить воспроизведение"
          onMouseDown={event => event.stopPropagation()}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            onRetryPlayback(media.md5);
          }}
        >
          <ReplayIcon fontSize="inherit" />
        </IconButton>
      )}
    </ListItemButton>
  );
};

export default PlaylistItem;
