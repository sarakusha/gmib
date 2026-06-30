import { Backdrop, Box } from '@mui/material';
import { useSnackbar } from 'notistack';
import React from 'react';

import { useSelector } from '../store';
import { selectFocused } from '../store/selectors';

import Main from './Main';

const App: React.FC = () => {
  const focused = useSelector(selectFocused);
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
        <Backdrop
          sx={{
            zIndex: theme => theme.zIndex.drawer + 20,
            color: '#fff',
          }}
          open={!focused}
        />
        <Main />
      </Box>
    </Box>
  );
};

App.displayName = 'App';

export default App;
