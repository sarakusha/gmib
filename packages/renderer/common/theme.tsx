import type { Theme as MuiTheme } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';

// declare module '@mui/styles/defaultTheme' {
//   interface DefaultTheme extends MuiTheme {}
// }

declare module '@emotion/react' {
  interface Theme extends MuiTheme {
    test: 1;
  }
}

// declare module '@mui/private-theming' {
//   interface DefaultTheme extends MuiTheme {}
// }
declare module '@mui/material/styles' {
  interface Palette {
    active: Palette['primary'];
  }
  interface PaletteOptions {
    active: PaletteOptions['primary'];
  }
}
// defaultProps - не работает!
const theme = createTheme({
  palette: {
    active: {
      main: '#fff',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        html, body, div#app {
          height: 100%;
        }
      `,
    },
    MuiTextField: {
      defaultProps: {
        variant: 'standard',
      },
    },
    MuiSelect: {
      defaultProps: {
        variant: 'standard',
      },
    },
    MuiFormControl: {
      defaultProps: {
        variant: 'standard',
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          lineHeight: 1.75,
          minWidth: 160,
        },
      },
    },
  },
});

export default theme;
