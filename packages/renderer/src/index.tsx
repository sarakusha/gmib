/* eslint-disable import/no-import-module-exports */
import { CssBaseline } from '@mui/material';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import debugFactory from 'debug';
import { SnackbarProvider } from 'notistack';
import React from 'react';
import ReactDOM from 'react-dom';
import 'typeface-roboto/index.css';
import { Provider } from 'react-redux';

import App from './components/App';
import theme from './components/theme';
import ToolbarProvider from './providers/ToolbarProvider';
import { store } from './store';

debugFactory.log = window.log;
import.meta.env.VITE_DEBUG && debugFactory.enable(import.meta.env.VITE_DEBUG);

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:app`);

window.setDispatch(store.dispatch.bind(store));

debug('Hello from APP');

ReactDOM.render(
  <React.StrictMode>
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <Provider store={store}>
        <ToolbarProvider>
          <SnackbarProvider
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            maxSnack={10}
            dense
            preventDuplicate
          >
            <App />
          </SnackbarProvider>
        </ToolbarProvider>
      </Provider>
    </MuiThemeProvider>
  </React.StrictMode>,
  document.getElementById('app'),
);
