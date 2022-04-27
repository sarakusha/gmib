/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import React from 'react';
import { Box, CircularProgress, IconButton, Tooltip } from '@mui/material';

export type BusyButtonProps = {
  title?: string;
  isBusy?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  icon: React.ReactNode;
  disabled?: boolean;
};

const BusyButton: React.FC<BusyButtonProps> = ({ title = '', onClick, disabled, isBusy, icon }) => (
  <Tooltip title={title} enterDelay={1000}>
    <Box position="relative">
      <IconButton color="inherit" onClick={onClick} disabled={disabled ?? isBusy} size="large">
        {icon}
      </IconButton>
      {isBusy && (
        <CircularProgress
          size={48}
          sx={{
            position: 'absolute',
            pointerEvents: 'none',
            top: 0,
            left: 0,
            zIndex: 1,
            color: 'secondary.light',
          }}
        />
      )}
    </Box>
  </Tooltip>
);

export default BusyButton;
