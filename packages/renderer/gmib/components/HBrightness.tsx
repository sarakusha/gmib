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
  <Box display="flex" alignItems="center">
    <CircularProgressWithLabel variant="determinate" value={value} color="secondary" size="3rem" />
    <Box
      display="flex"
      flexDirection="row"
      height={1}
      alignItems="center"
      className={className}
      gap={1}
    >
      <RepeatButton
        size="small"
        onClick={e => value !== undefined && onChange?.(e, Math.max(value - 1, 0))}
        disabled={disabled || typeof value !== 'number'}
        color="inherit"
      >
        <Brightness4Icon fontSize="inherit" />
      </RepeatButton>
      <Slider
        sx={{ minWidth: '15ch' }}
        getAriaValueText={valuetext}
        min={0}
        max={100}
        value={value}
        onChange={onChange}
        disabled={disabled}
        {...props}
        color={'active1' as 'primary'}
        size="small"
      />
      <RepeatButton
        size="small"
        onClick={e => value !== undefined && onChange?.(e, Math.min(value + 1, 100))}
        disabled={disabled || typeof value !== 'number'}
        color="inherit"
      >
        <BrightnessHighIcon fontSize="inherit" />
      </RepeatButton>
    </Box>
  </Box>
);

export default Brightness;
