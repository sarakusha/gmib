import Head from 'next/head';
import React from 'react';
import App, { Container, NextAppContext } from 'next/app';
import pick from 'lodash/pick';
import LoginDialog, { LoginProps, LoginResult } from '../components/LoginDialog';
import io from 'socket.io-client';
import { MuiThemeProvider } from '@material-ui/core/styles';
import CssBaseline from '@material-ui/core/CssBaseline';
import JssProvider from 'react-jss/lib/JssProvider';
import { StelaProps, PROPS } from '../src/stela';
import getPageContext from '../src/getPageContext';

export interface IStela extends StelaProps {
  update: (props: Partial<StelaProps>) => void;
  logout?: () => void;
}

// const sessionId = 'session';
// const getLocalSession = () => JSON.parse(localStorage.getItem(sessionId));
// const saveLocalSession = session => localStorage.setItem(sessionId, JSON.stringify(session));
// const removeLocalSession = () => localStorage.removeItem(sessionId);

const parseResponse = async (res: Response): Promise<LoginResult> => {
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.indexOf('application/json') !== -1) {
    return [res.ok, await res.json()];
  }
  return [res.ok, { message: await res.text() }];
};

type State = StelaProps & { username?: string | null };

class StelaApp extends App<{ session?: any, isNeedLogin?: boolean }, State> {
  socket: SocketIOClient.Socket | undefined;
  pageContext = getPageContext();
  needLogin = false;

  static async getInitialProps({ ctx, Component }: NextAppContext) {
    const { req, query } = ctx;
    let isNeedLogin = false;
    if (Component.getInitialProps) {
      const compProps = await Component.getInitialProps(ctx);
      isNeedLogin = compProps.isNeedLogin;
    }
    if (req) {
      // console.log('USER', req.session && req.session.passport && req.session.passport.user);
      // console.log('INITIAL SESSION', req.session);
      return {
        isNeedLogin,
        pageProps: query,
        session: (req as any).session,
      };
    }
    // const session = getLocalSession();
    // if (session && Object.keys(session).length > 0) {
    //   return {
    //     session,
    //     pageProps: {},
    //   };
    // }
    // TODO: fetch session & save local
    return { pageProps: {} };
  }

  constructor(props: any) {
    super(props);
    const { pageProps, session } = props;
    this.state = {
      titleColor: '#7cb5ec',
      nameColor: '#fff',
      subColor: '#e7ba00',
      priceColor: '#fff',
      isBold: true,
      lineHeight: 1,
      items: [],
      marginTop: 0,
      fontName: 'Ubuntu',
      ...pageProps,
      username: session && session.passport && session.passport.user,
    };
  }

  handleChanged = <K extends keyof State>(props: Pick<State, K>) => {
    this.setState(props);
  };

  update = (props: Partial<StelaProps>) => {
    this.socket!.emit('update', pick(props, PROPS));
  };

  handleSubmitLogin = (values: LoginProps): Promise<LoginResult> => {
    return Promise.resolve()
      .then(() => fetch('/login', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      }))
      .then(parseResponse, (): LoginResult => [false, { message: 'Server error' }])
      .then(
        (res: LoginResult) => {
          const [isOk, session] = res;
          if (isOk) {
            this.setState({ username: session && session.passport && session.passport.user });
            this.socket!.emit('reload');
          }
          return res;
        },
      );
  };

  logout = () => {
    fetch('/logout').then();
    this.handleLogout();
  };

  handleLogout = () => {
    this.setState({ username: null });
  };

  componentDidMount() {
    // this.socket = io();
    // this.socket = io({ transports: ['polling'] });
    this.socket = io({ transports: ['websocket'] });
    this.socket.on('reconnect_attempt', () => {
      console.log('RECONNECT');
      this.socket!.io.opts.transports = ['polling', 'websocket'];
    });
    // connect to WS server and listen event
    this.socket.on('initial', this.handleChanged);
    this.socket.on('changed', this.handleChanged);
    this.socket.on('logout', this.handleLogout);
    // remove the server-side injected CSS
    const jssStyles = document.querySelector('#jss-sever-side');
    if (jssStyles && jssStyles.parentNode) {
      jssStyles.parentNode.removeChild(jssStyles);
    }
  }

  // close socket connection
  componentWillUnmount() {
    this.socket!.off('logout', this.handleLogout);
    this.socket!.off('changed', this.handleChanged);
    this.socket!.off('initial', this.handleChanged);
    this.socket!.close();
  }

  render() {
    const { Component, isNeedLogin } = this.props;
    const { username, ...pageProps } = this.state;
    const isLoginOpen = !username;
    const { theme, generateClassName, sheetsManager, sheetsRegistry } = this.pageContext;
    return (
      <Container>
        <Head>
          <title>{pageProps.title || 'Стела'}</title>
        </Head>
        <JssProvider registry={sheetsRegistry} generateClassName={generateClassName}>
          <MuiThemeProvider theme={theme} sheetsManager={sheetsManager}>
            <CssBaseline />
            <Component
              {...pageProps}
              pageContext={this.pageContext}
              update={this.update}
              logout={this.logout}
            />
            {isNeedLogin &&
            <LoginDialog isOpen={isLoginOpen} onSubmit={this.handleSubmitLogin} />}
          </MuiThemeProvider>
        </JssProvider>
      </Container>
    );
  }
}

export default StelaApp;
