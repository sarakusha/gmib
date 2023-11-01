import { Box, CssBaseline } from '@mui/material';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import dayjs from 'dayjs';
import Duration from 'dayjs/plugin/duration';
import 'dayjs/locale/ru';
import debugFactory from 'debug';
import { SnackbarProvider } from 'notistack';
import React from 'react';
import { createRoot } from 'react-dom/client';
import 'typeface-roboto/index.css';
import { Provider } from 'react-redux';
import '../../preload/playerInMainWorld.d';
// import * as Sentry from '@sentry/electron/renderer';

import Html5DndProvider from '../common/Html5DndProvider';
import theme from '../common/theme';

import App from './components/App';
import store from './store';
import updatePlayer from './api/updatePlayer';
import { sourceId } from './utils';
import { isRemoteSession } from '/@common/remote';

debugFactory.log = window.log;
import.meta.env.VITE_DEBUG && debugFactory.enable(import.meta.env.VITE_DEBUG);

dayjs.extend(Duration);
dayjs.locale('ru');

const container = document.getElementById('app') as HTMLElement;
const root = createRoot(container);
// Sentry.init({ dsn: 'https://fbd4024789d247fcb5eb2493d1aa28b6@o1412889.ingest.sentry.io/6752393' });

window.setDispatch(store.dispatch.bind(store));
if (!isRemoteSession) {
  window.onUpdatePlaylist(() => {
    store.dispatch(updatePlayer(sourceId, player => player));
  });
}

// const Html5DndProvider = React.lazy(() => import('/@common/Html5DndProvider'));

root.render(
  <React.StrictMode>
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <Provider store={store}>
        <SnackbarProvider
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          maxSnack={10}
          dense
          preventDuplicate
        >
          <Html5DndProvider>
            <App />
            <Box id="videoContainer" sx={{ display: 'none' }} />
          </Html5DndProvider>
        </SnackbarProvider>
      </Provider>
    </MuiThemeProvider>
  </React.StrictMode>,
);
