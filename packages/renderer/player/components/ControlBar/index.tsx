import Stack from '@mui/material/Stack';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/system';
import React from 'react';

import NextTrack from './NextTrack';
import PictureInPicture from './PictureInPicture';
import PlayToggle from './PlayToggle';
import ProgressControl from './ProgressControl';
import Stop from './Stop';
import TimeDisplay from './TimeDisplay';

type Props = {
  duration?: number;
  position?: number;
  sx?: SxProps<Theme>;
  className?: string;
};

const ControlBar = React.forwardRef<HTMLDivElement, Props>(
  ({ duration, position = 0, sx, className }, ref) => (
    <Stack direction="row" spacing={1} alignItems="center" sx={sx} ref={ref} className={className}>
      <PlayToggle />
      <NextTrack />
      <Stop />
      <div>
        {/*
          <TimeDisplay seconds={position} guide={duration} nogap />
          /
          <TimeDisplay seconds={duration} nogap />
*/}
      </div>
      <ProgressControl duration={duration} position={position} />
      <TimeDisplay
        prefix={duration ? '-' : ''}
        seconds={duration ? Math.ceil(duration - position) : NaN}
      />
      <PictureInPicture />
    </Stack>
  ),
);

ControlBar.displayName = 'ControlBar';

export default ControlBar;
