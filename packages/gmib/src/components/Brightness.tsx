/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import Box from '@material-ui/core/Box';
import React from 'react';
import Slider, { SliderProps } from '@material-ui/core/Slider';
import BrightnessHighIcon from '@material-ui/icons/BrightnessHigh';
import Brightness4Icon from '@material-ui/icons/Brightness4';
import CircularProgressWithLabel from './CircularProgressWithLabel';

const valuetext = (value: number): string => `${value}%`;

export type BrightnessProps = Omit<SliderProps, 'onChange'> & {
  value: number | undefined;
  onChange?: (event: React.ChangeEvent, value: number) => void;
};

const Brightness: React.FC<BrightnessProps> = ({ className, value, ...props }) => (
  <Box display="flex" alignItems="center" p={1}>
    <CircularProgressWithLabel
      variant="determinate"
      value={value}
      color="secondary"
      size={'3.5rem'}
    />
    <Box
      display="flex"
      flexDirection="column"
      height={1}
      alignItems="center"
      px={1}
      className={className}
    >
      <BrightnessHighIcon opacity={0.6} />
      <Box flexGrow={1} p={1}>
        <Slider
          orientation="vertical"
          getAriaValueText={valuetext}
          min={0}
          max={100}
          value={value}
          {...props}
        />
      </Box>
      <Brightness4Icon opacity={0.6} />
    </Box>
  </Box>
);

export default React.memo(Brightness);
