/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import React from 'react';
import CircularProgress, { CircularProgressProps } from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';

type Props = CircularProgressProps & { value: number };
const CircularProgressWithLabel: React.FC<Props> = ({ value, ...props }) => (
  <Box position="relative" display="inline-flex">
    <CircularProgress {...props} value={value} />
    <Box
      top={0}
      left={0}
      bottom={0}
      right={0}
      position="absolute"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Typography variant="caption" component="div" color="inherit">
        {`${Math.round(value)}%`}
      </Typography>
    </Box>
  </Box>
);

export default CircularProgressWithLabel;
