/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import {
  AppBar,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl, IconButton,
  InputLabel, LinearProgress,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
} from '@material-ui/core';
import { IDevice } from '@nata/nibus.js-client/lib/mib';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import AddIcon from '@material-ui/icons/queue';
import unionBy from 'lodash/unionBy';
import without from 'lodash/without';
import { AddressFinder, DeviceInfo, FinderOptions, IFinder } from '../util/finders';
import useDefaultKeys from '../util/useDefaultKeys';
import { useDevicesContext } from './DevicesProvier';

const styles = (theme: Theme) => createStyles({
  formControl: {
    marginLeft: theme.spacing.unit,
    marginRight: theme.spacing.unit,
    minWidth: 120,
  },
  tabContent: {
    padding: theme.spacing.unit * 2,
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  content: {
    // backgroundColor: theme.palette.background.paper,
    position: 'relative',
    paddingLeft: 0,
    paddingRight: 0,
  },
  detectedList: {
    height: '20ch',
    width: '20ch',
    backgroundColor: theme.palette.background.paper,
  },
  detectedContainer: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  detectedItem: {},
  // buttonProgress: {
  //   color: theme.palette.primary.light,
  //   position: 'absolute',
  //   top: '50%',
  //   left: '50%',
  //   marginTop: -12,
  //   marginLeft: -12,
  //   pointerEvents: 'none',
  // },
  linearProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  wrapper: {
    // margin: theme.spacing.unit,
    position: 'relative',
  },
});
type Props = {
  open: boolean,
  close: () => void,
};
type InnerProps = Props & WithStyles<typeof styles>;

const selectInputProps = {
  id: 'connection',
  name: 'connection',
};

const deviceKey = ({ address, connection }: DeviceInfo) =>
  `${connection.path}#${address.toString()}`;
const union = (prev: DeviceInfo[], item: DeviceInfo) => unionBy(prev, [item], deviceKey);

const SearchDialog: React.FC<InnerProps> = ({ open, close, classes }) => {
  const [isSearching, setSearching] = useState(false);
  const [kind, setKind] = useState(0);
  const [connections, setConnections] = useState<IDevice[]>([]);
  const [connection, setConnection] = useState('0');
  const { devices, createDevice } = useDevicesContext();
  const addressRef = useRef<HTMLInputElement>(null as any);
  const [detected, setDetected] = useState<DeviceInfo[]>([]);
  const addressFinder = useRef(new AddressFinder());
  const [currentFinder, setCurrentFinder] = useState<IFinder | null>(null);
  const [invalidAddress, setInvalidAddress] = useState(false);
  useEffect(
    () => {
      setConnections(
        devices
          .filter(device => device.connection && device.connection.description.link)
          .filter(device => !Reflect.getMetadata('parent', device)),
      );
    },
    [devices],
  );
  const changeHandler = useCallback(
    (_, newValue) => setKind(newValue),
    [setKind],
  );
  useEffect(
    () => {
      let finder: IFinder | null;
      switch (kind) {
        case 0:
          finder = addressFinder.current;
          break;
        default:
          finder = null;
          break;
      }
      if (!finder) return;
      const startListener = () => setSearching(true);
      const finishListener = () => setSearching(false);
      const foundListener = (info: DeviceInfo) => {
        setDetected(prev => union(prev, info));
      };
      finder.on('start', startListener);
      finder.on('finish', finishListener);
      finder.on('found', foundListener);
      setCurrentFinder(finder);
      return () => {
        finder!.cancel();
        setSearching(false);
        finder!.off('start', startListener);
        finder!.off('finish', finishListener);
        finder!.off('found', foundListener);
      };
    },
    [kind],
  );
  const startStop = useCallback(
    () => {
      if (!currentFinder) return;
      if (!isSearching) {
        const devs: IDevice[] = connection === '0'
          ? connections
          : [connections.find(dev => dev.id === connection)!];
        const options: FinderOptions = {
          address: addressRef.current.value,
          connections: devs.map(dev => dev.connection!),
        };
        currentFinder.run(options).then(
          () => setInvalidAddress(false),
          () => setInvalidAddress(true),
        );
      } else {
        currentFinder.cancel();
      }
    },
    [isSearching, connections, connection, currentFinder],
  );
  const connectionChangeHandler = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setConnection(event.target.value);
    },
    [setConnection],
  );
  const addDevice = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const key = event.currentTarget.id;
      setDetected((devs) => {
        const dev = devs.find(dev => deviceKey(dev) === key);
        if (!dev) return devs;
        if (devices.findIndex(device => device.address.equals(dev.address)
          && device.connection === dev.connection) === -1) {
          const device = createDevice(dev.address, dev.type, dev.version);
          device.connection = dev.connection;
          const parent = connections.find(device => device.connection === dev.connection);
          Reflect.defineMetadata('parent', parent, device);
        }
        return without(devs, dev);
      });
    },
    [setDetected, devices, connections],
  );
  useDefaultKeys({
    enterHandler: startStop,
    cancelHandler: close,
  });
  return (
    <Dialog open={open} aria-labelledby="search-title">
      <DialogTitle id="search-title">Поиск устройств</DialogTitle>
      <DialogContent className={classes.content}>
        <AppBar position="static">
          <Tabs
            value={kind}
            indicatorColor="primary"
            onChange={changeHandler}
            variant="fullWidth"
          >
            <Tab label="По адресу" />
            <Tab label="По типу" />
            <Tab label="По групповому адресу" />
            <Tab label="Всех" />
          </Tabs>
        </AppBar>
        <form className={classes.tabContent} noValidate autoComplete="off">
          <FormControl className={classes.formControl} margin="normal">
            <InputLabel htmlFor="connections">Соединение</InputLabel>
            <Select
              value={connection}
              onChange={connectionChangeHandler}
              inputProps={selectInputProps}
            >
              <MenuItem value={'0'}>Все</MenuItem>
              {connections.map(device => (
                <MenuItem key={device.id} value={device.id}>{device.address.toString()}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            id="address"
            error={invalidAddress}
            required
            label={kind === 0 ? 'Адрес' : 'Группа'}
            inputRef={addressRef}
            margin="normal"
          />
        </form>
        <div className={classes.detectedContainer}>
          <List className={classes.detectedList}>
            {detected.map(info => (
              <ListItem
                key={deviceKey(info)}
                className={classes.detectedItem}
              >
                <ListItemText primary={info.address.toString()} />
                <ListItemSecondaryAction>
                  <IconButton
                    id={deviceKey(info)}
                    aria-label="Add"
                    onClick={addDevice}
                    disabled={isSearching}
                  >
                    <AddIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </div>
        {isSearching && <LinearProgress className={classes.linearProgress} />}
      </DialogContent>
      <DialogActions>
        <Button onClick={startStop} color="primary" type="submit">
          {isSearching ? 'Остановить' : 'Начать'}
        </Button>
        <Button onClick={close} color="primary">Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(SearchDialog);
