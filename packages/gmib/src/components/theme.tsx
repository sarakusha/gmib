/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Theme as MuiTheme, createTheme } from '@mui/material/styles';

// declare module '@mui/styles/defaultTheme' {
//   interface DefaultTheme extends MuiTheme {}
// }

declare module '@emotion/react' {
  interface Theme extends MuiTheme {}
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
