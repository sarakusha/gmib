/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

/* tslint:disable:react-a11y-role-has-required-aria-props */
import {
  AppBar,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl, IconButton, Input,
  InputLabel, LinearProgress,
  List,
  ListItem, ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  NativeSelect,
  Tab,
  Tabs,
  TextField,
} from '@material-ui/core';
import { IDevice, getMibTypes, findMibByType } from '@nibus/core/lib/mib';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import AddIcon from '@material-ui/icons/Add';
import unionBy from 'lodash/unionBy';
import without from 'lodash/without';
import classNames from 'classnames';
import Finder, { DeviceInfo, FinderOptions, toVersion } from '../util/finders';
import useDefaultKeys from '../util/useDefaultKeys';
import DeviceIcon from '../components/DeviceIcon';
import { useDevicesContext } from '../providers/DevicesProvier';

const styles = (theme: Theme) => createStyles({
  hidden: {
    display: 'none',
  },
  formControl: {
    marginLeft: theme.spacing.unit,
    marginRight: theme.spacing.unit,
    width: '30ch',
  },
  tabContent: {
    padding: theme.spacing.unit * 2,
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  content: {
    position: 'relative',
    paddingLeft: 0,
    paddingRight: 0,
  },
  detectedList: {
    minWidth: '40ch',
  },
  detectedContainer: {
    width: '100%',
    display: 'flex',
    height: '20ch',
    justifyContent: 'center',
    overflowY: 'auto',
  },
  detectedItem: {},
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

const deviceKey = ({ address, connection }: DeviceInfo) =>
  `${connection.path}#${address.toString()}`;
const union = (prev: DeviceInfo[], item: DeviceInfo) => unionBy(prev, [item], deviceKey);

const SearchDialog: React.FC<InnerProps> = ({ open, close, classes }) => {
  const [isSearching, setSearching] = useState(false);
  const [kind, setKind] = useState(0);
  const [connections, setConnections] = useState<IDevice[]>([]);
  const connectionRef = useRef<HTMLInputElement>(null as any);
  const mibTypeRef = useRef<HTMLInputElement>(null as any);
  const addressRef = useRef<HTMLInputElement>(null as any);
  const { devices, createDevice } = useDevicesContext();
  const [detected, setDetected] = useState<DeviceInfo[]>([]);
  const [invalidAddress, setInvalidAddress] = useState(false);
  const defaultValues = useRef({
    address: '',
    type: '0',
  });
  const finder = useMemo(() => new Finder(), []);
  useEffect(
    () => {
      const startListener = () => setSearching(true);
      const finishListener = () => setSearching(false);
      const foundListener = (info: DeviceInfo) => setDetected(prev => union(prev, info));
      finder.on('start', startListener);
      finder.on('finish', finishListener);
      finder.on('found', foundListener);
      return () => {
        finder.off('start', startListener);
        finder.off('finish', finishListener);
        finder.off('found', foundListener);
      };
    },
    [finder, setSearching, setDetected],
  );
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
  const startStop = useCallback(
    () => {
      const connection = connectionRef.current.value;
      const devs: IDevice[] = connection === '0'
        ? connections
        : [connections.find(dev => dev.id === connection)!];
      const options: FinderOptions = {
        connections: devs.map(dev => dev.connection!),
      };
      switch (kind) {
        case 0:
          options.address = addressRef.current.value;
          break;
        case 1:
          options.type = Number(mibTypeRef.current.value);
          break;
        default:
          return;
      }
      if (isSearching) {
        finder.cancel();
        setSearching(false);
      } else {
        finder.run(options).then(
          () => setInvalidAddress(false),
          (e: Error) => {
            console.error(e.stack);
            setInvalidAddress(true);
          },
        );
      }
    },
    [isSearching, connections, kind],
  );
  useEffect(
    () => {
      finder.cancel();
      if (!open) {
        addressRef.current && (defaultValues.current.address = addressRef.current.value);
        mibTypeRef.current && (defaultValues.current.type = mibTypeRef.current.value);
      }
    },
    [open, kind],
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
  const mibTypes = useMemo(
    () =>
      Object.entries(getMibTypes()!)
        .map(([type, mibs]) => ({
          value: type,
          name: mibs.map(mib => mib.mib).join() as string,
        }))
        .filter(types => types.value !== '0')
        .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    [],
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
          </Tabs>
        </AppBar>
        <form className={classes.tabContent} noValidate autoComplete="off">
          <FormControl className={classes.formControl} margin="normal" disabled={isSearching}>
            <InputLabel htmlFor="connection">Соединение</InputLabel>
            <NativeSelect
              defaultValue={'0'}
              input={<Input name="connection" id="connection" inputRef={connectionRef} />}
            >
              <option value={'0'}>Все</option>
              {connections.map(device => (
                <option
                  key={device.id}
                  value={device.id}
                >
                  {device.address.isEmpty
                    ? device.connection && `${device.connection.description.category}-${device.id}`
                    : device.address.toString()}
                </option>
              ))}
            </NativeSelect>
          </FormControl>
          <TextField
            id="address"
            className={classNames(classes.formControl, { [classes.hidden]: kind !== 0 })}
            error={invalidAddress}
            label="Адрес"
            inputRef={addressRef}
            defaultValue={defaultValues.current.address}
            margin="normal"
            disabled={isSearching}
          />
          <FormControl
            className={classNames(classes.formControl, { [classes.hidden]: kind !== 1 })}
            margin="normal"
            disabled={isSearching}
          >
            <InputLabel htmlFor="mibtype">Тип</InputLabel>
            <NativeSelect
              defaultValue={defaultValues.current.type}
              input={<Input name="mibtype" id="mibtype" inputRef={mibTypeRef} />}
            >
              <option value={'0'}>Не выбран</option>
              {mibTypes.map(({ value, name }) => (
                <option
                  key={value}
                  value={value}
                >
                  {name}
                </option>
              ))}
            </NativeSelect>
          </FormControl>
        </form>
        <div className={classes.detectedContainer}>
          <List className={classes.detectedList}>
            {detected.map((info) => {
              // const version = info.version && toVersion(info.version);
              const mib = info.type > 0 ? findMibByType(info.type, info.version) : undefined;
              return (
                <ListItem
                  key={deviceKey(info)}
                  className={classes.detectedItem}
                >
                  <ListItemIcon>
                    <DeviceIcon color="inherit" mib={mib} />
                  </ListItemIcon>
                  <ListItemText primary={info.address.toString()} secondary={mib} />
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
              );
            })}
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
