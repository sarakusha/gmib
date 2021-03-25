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

const CircularProgressWithLabel: React.FC<CircularProgressProps> = ({ value, size, ...props }) => (
  <Box position="relative" display="inline-flex">
    <CircularProgress {...props} value={value} size={size} />
    <Box
      top={0}
      left={0}
      bottom={0}
      right={0}
      position="absolute"
      display="flex"
      alignItems="center"
      justifyContent="center"
      fontSize={size}
    >
      <Typography component="div" color="inherit">
        {value !== undefined ? `${Math.round(value)}%` : undefined}
      </Typography>
    </Box>
  </Box>
);

export default React.memo(CircularProgressWithLabel);
