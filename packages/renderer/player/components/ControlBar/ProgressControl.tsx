import MuiSlider from '@mui/material/Slider';
import { styled } from '@mui/material/styles';
import * as React from 'react';

import { formatTime } from '../../utils';

type Props = {
  duration?: number;
  position?: number;
};

const Slider = styled(MuiSlider)({
  height: 4,
  color: 'inherit',
  '& .MuiSlider-thumb': {
    width: 8,
    height: 8,
    transition: '0.3s cubic-bezier(.47,1.64,.41,.8)',
    '&:before': {
      boxShadow: '0 2px 12px 0 rgba(0,0,0,0.4)',
    },
    '&:hover, &.Mui-focusVisible': {
      boxShadow: '0px 0px 0px 8px rgb(0 0 0 / 16%)',
    },
    '&.Mui-active': {
      width: 20,
      height: 20,
    },
  },
  '& .MuiSlider-rail': {
    opacity: 0.28,
  },
});

// eslint-disable-next-line arrow-body-style
const ProgressControl: React.FC<Props> = ({ duration, position }) => {
  // const { video } = useVideoSource();
  // const [value, setValue] = React.useState<number | null>(null);
  /*   React.useEffect(() => {
    const seeked = () => setValue(null);
    video?.addEventListener('seeked', seeked);
    return () => {
      video?.removeEventListener('seeked', seeked);
    };
  }, [video]); */
  // const changeHandler = React.useCallback((event: Event, pos: number | number[]) => {
  //   setValue(pos as number);
  // }, []);
  /*   const commitHandler = React.useCallback(
    (event: React.SyntheticEvent | Event, pos: number | number[]) => {
      if (video) video.currentTime = pos as number;
    },
    [video],
  ); */
  return (
    <Slider
      aria-label="time-indicator"
      size="small"
      value={/* value ?? */ Math.min(position ?? 0, duration ?? 0)}
      min={0}
      max={Math.max(duration ?? 0, 0.0001)}
      // step={1}
      // onChange={changeHandler}
      // onChangeCommitted={commitHandler}
      valueLabelDisplay="auto"
      valueLabelFormat={formatTime}
    />
  );
};

export default ProgressControl;
