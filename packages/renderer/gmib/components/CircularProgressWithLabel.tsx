import type { CircularProgressProps } from '@mui/material';
import { Box, CircularProgress, Typography } from '@mui/material';
import React from 'react';

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
