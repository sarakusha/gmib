import React from 'react';
import Document, { Head, Main, NextScript } from 'next/document';
import flush from 'styled-jsx/server';
import { IPageContext } from '../src/getPageContext';
import { IStela } from './_app';
import { resetServerContext } from 'react-beautiful-dnd';
const ubuntuFonts =
  'https://fonts.googleapis.com/css?family=Ubuntu+Condensed|Ubuntu:400,700&amp;subset=cyrillic';

class StelaDocument extends Document<{ pageContext: IPageContext } & IStela> {
  render() {
    const { pageContext } = this.props;

    return (
      <html lang="ru" dir="ltr">
      <Head>
        <meta charSet="utf-8" />
        {/* Use minimum-scale=1 to enable GPU rasterization */}
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no"
        />
        {/* PWA primary color */}
        <meta
          name="theme-color"
          content={pageContext ? pageContext.theme.palette.primary.main : null}
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css?family=Roboto:300,400,500"
        />
        <link
          href={ubuntuFonts}
          rel="stylesheet"
        />
        <link href="/static/stylesheet.css" rel="stylesheet" />
      </Head>
      <body>
      <Main />
      <NextScript />
      </body>
      </html>
    );
  }
}

StelaDocument.getInitialProps = async (ctx) => {
  resetServerContext();
  // Resolution order
  //
  // On the server:
  // 1. app.getInitialProps
  // 2. page.getInitialProps
  // 3. document.getInitialProps
  // 4. app.render
  // 5. page.render
  // 6. document.render
  //
  // On the server with error:
  // 1. document.getInitialProps
  // 2. app.render
  // 3. page.render
  // 4. document.render
  //
  // On the client
  // 1. app.getInitialProps
  // 2. page.getInitialProps
  // 3. app.render
  // 4. page.render

  // Render app and page and get the context of the page with collected side effects.
  let pageContext;
  const page = ctx.renderPage(Component => (props) => {
    pageContext = props.pageContext;
    return <Component {...props} />;
  });

  let css;
  // It might be undefined, e.g. after an error.
  if (pageContext) {
    css = pageContext.sheetsRegistry.toString();
  }

  return {
    ...page,
    pageContext,
    // Styles fragment is rendered after the app and page rendering finish.
    styles: [
      (
        <style
          id="jss-server-side"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: css }}
        />
      ),
      flush() || null,
    ],
  };
};

export default StelaDocument;
