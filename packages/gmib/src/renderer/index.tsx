/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

// Не удалять, если нужны логи в production
/* eslint-disable import/first,import/no-import-module-exports */
process.env.NIBUS_LOG = 'nibus-all.log';

window.localStorage.debug = process.env.DEBUG;

import { createTheme, MuiThemeProvider } from '@material-ui/core/styles';
import { CssBaseline } from '@material-ui/core';
import React from 'react';
import ReactDOM from 'react-dom';
import 'typeface-roboto/index.css';
import { SnackbarProvider } from 'notistack';
import { Provider } from 'react-redux';

import App from '../components/App';
import ToolbarProvider from '../providers/ToolbarProvider';
import { store } from '../store';

const theme = createTheme({});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).ELECTRON_DISABLE_SECURITY_WARNINGS = 1;

const render = (): void => {
  ReactDOM.render(
    <>
      <CssBaseline />
      <Provider store={store}>
        <MuiThemeProvider theme={theme}>
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
        </MuiThemeProvider>
      </Provider>
    </>,
    document.getElementById('app')
  );
};

render();

if (module.hot) {
  module.hot.accept('../components/App', () => {
    render();
  });
}
