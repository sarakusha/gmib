import { Box } from '@mui/material';
import { useSnackbar } from 'notistack';
import React from 'react';

import Main from './Main';

const App: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  React.useEffect(() => {
    const handler = (event: Event) => {
      const { detail } = event as CustomEvent<{
        name?: string;
        status?: 'success' | 'error';
        message?: string;
      }>;
      if (!detail) return;
      enqueueSnackbar(detail.message ?? `Задание "${detail.name ?? ''}" выполнено`, {
        variant: detail.status === 'error' ? 'error' : 'success',
      });
    };
    window.addEventListener('player-scheduler', handler);
    return () => window.removeEventListener('player-scheduler', handler);
  }, [enqueueSnackbar]);
  return (
    <Box
      sx={{
        display: 'flex',
        width: 1,
        height: 1,
      }}
    >
      <Box
        sx={{
          minWidth: 600,
          height: 1,
          width: 1,
        }}
      >
        <Main />
      </Box>
    </Box>
  );
};

App.displayName = 'App';

export default App;
