import { Box } from '@mui/material';
import React from 'react';

import Main from './Main';

const App: React.FC = () => (
  <Box
    sx={{
      display: 'flex',
      width: 1,
      height: 1,
    }}
  >
    <Box minWidth={600} height={1} width={1}>
      <Main />
    </Box>
  </Box>
);

App.displayName = 'App';

export default App;
