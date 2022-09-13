import type { DrawerProps } from '@mui/material/Drawer';
import MuiDrawer from '@mui/material/Drawer';

import extendStyled from '../util/extendStyled';

type Props = DrawerProps & {
  drawerWidth: number;
};

const Drawer = extendStyled(MuiDrawer, { open: false, drawerWidth: 0 })<Props>(
  ({ theme, open, drawerWidth }) => ({
    '& .MuiDrawer-paper': {
      position: 'relative',
      whiteSpace: 'nowrap',
      height: '100vh',
      overflow: 'hidden',
      width: drawerWidth,
      display: 'flex',
      transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
      }),
      // boxSizing: 'border-box',
      ...(!open && {
        overflowX: 'hidden',
        transition: theme.transitions.create('width', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen,
        }),
        width: 0,
      }),
    },
  }),
);

export default Drawer;
