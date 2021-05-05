/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { makeStyles } from '@material-ui/core/styles';
import {
  List,
  ListItem,
  ListItemText,
  AppBar,
  Divider,
  Drawer,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
  Backdrop,
  ListItemSecondaryAction,
  Switch,
} from '@material-ui/core';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import SearchIcon from '@material-ui/icons/Search';
import MenuIcon from '@material-ui/icons/Menu';
import classNames from 'classnames';
import { ipcRenderer } from 'electron';
import React, { useCallback, useEffect, useState } from 'react';
import some from 'lodash/some';
import SettingsEthernetIcon from '@material-ui/icons/SettingsEthernet';
import HighlightOffIcon from '@material-ui/icons/HighlightOff';
import RemoteHostsDialog from '../dialogs/RemoteHostsDialog';
import { useDevices, useDispatch, useSelector } from '../store';
import { selectAutobrightness, selectLoading, setAutobrightness } from '../store/configSlice';
import { selectCurrentTab, setCurrentTab } from '../store/currentSlice';
import { selectIsClosed, selectIsOnline } from '../store/sessionSlice';
import Devices from './Devices';
import GmibTabs from './GmibTabs';
import SearchDialog from '../dialogs/SearchDialog';
import { useToolbar } from '../providers/ToolbarProvider';
import HttpPages from './HttpPages';
import { version } from '../util/helpers';

const drawerWidth = 240;

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    width: '100%',
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
  hidden: {
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
    width: 0,
    // [theme.breakpoints.up('sm')]: {
    //   width: theme.spacing(9),
    // },
  },
  drawerContent: {
    flex: 1,
    overflow: 'auto',
    padding: 0,
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
    width: '100%',
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
  listItem: {
    minHeight: 56,
    borderStyle: 'solid',
    borderColor: theme.palette.divider,
    borderBottomWidth: 'thin',
  },
  backdrop: {
    zIndex: theme.zIndex.drawer + 10,
    color: '#fff',
  },
  blink: {
    animation: '$blink-animation normal 1.5s infinite ease-in-out',
  },
  '@keyframes blink-animation': {
    '50%': {
      opacity: 0,
    },
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
  const [isLinkingDevice, setLinkingDevice] = useState(false);
  const devices = useDevices();
  const autobrightness = useSelector(selectAutobrightness);
  useEffect(() => {
    setLinkingDevice(some(devices, device => !!device?.isLinkingDevice));
  }, [devices]);
  const [toolbar] = useToolbar();
  const dispatch = useDispatch();
  const tab = useSelector(selectCurrentTab);
  const online = useSelector(selectIsOnline);
  const loading = useSelector(selectLoading);
  const sessionClosed = useSelector(selectIsClosed);
  const [remoteDialogOpen, setRemoteDialogOpen] = useState(false);
  useEffect(() => {
    const openRemoteDialog = (): void => setRemoteDialogOpen(true);
    ipcRenderer.on('editRemoteHosts', openRemoteDialog);
    return () => {
      ipcRenderer.off('editRemoteHosts', openRemoteDialog);
    };
  }, []);
  const closeRemoteDialog = (): void => setRemoteDialogOpen(false);
  return (
    <>
      <Backdrop className={classes.backdrop} open={!online || loading}>
        {sessionClosed ? (
          <HighlightOffIcon fontSize="large" />
        ) : (
          <SettingsEthernetIcon className={classes.blink} fontSize="large" />
        )}
      </Backdrop>
      <RemoteHostsDialog open={remoteDialogOpen} onClose={closeRemoteDialog} />
      <div className={classes.root}>
        <AppBar
          position="absolute"
          className={classNames(classes.appBar, open && classes.appBarShift)}
          elevation={0}
          color="primary"
        >
          <Toolbar disableGutters={!open} className={classes.toolbar}>
            <IconButton
              color="inherit"
              aria-label="Open drawer"
              onClick={handleDrawerOpen}
              className={classNames(classes.menuButton, open && classes.hidden)}
            >
              <MenuIcon />
            </IconButton>
            <div className={classes.title}>
              <Typography component="h1" variant="h6" color="inherit" noWrap display="inline">
                gmib
              </Typography>
              &nbsp;
              <Typography component="h1" variant="subtitle1" color="inherit" display="inline">
                {`${version} [${process.versions.modules}]`}
              </Typography>
            </div>
            {toolbar}
            <Tooltip title="Поиск новых устройств" enterDelay={500}>
              <div>
                <IconButton
                  color="inherit"
                  onClick={searchOpen}
                  disabled={!isLinkingDevice}
                  hidden={tab !== 'devices'}
                  className={classNames({ [classes.hidden]: tab !== 'devices' })}
                >
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
          <List className={classes.drawerContent}>
            <Devices />
            <HttpPages />
            <ListItem
              button
              onClick={() => dispatch(setCurrentTab('autobrightness'))}
              selected={tab === 'autobrightness'}
              className={classes.listItem}
            >
              <ListItemText id="switch-autobrightness">Автояркость</ListItemText>
              <ListItemSecondaryAction>
                <Switch
                  edge="end"
                  onChange={() => dispatch(setAutobrightness(!autobrightness))}
                  checked={autobrightness}
                  // onChange={handleToggle('wifi')}
                  // checked={checked.indexOf('wifi') !== -1}
                  inputProps={{ 'aria-labelledby': 'switch-autobrightness' }}
                />
              </ListItemSecondaryAction>
            </ListItem>
            <ListItem
              button
              onClick={() => dispatch(setCurrentTab('log'))}
              selected={tab === 'log'}
              className={classes.listItem}
            >
              <ListItemText>Журнал</ListItemText>
            </ListItem>
          </List>
        </Drawer>
        <main className={classes.content}>
          <div className={classes.appBarSpacer} />
          <div className={classes.gmib}>
            <GmibTabs />
          </div>
        </main>
        <SearchDialog open={isSearchOpen} close={searchClose} />
      </div>
    </>
  );
};

export default App;
