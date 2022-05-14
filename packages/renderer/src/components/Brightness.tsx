
import Brightness4Icon from '@mui/icons-material/Brightness4';
import BrightnessHighIcon from '@mui/icons-material/BrightnessHigh';
import type { SliderProps } from '@mui/material';
import { Box, Slider } from '@mui/material';
import React from 'react';

import CircularProgressWithLabel from './CircularProgressWithLabel';
import RepeatButton from './RepeatButton';

const valuetext = (value: number): string => `${value}%`;

export type BrightnessProps = Omit<SliderProps, 'onChange'> & {
  value: number | undefined;
  onChange?: (event: unknown, value: number | number[]) => void;
};

const Brightness: React.FC<BrightnessProps> = ({
  className,
  value,
  onChange,
  disabled,
  ...props
}) => (
  <Box display="flex" alignItems="center" p={1}>
    <CircularProgressWithLabel
      variant="determinate"
      value={value}
      color="secondary"
      size="3.5rem"
    />
    <Box
      display="flex"
      flexDirection="column"
      height={1}
      alignItems="center"
      px={1}
      className={className}
    >
      <RepeatButton
        size="small"
        onClick={e => value !== undefined && onChange?.(e, Math.min(value + 1, 100))}
        disabled={disabled || typeof value !== 'number'}
      >
        <BrightnessHighIcon />
      </RepeatButton>
      <Box flexGrow={1} p={1}>
        <Slider
          orientation="vertical"
          getAriaValueText={valuetext}
          min={0}
          max={100}
          value={value}
          onChange={onChange}
          disabled={disabled}
          {...props}
        />
      </Box>
      <RepeatButton
        size="small"
        onClick={e => value !== undefined && onChange?.(e, Math.max(value - 1, 0))}
        disabled={disabled || typeof value !== 'number'}
      >
        <Brightness4Icon />
      </RepeatButton>
    </Box>
  </Box>
);

export default Brightness;
