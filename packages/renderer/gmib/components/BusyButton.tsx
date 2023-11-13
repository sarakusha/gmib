import { Box, CircularProgress, IconButton, Tooltip } from '@mui/material';
import React from 'react';

export type BusyButtonProps = {
  title?: string;
  isBusy?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  icon: React.ReactNode;
  disabled?: boolean;
  className?: string;
};

const BusyButton: React.FC<BusyButtonProps> = ({
  title = '',
  onClick,
  disabled,
  isBusy,
  icon,
  className,
}) => (
  <Tooltip title={title} enterDelay={1000}>
    <Box position="relative" className={className}>
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
