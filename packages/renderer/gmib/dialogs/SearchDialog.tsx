import AddIcon from '@mui/icons-material/Add';
import {
  Box,
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
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';

import type { DeviceId } from '@nibus/core';
import Address from '@nibus/core/Address';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import DeviceIcon from '../components/DeviceIcon';
import { useDevices, useDispatch, useSelector } from '../store';
import { selectFinder, selectLinks, selectNovastarIds } from '../store/selectors';
import type { DeviceInfo } from '../store/sessionSlice';
import { addDetected, resetDetected } from '../store/sessionSlice';
import useDefaultKeys from '../util/useDefaultKeys';

import type { FinderOptions } from '/@common/helpers';
import { reIPv4 } from '/@common/helpers';

type Props = {
  open: boolean;
  close: () => void;
};

const deviceKey = ({ address, owner }: DeviceInfo): string => `${owner}#${address.toString()}`;

type SearchKind = 'byAddress' | 'byType';

const SearchDialog: React.FC<Props> = ({ open, close }) => {
  const { isSearching, detected } = useSelector(selectFinder);
  const [kind, setKind] = useState<SearchKind>('byType');
  const links = useSelector(selectLinks);
  const devices = useDevices();
  const dispatch = useDispatch();
  const connectionRef = useRef<HTMLInputElement>(null);
  const mibTypeRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const [invalidAddress, setInvalidAddress] = useState(false);
  const defaultValues = useRef({
    address: '',
    type: '0',
  });
  useEffect(() => {
    dispatch(resetDetected());
  }, [dispatch, open]);
  const changeHandler = useCallback(
    (_: React.SyntheticEvent, newValue: SearchKind) => setKind(newValue),
    [],
  );
  const startStop = useCallback(() => {
    const connection = connectionRef.current?.value;
    if (connection === undefined) return;
    const owners: DeviceId[] = (
      connection === '0' ? links : links.filter(({ id }) => id === connection)
    ).map(({ id }) => id);
    const options: FinderOptions = {
      owners,
    };
    switch (kind) {
      case 'byAddress':
        options.address = addressRef.current?.value;
        break;
      case 'byType':
        options.type = Number(mibTypeRef.current?.value);
        break;
      default:
    }
    if (isSearching) {
      window.nibus.cancelSearch();
    } else if (options.type !== 0 && !(options.address && reIPv4.test(options.address))) {
      window.nibus.findDevices(options).then(
        () => setInvalidAddress(false),
        () => setInvalidAddress(true),
      );
    } else {
      window.novastar
        .findNetDevices(
          options.address && reIPv4.test(options.address) ? options.address : undefined,
        )
        .then(addresses => {
          addresses.map(address =>
            dispatch(addDetected({ address, type: 0, owner: 'nova' as DeviceId })),
          );
        });
    }
  }, [links, kind, isSearching, dispatch]);
  useEffect(() => {
    window.nibus.cancelSearch();
    if (!open) {
      addressRef.current && (defaultValues.current.address = addressRef.current.value);
      mibTypeRef.current && (defaultValues.current.type = mibTypeRef.current.value);
    }
  }, [open, kind]);
  const novastarIds = useSelector(selectNovastarIds) as string[];
  const addDevice = (key: string): void => {
    const dev = detected.find(item => deviceKey(item) === key);
    if (!dev?.owner) return;
    if (dev.owner === 'nova') {
      if (!novastarIds.includes(dev.address)) window.novastar.open(dev.address);
    } else if (
      devices.findIndex(device => device.address === dev.address && device.parent === dev.owner) ===
      -1
    ) {
      window.nibus.createDevice(dev.owner, dev.address.toString(), dev.type, dev.version);
    }
  };
  useDefaultKeys({
    enterHandler: startStop,
    cancelHandler: close,
  });
  return (
    <Dialog open={open} aria-labelledby="search-title" onClose={close}>
      <DialogTitle id="search-title">Поиск устройств</DialogTitle>
      <DialogContent sx={{ position: 'relative', px: 0 }}>
        <Paper square sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          <Tabs
            value={kind}
            onChange={changeHandler}
            variant="fullWidth"
            textColor="inherit"
            indicatorColor="secondary"
          >
            <Tab label="По типу" value="byType" />
            <Tab label="По адресу" value="byAddress" />
          </Tabs>
        </Paper>
        <Box
          component="form"
          sx={{
            p: 2,
            display: 'flex',
            flexWrap: 'wrap',
            width: '60ch',
            gap: 1,
          }}
          noValidate
          autoComplete="off"
        >
          <FormControl margin="normal" disabled={isSearching} sx={{ flex: 1 }}>
            <InputLabel htmlFor="connection">Соединение</InputLabel>
            <Select
              defaultValue="0"
              input={<Input name="connection" id="connection" inputRef={connectionRef} />}
            >
              <MenuItem value="0">Все</MenuItem>
              {links.map(device => (
                <MenuItem key={device.id} value={device.id}>
                  {Address.empty.equals(device.address)
                    ? `${device.mib}-${device.id}`
                    : device.address}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            variant="standard"
            id="address"
            sx={{ display: kind !== 'byAddress' ? 'none' : 'block', flex: 1 }}
            error={invalidAddress}
            label="Адрес"
            inputRef={addressRef}
            defaultValue={defaultValues.current.address}
            margin="normal"
            disabled={isSearching}
            fullWidth
          />
          <FormControl
            sx={{ display: kind !== 'byType' ? 'none' : 'block', flex: 1 }}
            margin="normal"
            disabled={isSearching}
          >
            <InputLabel htmlFor="mibtype">Тип</InputLabel>
            <Select
              defaultValue={defaultValues.current.type}
              input={<Input name="mibtype" id="mibtype" inputRef={mibTypeRef} />}
              fullWidth
            >
              <MenuItem value="0">Ethernet</MenuItem>
              {links.length > 0 &&
                window.nibus.mibTypes.map(({ name, value }) => (
                  <MenuItem key={value} value={value}>
                    {name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </Box>
        <Box
          sx={{
            width: 1,
            display: 'flex',
            height: '20ch',
            justifyContent: 'center',
            overflowY: 'auto',
          }}
        >
          <List sx={{ minWidth: '40ch' }}>
            {detected.map(info => {
              const mib =
                info.type > 0 ? window.nibus.findMibByType(info.type, info.version) : undefined;
              return (
                <ListItem key={deviceKey(info)}>
                  <ListItemIcon>
                    <DeviceIcon color="inherit" mib={mib} />
                  </ListItemIcon>
                  <ListItemText primary={info.address.toString()} secondary={mib} />
                  <ListItemSecondaryAction>
                    <IconButton
                      id={deviceKey(info)}
                      aria-label="Add"
                      onClick={() => addDevice(deviceKey(info))}
                      disabled={isSearching}
                      size="large"
                    >
                      <AddIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>
        </Box>
        {isSearching && (
          <LinearProgress sx={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} />
        )}
      </DialogContent>
      <DialogActions sx={{ position: 'relative' }}>
        <Button onClick={startStop} color="primary" type="submit">
          {isSearching ? 'Остановить' : 'Начать'}
        </Button>
        <Button onClick={close} color="primary">
          Закрыть
        </Button>
        <Button
          color="primary"
          sx={{
            position: 'absolute',
            left: theme => theme.spacing(1),
            top: theme => theme.spacing(1),
          }}
          disabled={detected.length === 0}
          onClick={() => dispatch(resetDetected())}
        >
          Очистить
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default React.memo(SearchDialog);
