import { GenerateClassName, SheetsRegistry } from 'jss';
import { createGenerateClassName, createMuiTheme, Theme } from '@material-ui/core/styles';

export interface IPageContext {
  theme: Theme;
  sheetsManager: Map<any, any>;
  sheetsRegistry: SheetsRegistry;
  generateClassName: GenerateClassName;
}

const createPageContext = (): IPageContext => {
// @ts-ignore
  return ({
    theme: createMuiTheme({
      typography: {
        useNextVariants: true,
      },
      overrides: {
        MuiCssBaseline: {
          '@global': {
            body: {
              backgroundColor: undefined,
            },
          },
        },
      },
    }),
    sheetsManager: new Map(),
    sheetsRegistry: new SheetsRegistry(),
    generateClassName: createGenerateClassName(),
  });
};

let pageContext: IPageContext;

export default function getPageContext() {
  // Make sure to create a new context for every server-side request so that data
  // isn't shared between connections (which would be bad).
  // @ts-ignore
  if (!process.browser) {
    return createPageContext();
  }

  // Reuse context on the client-side.
  if (!pageContext) {
    pageContext = createPageContext();
  }

  return pageContext;
}
