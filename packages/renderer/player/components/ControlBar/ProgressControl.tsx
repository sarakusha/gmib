import MuiSlider from '@mui/material/Slider';
import { styled } from '@mui/material/styles';
import * as React from 'react';

import { useDispatch } from '../../store';
import { setPosition } from '../../store/currentSlice';
import { formatTime } from '../../utils';

type Props = {
  duration?: number;
  position?: number;
};

const SEEK_END_GUARD = 0.1;

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

const ProgressControl: React.FC<Props> = ({ duration, position }) => {
  const dispatch = useDispatch();
  const [value, setValue] = React.useState<number | null>(null);
  const max = Math.max(duration ?? 0, 0.0001);
  const sliderValue = value ?? Math.min(position ?? 0, max);
  const changeHandler = React.useCallback((_: Event, pos: number | number[]) => {
    setValue(Array.isArray(pos) ? pos[0] : pos);
  }, []);
  const commitHandler = React.useCallback(
    (_: React.SyntheticEvent | Event, pos: number | number[]) => {
      const nextPosition = Array.isArray(pos) ? pos[0] : pos;
      const seekPosition = duration
        ? Math.min(nextPosition, Math.max(0, duration - SEEK_END_GUARD))
        : nextPosition;
      setValue(null);
      window.mediaStream.seek?.(seekPosition);
      dispatch(setPosition(seekPosition));
    },
    [dispatch, duration],
  );
  return (
    <Slider
      aria-label="time-indicator"
      size="small"
      value={sliderValue}
      min={0}
      max={max}
      disabled={!duration}
      onChange={changeHandler}
      onChangeCommitted={commitHandler}
      valueLabelDisplay="auto"
      valueLabelFormat={formatTime}
    />
  );
};

export default ProgressControl;
