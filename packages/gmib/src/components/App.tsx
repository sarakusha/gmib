/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import AppBar from '@material-ui/core/AppBar';
import Divider from '@material-ui/core/Divider';
import Drawer from '@material-ui/core/Drawer';
import IconButton from '@material-ui/core/IconButton';
import List from '@material-ui/core/List';
import Toolbar from '@material-ui/core/Toolbar';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import CssBaseline from '@material-ui/core/CssBaseline';
import { makeStyles } from '@material-ui/core/styles';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import SearchIcon from '@material-ui/icons/Search';
import MenuIcon from '@material-ui/icons/Menu';
import classNames from 'classnames';
import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import some from 'lodash/some';
import DeviceListItems from './DeviceListItems';
import { useDevicesContext } from '../providers/DevicesProvier';
import GmibTabs from './GmibTabs';
import SearchDialog from '../dialogs/SearchDialog';
import { useToolbar } from '../providers/ToolbarProvider';
import TestItems from './TestItems';

const drawerWidth = 240;
// @ts-ignore
// const packagePromise = import('../../package.json');
// package  Promise.then(
//   json => console.log('JSON', json && json.version),
//   err => console.error('JSON', err.stack),
// );

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
  },
  toolbar: {
    paddingRight: 24, // keep right padding when drawer closed
  },
  toolbarIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '0 8px',
    ...theme.mixins.toolbar,
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  appBarShift: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  menuButton: {
    marginLeft: 12,
    marginRight: 36,
  },
  menuButtonHidden: {
    display: 'none',
  },
  title: {
    flexGrow: 1,
  },
  drawerPaper: {
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
  },
  drawerPaperClose: {
    overflowX: 'hidden',
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: theme.spacing(7),
    [theme.breakpoints.up('sm')]: {
      width: theme.spacing(9),
    },
  },
  drawerContent: {
    flex: 1,
    overflow: 'auto',
  },
  appBarSpacer: {
    ...theme.mixins.toolbar,
    flex: '0 0 auto',
  },
  content: {
    flexGrow: 1,
    padding: 0, // theme.spacing.unit * 2,
    height: '100vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    // position: 'relative',
  },
  gmib: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    position: 'relative',
  },
  chartContainer: {
    marginLeft: -22,
  },
  tableContainer: {
    height: 320,
  },
  h5: {
    marginBottom: theme.spacing(2),
  },
}));

const App: React.FC = () => {
  const classes = useStyles();
  const [open, setOpen] = useState(true);
  const handleDrawerOpen = useCallback(() => setOpen(true), []);
  const handleDrawerClose = useCallback(() => setOpen(false), []);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const searchOpen = useCallback(() => setSearchOpen(true), [setSearchOpen]);
  const searchClose = useCallback(() => setSearchOpen(false), [setSearchOpen]);
  const [link, setLink] = useState(false);
  const { devices } = useDevicesContext();
  useEffect(
    () => {
      setLink(some(devices, device => device.connection
        && device.connection.description && device.connection.description.link));
    },
    [devices, setLink],
  );
  // const { current } = useDevicesContext();
  const [toolbar] = useToolbar();
  // eslint-disable-next-line global-require
  const version = useMemo(() => require('../../package.json').version, []);
  // console.log('RENDER APP');
  return (
    <div className={classes.root}>

      <CssBaseline />
      <AppBar
        position="absolute"
        className={classNames(classes.appBar, open && classes.appBarShift)}
        elevation={0}
      >
        <Toolbar disableGutters={!open} className={classes.toolbar}>
          <IconButton
            color="inherit"
            aria-label="Open drawer"
            onClick={handleDrawerOpen}
            className={classNames(
              classes.menuButton,
              open && classes.menuButtonHidden,
            )}
          >
            <MenuIcon />
          </IconButton>
          <div className={classes.title}>
            <Typography
              component="h1"
              variant="h6"
              color="inherit"
              noWrap
              display="inline"
            >
              gMIB
            </Typography>
            &nbsp;
            <Typography
              component="h1"
              variant="subtitle1"
              color="inherit"
              display="inline"
            >
              {`${version} modules: ${process.versions.modules}`}
            </Typography>
          </div>
          {toolbar}
          <Tooltip title="Поиск новых устройств" enterDelay={500}>
            <div>
              <IconButton color="inherit" onClick={searchOpen} disabled={!link}>
                <SearchIcon />
              </IconButton>
            </div>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        classes={{
          paper: classNames(classes.drawerPaper, !open && classes.drawerPaperClose),
        }}
        open={open}
      >
        <div className={classes.toolbarIcon}>
          <IconButton onClick={handleDrawerClose}>
            <ChevronLeftIcon />
          </IconButton>
        </div>
        <Divider />
        <div className={classes.drawerContent}>
          <List><DeviceListItems /></List>
          <Divider />
          <List><TestItems /></List>
          <Divider />
        </div>
      </Drawer>
      <main className={classes.content}>
        <div className={classes.appBarSpacer} />
        <div className={classes.gmib}>
          <GmibTabs />
        </div>
      </main>
      <SearchDialog open={isSearchOpen} close={searchClose} />
    </div>
  );
};

// export const pipe = <T extends any[], R>(
//   fn1: (...args: T) => R,
//   ...fns: ((a: R) => R)[]
// ) => {
//   const piped = fns.reduce(
//     (prevFn, nextFn) => (value: R) => nextFn(prevFn(value)),
//     value => value,
//   );
//   return (...args: T) => piped(fn1(...args));
// };

export default compose(
  hot,
  React.memo,
)(App);
