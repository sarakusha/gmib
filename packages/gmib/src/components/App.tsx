/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import {
  Backdrop,
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemSecondaryAction,
  ListItemText,
  Switch,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { keyframes, styled } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import SearchIcon from '@mui/icons-material/Search';
import MenuIcon from '@mui/icons-material/Menu';
import { ipcRenderer } from 'electron';
import React, { useCallback, useEffect, useState } from 'react';
import some from 'lodash/some';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import nata from '../extraResources/nata.svg';
import RemoteHostsDialog from '../dialogs/RemoteHostsDialog';
import { useDevices, useDispatch, useSelector } from '../store';
import {
  selectAutobrightness,
  selectLoading,
  selectOverheatProtection,
  setAutobrightness,
  setProtectionProp,
} from '../store/configSlice';
import { selectCurrentTab, setCurrentTab } from '../store/currentSlice';
import { selectIsClosed, selectIsOnline } from '../store/sessionSlice';
import Devices from './Devices';
import GmibTabs from './GmibTabs';
import SearchDialog from '../dialogs/SearchDialog';
import { useToolbar } from '../providers/ToolbarProvider';
import HttpPages from './HttpPages';
import { version } from '../util/helpers';
import AppBar from './AppBar';
import Drawer from './Drawer';

const drawerWidth = 240;

const blink = keyframes`
  50% {
    opacity: 0;
  }
`;

const Item = styled(ListItemButton)(({ theme }) => ({
  minHeight: 56,
  borderStyle: 'solid',
  borderColor: theme.palette.divider,
  borderBottomWidth: 'thin',
}));

// const useStyles = makeStyles(theme => ({
// root: {
//   display: 'flex',
//   width: '100%',
// },
// toolbar: {
//   paddingRight: 24, // keep right padding when drawer closed
// },
// toolbarIcon: {
//   display: 'flex',
//   alignItems: 'center',
//   justifyContent: 'flex-end',
//   padding: '0 8px',
//   gap: theme.spacing(1),
//   ...theme.mixins.toolbar,
// },
// appBar: {
//   zIndex: theme.zIndex.drawer + 1,
//   transition: theme.transitions.create(['width', 'margin'], {
//     easing: theme.transitions.easing.sharp,
//     duration: theme.transitions.duration.leavingScreen,
//   }),
// },
// appBarShift: {
//   marginLeft: drawerWidth,
//   width: `calc(100% - ${drawerWidth}px)`,
//   transition: theme.transitions.create(['width', 'margin'], {
//     easing: theme.transitions.easing.sharp,
//     duration: theme.transitions.duration.enteringScreen,
//   }),
// },
// menuButton: {
//   marginLeft: 12,
//   marginRight: 36,
// },
// hidden: {
//   display: 'none',
// },
// title: {
//   flexGrow: 1,
//   display: 'flex',
//   alignItems: 'flex-end',
//   whiteSpace: 'nowrap',
// },
// drawerPaper: {
//   position: 'relative',
//   whiteSpace: 'nowrap',
//   height: '100vh',
//   overflow: 'hidden',
//   width: drawerWidth,
//   display: 'flex',
//   transition: theme.transitions.create('width', {
//     easing: theme.transitions.easing.sharp,
//     duration: theme.transitions.duration.enteringScreen,
//   }),
// },
// drawerPaperClose: {
//   overflowX: 'hidden',
//   transition: theme.transitions.create('width', {
//     easing: theme.transitions.easing.sharp,
//     duration: theme.transitions.duration.leavingScreen,
//   }),
//   width: 0,
// },
// drawerContent: {
//   flex: 1,
//   overflow: 'auto',
//   padding: 0,
// },
// appBarSpacer: {
//   ...theme.mixins.toolbar,
//   flex: '0 0 auto',
// },
// content: {
//   flexGrow: 1,
//   padding: 0, // theme.spacing.unit * 2,
//   height: '100vh',
//   overflow: 'hidden',
//   display: 'flex',
//   flexDirection: 'column',
//   width: '100%',
//   // position: 'relative',
// },
// gmib: {
//   flex: 1,
//   overflow: 'hidden',
//   display: 'flex',
//   position: 'relative',
// },
// chartContainer: {
//   marginLeft: -22,
// },
// tableContainer: {
//   height: 320,
// },
// h5: {
//   marginBottom: theme.spacing(2),
// },
// listItem: {
//   minHeight: 56,
//   borderStyle: 'solid',
//   borderColor: theme.palette.divider,
//   borderBottomWidth: 'thin',
// },
// backdrop: {
//   zIndex: theme.zIndex.drawer + 10,
//   color: '#fff',
// },
// blink: {
//   animation: '$blink-animation normal 1.5s infinite ease-in-out',
// },
// '@keyframes blink-animation': {
//   '50%': {
//     opacity: 0,
//   },
// },
// nata: {
//   height: 42,
// },
// }));

const Offset = styled('div')(({ theme }) => theme.mixins.toolbar);

const App: React.FC = () => {
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
  const { enabled: protectionEnabled = false } = useSelector(selectOverheatProtection) ?? {};
  return (
    <>
      <Backdrop
        sx={{
          zIndex: theme => theme.zIndex.drawer + 10,
          color: '#fff',
        }}
        open={!online || loading}
      >
        {sessionClosed ? (
          <HighlightOffIcon fontSize="large" />
        ) : (
          <SettingsEthernetIcon
            sx={{ animation: `${blink} normal 1.5s infinite ease-in-out` }}
            fontSize="large"
          />
        )}
      </Backdrop>
      <RemoteHostsDialog open={remoteDialogOpen} onClose={closeRemoteDialog} />
      <Box
        sx={{
          display: 'flex',
          width: 1,
        }}
      >
        <AppBar
          position="absolute"
          open={open}
          drawerWidth={drawerWidth}
          elevation={0}
          color="primary"
        >
          <Toolbar disableGutters={!open} sx={{ pr: open ? 0 : 3 }}>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="Open drawer"
              onClick={handleDrawerOpen}
              sx={{
                flexGrow: 0,
                marginLeft: '12px',
                marginRight: '36px',
                ...(open && { display: 'none' }),
              }}
              size="large"
            >
              <MenuIcon />
            </IconButton>
            <Box
              sx={{
                flexGrow: 1,
                display: 'flex',
                alignItems: 'flex-end',
                whiteSpace: 'nowrap',
              }}
            >
              <Typography component="h1" variant="h6" color="inherit" noWrap display="inline">
                gmib
              </Typography>
              &nbsp;
              <Typography component="h1" variant="subtitle1" color="inherit" display="inline">
                {`${version}`}
              </Typography>
            </Box>
            {toolbar}
            {/* TODO: novastar */}
            <Tooltip title="Поиск новых устройств" enterDelay={500}>
              <IconButton
                // edge="start"
                color="inherit"
                onClick={searchOpen}
                disabled={!isLinkingDevice}
                hidden={tab !== 'devices'}
                sx={{ display: tab !== 'devices' ? 'none' : 'inherit' }}
                size="large"
              >
                <SearchIcon />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>
        <Drawer
          drawerWidth={drawerWidth}
          variant="permanent"
          // classes={{
          //   paper: classNames(classes.drawerPaper, !open && classes.drawerPaperClose),
          // }}
          open={open}
        >
          <Offset
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              py: 0,
              px: 1,
              gap: 1,
            }}
          >
            <img src={nata} alt="Nata-Info" height={42} />
            <IconButton onClick={handleDrawerClose} size="large">
              <ChevronLeftIcon />
            </IconButton>
          </Offset>
          <Divider />
          <List
            sx={{
              flex: 1,
              overflow: 'auto',
              p: 0,
            }}
          >
            <Devices />
            <Item onClick={() => dispatch(setCurrentTab('playlist'))} selected={tab === 'playlist'}>
              <ListItemText primary="Плейлист" />
            </Item>
            <Item onClick={() => dispatch(setCurrentTab('media'))} selected={tab === 'media'}>
              <ListItemText primary="Медиатека" />
            </Item>
            <Item
              onClick={() => dispatch(setCurrentTab('scheduler'))}
              selected={tab === 'scheduler'}
            >
              <ListItemText primary="Планировщик" />
            </Item>
            <HttpPages />
            <Item
              onClick={() => dispatch(setCurrentTab('autobrightness'))}
              selected={tab === 'autobrightness'}
            >
              <ListItemText id="switch-autobrightness" primary="Автояркость" />
              <ListItemSecondaryAction>
                <Switch
                  edge="end"
                  onChange={() => dispatch(setAutobrightness(!autobrightness))}
                  checked={autobrightness}
                  inputProps={{ 'aria-labelledby': 'switch-autobrightness' }}
                />
              </ListItemSecondaryAction>
            </Item>
            <Item selected={tab === 'overheat'} onClick={() => dispatch(setCurrentTab('overheat'))}>
              <ListItemText id="switch-overheat-protection" primary="Защита от перегрева" />
              <ListItemSecondaryAction>
                <Switch
                  edge="end"
                  checked={protectionEnabled}
                  inputProps={{ 'aria-labelledby': 'switch-overheat-protection' }}
                  onClick={() => dispatch(setProtectionProp(['enabled', !protectionEnabled]))}
                />
              </ListItemSecondaryAction>
            </Item>
            <Item onClick={() => dispatch(setCurrentTab('log'))} selected={tab === 'log'}>
              <ListItemText primary="Журнал" />
            </Item>
          </List>
        </Drawer>
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 0,
            height: '100vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            width: 1,
          }}
        >
          <Offset sx={{ flex: '0 0 auto' }} />
          <Box
            sx={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              position: 'relative',
            }}
          >
            <GmibTabs />
          </Box>
        </Box>
        <SearchDialog open={isSearchOpen} close={searchClose} />
      </Box>
    </>
  );
};

export default App;
