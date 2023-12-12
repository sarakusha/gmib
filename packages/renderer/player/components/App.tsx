import { Backdrop, Box } from '@mui/material';
import React from 'react';

import Main from './Main';
import { useSelector } from '../store';
import { selectFocused } from '../store/selectors';

const App: React.FC = () => {
  const focused = useSelector(selectFocused);
  return (
    <Box
      sx={{
        display: 'flex',
        width: 1,
        height: 1,
      }}
    >
      <Box minWidth={600} height={1} width={1}>
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
