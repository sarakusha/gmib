import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import React, { type ReactNode } from 'react';

const TaurusOperationDialog: React.FC<{
  open: boolean;
  title: string;
  progress?: number;
  children?: ReactNode;
}> = ({ open, title, progress, children }) => {
  const determinate = progress !== undefined && Number.isFinite(progress);
  const value = determinate ? Math.min(100, Math.max(0, progress)) : undefined;

  return (
    <Dialog open={open} maxWidth="xs" fullWidth aria-labelledby="operation-title">
      <DialogTitle id="operation-title">{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ py: 1, alignItems: 'center' }}>
          {determinate ? (
            <Box sx={{ width: '100%' }}>
              <LinearProgress variant="determinate" value={value} />
            </Box>
          ) : (
            <CircularProgress size={48} />
          )}
          {children != null ? (
            <Typography variant="body2" align="center">
              {children}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default TaurusOperationDialog;
