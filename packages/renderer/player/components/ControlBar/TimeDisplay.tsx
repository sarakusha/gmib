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

const TimeDisplay: React.FC<Props> = ({ seconds, guide, prefix = '', nogap = false, className }) => (
  <Typography className={className} variant="caption" sx={{ px: nogap ? 0 : 1 }}>
    {prefix}
    {formatTime(seconds, guide)}
  </Typography>
);
export default TimeDisplay;
