/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

// import { AppContainer } from 'react-hot-loader';
import { createMuiTheme, MuiThemeProvider } from '@material-ui/core/styles';
import React from 'react';
import ReactDOM from 'react-dom';
import 'typeface-roboto/index.css';
import { makeStyles } from '@material-ui/core/styles';

import App from '../components/App';
import DevicesProvider from '../providers/DevicesProvier';
import DevicesStateProvider from '../providers/DevicesStateProvider';
import SessionProvider from '../providers/SessionProvider';
import TestsProvider from '../providers/TestProvider';
import ToolbarProvider from '../providers/ToolbarProvider';

const theme = createMuiTheme({});

console.log('REACT', (window as any).React1 === React);

const useStyles = makeStyles({
  test: {
    backgroundColor: 'red',
  },
});

const Test: React.FC = () => {
  const classes = useStyles();
  return <div className={classes.test}>Hello</div>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).ELECTRON_DISABLE_SECURITY_WARNINGS = 1;

const render = (): void => {
  ReactDOM.render(
    <App />
    /*
    (
        <MuiThemeProvider theme={theme}>
          <SessionProvider>
            <DevicesProvider>
              <DevicesStateProvider>
                <ToolbarProvider>
                  <TestsProvider>
                    <App />
                  </TestsProvider>
                </ToolbarProvider>
              </DevicesStateProvider>
            </DevicesProvider>
          </SessionProvider>
        </MuiThemeProvider>
    )
    */,
    document.getElementById('app'),
  );
};

render();

// if (module.hot) {
//   module.hot.accept('../components/App', () => { render(); });
// }
