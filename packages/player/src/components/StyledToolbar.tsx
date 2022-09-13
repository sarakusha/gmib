import { Toolbar } from '@mui/material';
import React from 'react';

const StyledToolbar: React.FC<React.PropsWithChildren> = ({ children }) => (
  <Toolbar
    disableGutters
    variant="dense"
    sx={{
      backgroundColor: 'primary.main',
      color: 'common.white',
      mb: 1,
      borderRadius: 1,
      gap: 1,
      px: 0.5,
    }}
  >
    {children}
  </Toolbar>
);

export default StyledToolbar;
