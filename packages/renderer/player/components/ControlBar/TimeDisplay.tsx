import Typography from '@mui/material/Typography';
import * as React from 'react';

import { formatTime } from '../../utils';

type Props = {
  seconds?: number;
  guide?: number;
  prefix?: string;
  nogap?: boolean;
  className?: string;
};

const TimeDisplay: React.FC<Props> = ({
  seconds,
  guide,
  prefix = '',
  nogap = false,
  className,
}) => (
  <Typography
    className={className}
    noWrap
    variant="caption"
    sx={{ px: nogap ? 0 : 1, flex: '1 0 auto' }}
  >
    {prefix}
    {formatTime(seconds, guide)}
  </Typography>
);
export default TimeDisplay;
