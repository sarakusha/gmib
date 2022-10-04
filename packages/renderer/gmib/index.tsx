import { CssBaseline } from '@mui/material';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import dayjs from 'dayjs';
import Duration from 'dayjs/plugin/duration';
import 'dayjs/locale/ru';
import debugFactory from 'debug';
import { SnackbarProvider } from 'notistack';
import React from 'react';
// import { DndProvider } from 'react-dnd';
// import { HTML5Backend } from 'react-dnd-html5-backend';
import { createRoot } from 'react-dom/client';
import 'typeface-roboto/index.css';
import { Provider } from 'react-redux';
// import * as Sentry from '@sentry/electron/renderer';

import theme from '/@common/theme';

import App from './components/App';
import ToolbarProvider from './providers/ToolbarProvider';
import { store } from './store';
import LoginDialog from './dialogs/LoginDialog';

debugFactory.log = window.log;
import.meta.env.VITE_DEBUG && debugFactory.enable(import.meta.env.VITE_DEBUG);

dayjs.extend(Duration);
dayjs.locale('ru');

// Sentry.init({ dsn: 'https://fbd4024789d247fcb5eb2493d1aa28b6@o1412889.ingest.sentry.io/6752393' });

window.setDispatch(store.dispatch.bind(store));

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
              <App />
              <LoginDialog />
            </Html5DndProvider>
          </SnackbarProvider>
        </ToolbarProvider>
      </Provider>
    </MuiThemeProvider>
  </React.StrictMode>,
);
