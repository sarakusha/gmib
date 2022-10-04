import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet';
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
import some from 'lodash/some';
import React, { useCallback, useEffect, useState } from 'react';

import nata from '../../assets/nata.svg';
import RemoteHostsDialog from '../dialogs/RemoteHostsDialog';
import SearchDialog from '../dialogs/SearchDialog';
import { useToolbar } from '../providers/ToolbarProvider';
import { useDevices, useDispatch, useSelector } from '../store';
import { setAutobrightness, setProtectionProp } from '../store/configSlice';
import { setCurrentTab, setRemoteDialogOpen } from '../store/currentSlice';
import {
  selectAutobrightness,
  selectCurrentTab,
  selectIsClosed,
  selectIsOnline,
  selectIsRemoteDialogOpen,
  selectLoading,
  selectOverheatProtection,
} from '../store/selectors';

import AppBar from './AppBar';
import Devices from './Devices';
import Drawer from './Drawer';
import GmibTabs from './GmibTabs';
import HttpPages from './HttpPages';

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
  const isRemoteDialogOpen = useSelector(selectIsRemoteDialogOpen);
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
      <RemoteHostsDialog
        open={isRemoteDialogOpen}
        onClose={() => dispatch(setRemoteDialogOpen(false))}
      />
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
                {import.meta.env.VITE_APP_NAME}
              </Typography>
              &nbsp;
              <Typography component="h1" variant="subtitle1" color="inherit" display="inline">
                {import.meta.env.VITE_APP_VERSION}
              </Typography>
            </Box>
            {toolbar}
            {/* TODO: novastar */}
            <Tooltip title="Поиск новых устройств" enterDelay={500}>
              <div>
                <IconButton
                  color="inherit"
                  onClick={searchOpen}
                  disabled={!isLinkingDevice}
                  hidden={tab !== 'devices'}
                  sx={{ ...(tab !== 'devices' && { display: 'none' }) }}
                  size="large"
                >
                  <SearchIcon />
                </IconButton>
              </div>
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
