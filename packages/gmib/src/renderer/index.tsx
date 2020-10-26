/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

/* eslint-disable import/first */
process.env.DEBUG = 'nibus:*';

import { createMuiTheme, MuiThemeProvider } from '@material-ui/core/styles';
import React from 'react';
import ReactDOM from 'react-dom';
import 'typeface-roboto/index.css';
import { SnackbarProvider } from 'notistack';

import App from '../components/App';
import DevicesProvider from '../providers/DevicesProvier';
import DevicesStateProvider from '../providers/DevicesStateProvider';
import SessionProvider from '../providers/SessionProvider';
import TestsProvider from '../providers/TestProvider';
import ToolbarProvider from '../providers/ToolbarProvider';

const theme = createMuiTheme({});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).ELECTRON_DISABLE_SECURITY_WARNINGS = 1;

const render = (): void => {
  ReactDOM.render(
    <MuiThemeProvider theme={theme}>
      <SessionProvider>
        <DevicesProvider>
          <DevicesStateProvider>
            <ToolbarProvider>
              <TestsProvider>
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
              </TestsProvider>
            </ToolbarProvider>
          </DevicesStateProvider>
        </DevicesProvider>
      </SessionProvider>
    </MuiThemeProvider>,
    document.getElementById('app')
  );
};

render();

if (module.hot) {
  module.hot.accept('../components/App', () => {
    render();
  });
}

// ipcRenderer.on('message', (e, ...args) => {
//   console.info('INFO:', ...args);
// });
