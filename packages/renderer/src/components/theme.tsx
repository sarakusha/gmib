
import type { Theme as MuiTheme} from '@mui/material/styles';
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

// defaultProps - не работает!
const theme = createTheme({
  components: {
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
