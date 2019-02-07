import Head from 'next/head';
import React from 'react';
import App, { Container } from 'next/app';
import pick from 'lodash/pick';
// import Head from 'next/head';
import io from 'socket.io-client';
import { MuiThemeProvider } from '@material-ui/core/styles';
import CssBaseline from '@material-ui/core/CssBaseline';
import JssProvider from 'react-jss/lib/JssProvider';
import { StelaProps, PROPS } from '../src/stela';
import getPageContext from '../src/getPageContext';

export interface IStela extends StelaProps {
  update: (props: Partial<StelaProps>) => void;
  // bindSubmitForm: (submitForm: () => void) => void;
  // submittingChanged?: (isSubmitting: boolean) => void;
  // bindResetForm?: (resetForm: () => void) => void;
}

class StelaApp extends App<StelaProps> {
  state: StelaProps;
  socket = io();
  pageContext = getPageContext();

  static async getInitialProps({ ctx }) {
    const { req, query } = ctx;
    const isServer = !!req;
    return isServer ? query : {};
  }

  constructor(props) {
    super(props);
    this.state = {
      titleColor: '#7cb5ec',
      nameColor: '#fff',
      subColor: '#e7ba00',
      priceColor: '#fff',
      isBold: true,
      lineHeight: 1,
      items: [],
      ...props,
    };
  }

  handleChanged = (props: Partial<StelaProps>) => {
    this.setState(props);
  };

  update = (props: Partial<StelaProps>) => {
    this.socket.emit('update', pick(props, PROPS));
  };

  componentDidMount() {
    // connect to WS server and listen event
    this.socket.on('initial', this.handleChanged);
    this.socket.on('changed', this.handleChanged);
    // remove the server-side injected CSS
    const jssStyles = document.querySelector('#jss-sever-side');
    if (jssStyles && jssStyles.parentNode) {
      jssStyles.parentNode.removeChild(jssStyles);
    }
  }

  // close socket connection
  componentWillUnmount() {
    this.socket.off('changed', this.handleChanged);
    this.socket.off('initial', this.handleChanged);
    this.socket.close();
  }

  render() {
    const { Component } = this.props;
    const pageProps = this.state;
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
            />
          </MuiThemeProvider>
        </JssProvider>
      </Container>
    );
  }
}

export default StelaApp;
