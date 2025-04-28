import HelpIcon from '@mui/icons-material/Help';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import TimelineIcon from '@mui/icons-material/Timeline';
import VolumeIcon from '@mui/icons-material/AllOut';
import { Badge, Box, IconButton, Popover, TextField, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import React, { useEffect, useReducer, useState } from 'react';

import BrightnessHistoryDialog from '../dialogs/BrightnessHistoryDialog';
import { useDispatch, useSelector } from '../store';
import { setHidProp, setLocationProp } from '../store/configSlice';

import type { Config, HidOptions } from '/@common/config';
import { createPropsReducer, toNumber } from '/@common/helpers';

import { selectHID, selectLocation, selectSessionVersion } from '../store/selectors';

import FormFieldSet from './FormFieldSet';
import AutobrightnessHelp from './Help/AutobrightnessHelp';

type ActionType = 'location' | 'help' | 'hid';
type State = Record<ActionType, HTMLButtonElement | null>;
const reducer = createPropsReducer<State>();

type Location = Record<keyof Required<Config>['location'], string>;
const locationReducer = createPropsReducer<Location>();

// type HidProps = Record<keyof HidOptions, string>;
// const hidReducer = createPropsReducer<HidProps>();

const validateLocation = ({ longitude, latitude }: Config['location'] = {}): string | undefined => {
  if (longitude !== undefined) {
    if (longitude < -180) return 'Долгота \u2265 -180\u00b0';
    if (longitude > 180) return 'Долгота \u2264 180\u00b0';
  }
  if (latitude !== undefined) {
    if (latitude < -90) return 'Широта \u2265 -90\u00b0';
    if (latitude > 90) return 'Широта \u2264 90\u00b0';
  }
  return undefined;
};

const Item = styled(TextField)(({ theme }) => ({
  flex: 1,
  width: '10ch',
  '& ~ &': {
    marginLeft: theme.spacing(2),
  },
}));

const AutobrightnessToolbar: React.FC = () => {
  const current = useSelector(selectLocation);
  const version = useSelector(selectSessionVersion);
  const [location, setLocation] = useReducer(locationReducer, {
    latitude: '',
    longitude: '',
  });
  const hid = useSelector(selectHID);
  // const [hid, setHid] = useReducer(hidReducer, {
  //   VID: '',
  //   PID: '',
  //   mute: '',
  //   volumeUp: '',
  //   volumeDown: '',
  // });
  useEffect(() => {
    setLocation(['latitude', current?.latitude?.toString() ?? '']);
    setLocation(['longitude', current?.longitude?.toString() ?? '']);
  }, [current]);
  const dispatch = useDispatch();
  const [anchorEl, setAnchorEl] = useReducer(reducer, {
    location: null,
    help: null,
    hid: null,
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const error = validateLocation(current);
  const handleClick =
    (type: ActionType): React.MouseEventHandler<HTMLButtonElement> =>
    event => {
      setAnchorEl([type, event.currentTarget]);
    };
  const handleClose =
    (type: ActionType): (() => void) =>
    () => {
      error === undefined && setAnchorEl([type, null]);
    };
  const handleChange =
    (prop: keyof Location): React.ChangeEventHandler<HTMLInputElement> =>
    e => {
      const { value } = e.target;
      const res = toNumber(value);
      setLocation([prop, value]);
      if (res === undefined || value.trim() === res.toString())
        dispatch(setLocationProp([prop, res]));
    };
  const isValid =
    current &&
    current.longitude !== undefined &&
    current.latitude !== undefined &&
    error === undefined;
  const locationOpen = Boolean(anchorEl.location) || error !== undefined;
  const helpOpen = Boolean(anchorEl.help);
  const hidOpen = Boolean(anchorEl.hid);
  const locationId = locationOpen ? 'location-settings' : undefined;
  const helpId = helpOpen ? 'help' : undefined;
  const hidId = hidOpen ? 'hid-settings' : undefined;
  return (
    <div className="YqATOnK8rERXOjt0JEXW0 rlXINR-cZo5bnISD5TaUT">
      {version && (
        <Tooltip title="История">
          <IconButton color="inherit" onClick={() => setHistoryOpen(true)} size="large">
            <TimelineIcon />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={`${isValid ? 'Задать' : 'Укажите'} координаты экрана`}>
        <IconButton color="inherit" onClick={handleClick('location')} size="large">
          <Badge variant="dot" color="secondary" invisible={isValid}>
            <LocationOnIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Tooltip title="Поворотный регулятор яркости">
        <IconButton color="inherit" onClick={handleClick('hid')} size="large">
          <VolumeIcon sx={{ fontSize: 36 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Справка задания автояркости">
        <IconButton color="inherit" onClick={handleClick('help')} size="large">
          <HelpIcon />
        </IconButton>
      </Tooltip>
      <Popover
        open={locationOpen}
        id={locationId}
        anchorEl={anchorEl.location}
        onClose={handleClose('location')}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Box
          sx={{
            p: 1,
            width: '30ch',
          }}
        >
          <FormFieldSet
            legend="Координаты экрана"
            helper={error}
            error={!!error}
            sx={{
              '& > div': {
                display: 'flex',
                flexDirection: 'row',
                pt: 1,
              },
            }}
            fullWidth
          >
            <Item
              type="number"
              label="Широта"
              value={location.latitude}
              onChange={handleChange('latitude')}
              // onChange={e => setLocation(['latitude', e.target.value])}
              // onBlur={e => dispatch(setLatitude(toNumber(e.target.value)))}
              inputProps={{
                min: -90,
                max: 90,
              }}
              variant="standard"
            />
            <Item
              type="number"
              label="Долгота"
              value={location.longitude}
              onChange={handleChange('longitude')}
              // onChange={e => setLocation(['longitude', e.target.value])}
              // onBlur={e => dispatch(setLongitude(toNumber(e.target.value)))}
              inputProps={{
                min: -180,
                max: 180,
              }}
              variant="standard"
            />
          </FormFieldSet>
        </Box>
      </Popover>
      <Popover
        open={hidOpen}
        id={hidId}
        anchorEl={anchorEl.hid}
        onClose={handleClose('hid')}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Box
          sx={{
            p: 1,
            width: '30ch',
          }}
        >
          <FormFieldSet
            legend="Параметры HID-устройства"
            sx={{
              '& > div': {
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                pt: 1,
                width: '20ch',
                marginLeft: 'auto',
                marginRight: 'auto',
              },
            }}
            fullWidth
          >
            <TextField
              type="number"
              label="VID"
              value={hid?.VID ?? ''}
              onChange={e => dispatch(setHidProp(['VID', toNumber(e.target.value)]))}
              variant="standard"
            />
            <TextField
              type="number"
              label="PID"
              value={hid?.PID ?? ''}
              onChange={e => dispatch(setHidProp(['PID', toNumber(e.target.value)]))}
              variant="standard"
            />
            <TextField
              type="number"
              label="mute"
              value={hid?.mute ?? ''}
              onChange={e => dispatch(setHidProp(['mute', toNumber(e.target.value)]))}
              variant="standard"
            />
            <TextField
              type="number"
              label="volumeDown"
              value={hid?.volumeDown ?? ''}
              onChange={e => dispatch(setHidProp(['volumeDown', toNumber(e.target.value)]))}
              variant="standard"
            />
            <TextField
              type="number"
              label="volumeUp"
              value={hid?.volumeUp ?? ''}
              onChange={e => dispatch(setHidProp(['volumeUp', toNumber(e.target.value)]))}
              variant="standard"
            />
            <TextField
              type="number"
              label="Мин. яркость"
              value={hid?.minBrightness ?? ''}
              onChange={e => dispatch(setHidProp(['minBrightness', toNumber(e.target.value)]))}
              variant="standard"
            />
          </FormFieldSet>
        </Box>
      </Popover>
      <Popover
        open={helpOpen}
        id={helpId}
        anchorEl={anchorEl.help}
        onClose={handleClose('help')}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Box sx={{ p: 1 }}>
          <AutobrightnessHelp />
        </Box>
      </Popover>
      <BrightnessHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
};

export default React.memo(AutobrightnessToolbar);
