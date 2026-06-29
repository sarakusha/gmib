import MuiSlider from '@mui/material/Slider';
import { styled } from '@mui/material/styles';
import * as React from 'react';

import { formatTime } from '../../utils';

type Props = {
  duration?: number;
  position?: number;
};

const SEEK_END_GUARD = 0.1;
const SEEK_SETTLE_TOLERANCE = 0.15;
const SEEK_SETTLE_TIMEOUT = 2000;

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
  const [value, setValue] = React.useState<number | null>(null);
  const pendingSeekRef = React.useRef<number | null>(null);
  const settleTimeoutRef = React.useRef<number | null>(null);
  const max = Math.max(duration ?? 0, 0.0001);
  const sliderValue = value ?? Math.min(position ?? 0, max);
  React.useEffect(
    () => () => {
      if (settleTimeoutRef.current !== null) window.clearTimeout(settleTimeoutRef.current);
    },
    [],
  );
  React.useEffect(() => {
    const pendingSeek = pendingSeekRef.current;
    if (pendingSeek === null || typeof position !== 'number') return;
    if (Math.abs(position - pendingSeek) > SEEK_SETTLE_TOLERANCE) return;
    pendingSeekRef.current = null;
    if (settleTimeoutRef.current !== null) {
      window.clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }
    setValue(null);
  }, [position]);
  const changeHandler = React.useCallback((_: Event, pos: number | number[]) => {
    pendingSeekRef.current = null;
    if (settleTimeoutRef.current !== null) {
      window.clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }
    setValue(Array.isArray(pos) ? pos[0] : pos);
  }, []);
  const commitHandler = React.useCallback(
    (_: React.SyntheticEvent | Event, pos: number | number[]) => {
      const nextPosition = Array.isArray(pos) ? pos[0] : pos;
      const seekPosition = duration
        ? Math.min(nextPosition, Math.max(0, duration - SEEK_END_GUARD))
        : nextPosition;
      pendingSeekRef.current = seekPosition;
      if (settleTimeoutRef.current !== null) window.clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = window.setTimeout(() => {
        pendingSeekRef.current = null;
        settleTimeoutRef.current = null;
        setValue(null);
      }, SEEK_SETTLE_TIMEOUT);
      setValue(seekPosition);
      window.mediaStream.seek?.(seekPosition);
    },
    [duration],
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
