/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

/* tslint:disable:react-a11y-role-has-required-aria-props */
// import AppBar from '@material-ui/core/AppBar';
import { makeStyles } from '@material-ui/core/styles';
import {
  Paper,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  Input,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  NativeSelect,
  Tab,
  Tabs,
  TextField,
} from '@material-ui/core';
import { findMibByType, Address, DeviceId, getDefaultSession } from '@nibus/core';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AddIcon from '@material-ui/icons/Add';
import unionBy from 'lodash/unionBy';
import without from 'lodash/without';
import classNames from 'classnames';
import { useDevices, useDispatch, useSelector } from '../store';
import { createDevice, selectLinks } from '../store/devicesSlice';
import { selectMibTypes } from '../store/nibusSlice';
import Finder, { DeviceInfo, FinderOptions } from '../util/finders';
import { getSessionId } from '../util/helpers';
import useDefaultKeys from '../util/useDefaultKeys';
import DeviceIcon from '../components/DeviceIcon';

const useStyles = makeStyles(theme => ({
  hidden: {
    display: 'none',
  },
  formControl: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    width: '30ch',
  },
  tabContent: {
    padding: theme.spacing(2),
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
    position: 'relative',
  },
}));

type Props = {
  open: boolean;
  close: () => void;
};

const deviceKey = ({ address, owner }: DeviceInfo): string => `${owner}#${address.toString()}`;

const union = (prev: DeviceInfo[], item: DeviceInfo): DeviceInfo[] =>
  unionBy(prev, [item], deviceKey);

const SearchDialog: React.FC<Props> = ({ open, close }) => {
  const classes = useStyles();
  const [isSearching, setSearching] = useState(false);
  const [kind, setKind] = useState(0);
  const links = useSelector(selectLinks);
  const devices = useDevices();
  const dispatch = useDispatch();
  const connectionRef = useRef<HTMLInputElement>(null);
  const mibTypeRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const [detected, setDetected] = useState<DeviceInfo[]>([]);
  const [invalidAddress, setInvalidAddress] = useState(false);
  const defaultValues = useRef({
    address: '',
    type: '0',
  });
  const finder = useMemo(() => new Finder(), []);
  useEffect(() => {
    const startListener = (): void => setSearching(true);
    const finishListener = (): void => setSearching(false);
    const foundListener = (info: DeviceInfo): void => setDetected(prev => union(prev, info));
    finder.on('start', startListener);
    finder.on('finish', finishListener);
    finder.on('found', foundListener);
    return () => {
      finder.off('start', startListener);
      finder.off('finish', finishListener);
      finder.off('found', foundListener);
    };
  }, [finder, setSearching, setDetected]);
  const changeHandler = useCallback((_, newValue) => setKind(newValue), [setKind]);
  const startStop = useCallback(() => {
    const connection = connectionRef.current?.value;
    if (connection === undefined) return;
    const owners: DeviceId[] = (connection === '0'
      ? links
      : links.filter(({ id }) => id === connection)
    ).map(({ id }) => id);
    const options: FinderOptions = {
      owners,
    };
    switch (kind) {
      case 0:
        options.address = addressRef.current!.value;
        break;
      case 1:
        options.type = Number(mibTypeRef.current!.value);
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
        }
      );
    }
  }, [links, kind, isSearching, finder]);
  useEffect(() => {
    finder.cancel();
    if (!open) {
      addressRef.current && (defaultValues.current.address = addressRef.current.value);
      mibTypeRef.current && (defaultValues.current.type = mibTypeRef.current.value);
    }
  }, [open, kind, finder]);
  const addDevice = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const key = event.currentTarget.id;
      setDetected(devs => {
        const dev = devs.find(item => deviceKey(item) === key);
        if (!dev?.owner) return devs;
        if (
          devices.findIndex(
            device => dev.address.equals(device.address) && device.parent === dev.owner
          ) === -1
        ) {
          dispatch(
            createDevice(
              getSessionId(getDefaultSession()),
              dev.owner,
              dev.address.toString(),
              dev.type,
              dev.version
            )
          );
        }
        return without(devs, dev);
      });
    },
    [devices, dispatch]
  );
  const mibTypes = useSelector(selectMibTypes);
  useDefaultKeys({
    enterHandler: startStop,
    cancelHandler: close,
  });
  return (
    <Dialog open={open} aria-labelledby="search-title">
      <DialogTitle id="search-title">Поиск устройств</DialogTitle>
      <DialogContent className={classes.content}>
        {/* <AppBar position="static">*/}
        <Paper square>
          <Tabs value={kind} indicatorColor="primary" onChange={changeHandler} variant="fullWidth">
            <Tab label="По адресу" />
            <Tab label="По типу" />
          </Tabs>
        </Paper>
        {/* </AppBar>*/}
        <form className={classes.tabContent} noValidate autoComplete="off">
          <FormControl className={classes.formControl} margin="normal" disabled={isSearching}>
            <InputLabel htmlFor="connection">Соединение</InputLabel>
            <NativeSelect
              defaultValue={'0'}
              input={<Input name="connection" id="connection" inputRef={connectionRef} />}
            >
              <option value={'0'}>Все</option>
              {links.map(device => (
                <option key={device.id} value={device.id}>
                  {Address.empty.equals(device.address)
                    ? `${device.mib}-${device.id}`
                    : device.address}
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
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          </FormControl>
        </form>
        <div className={classes.detectedContainer}>
          <List className={classes.detectedList}>
            {detected.map(info => {
              const mib = info.type > 0 ? findMibByType(info.type, info.version) : undefined;
              return (
                <ListItem key={deviceKey(info)} className={classes.detectedItem}>
                  <ListItemIcon>
                    <DeviceIcon color="inherit" mib={mib} />
                  </ListItemIcon>
                  <ListItemText primary={info.address} secondary={mib} />
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
        <Button onClick={close} color="primary">
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default React.memo(SearchDialog);
