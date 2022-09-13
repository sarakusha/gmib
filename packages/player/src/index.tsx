import { CssBaseline } from '@mui/material';
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

// import Html5DndProvider from '/@common/Html5DndProvider';
import theme from '/@common/theme';

import ToolbarProvider from '../../renderer/gmib/src/providers/ToolbarProvider';

import App from './components/App';
import { VideoProvider } from './hooks/useMediaStream';
import store from './store';

debugFactory.log = window.log;
import.meta.env.VITE_DEBUG && debugFactory.enable(import.meta.env.VITE_DEBUG);

dayjs.extend(Duration);
dayjs.locale('ru');

const container = document.getElementById('app') as HTMLElement;
const root = createRoot(container);

const Html5DndProvider = React.lazy(() => import('/@common/Html5DndProvider'));

root.render(
  <React.StrictMode>
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <Provider store={store}>
        <ToolbarProvider>
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
              <VideoProvider>
                <App />
              </VideoProvider>
            </Html5DndProvider>
          </SnackbarProvider>
        </ToolbarProvider>
      </Provider>
    </MuiThemeProvider>
  </React.StrictMode>,
);
