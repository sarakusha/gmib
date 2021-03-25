/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import Badge from '@material-ui/core/Badge';
import makeStyles from '@material-ui/core/styles/makeStyles';
import React, { useEffect, useReducer } from 'react';
import Tooltip from '@material-ui/core/Tooltip';
import Popover from '@material-ui/core/Popover';
import IconButton from '@material-ui/core/IconButton';
import LocationOnIcon from '@material-ui/icons/LocationOn';
import TextField from '@material-ui/core/TextField';
import HelpIcon from '@material-ui/icons/Help';

import { selectCurrentLocation, setLocationProp } from '../store/currentSlice';
import { Config } from '../util/config';
import { createPropsReducer, toNumber } from '../util/helpers';

import FormFieldSet from './FormFieldSet';
import { useDispatch, useSelector } from '../store';
import AutobrightnessHelp from './Help/AutobrightnessHelp';

const useStyles = makeStyles(theme => ({
  content: {
    padding: theme.spacing(1),
    width: '30ch',
  },
  location: {
    '& > div': {
      display: 'flex',
      flexDirection: 'row',
      paddingTop: theme.spacing(1),
    },
  },
  item: {
    flex: 1,
    '& ~ $item': {
      marginLeft: theme.spacing(2),
    },
  },
  help: {
    padding: theme.spacing(1),
  },
}));

type ActionType = 'location' | 'help';
type State = Record<ActionType, HTMLButtonElement | null>;
const reducer = createPropsReducer<State>();

type Location = Record<keyof Required<Config>['location'], string>;
const locationReducer = createPropsReducer<Location>();

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

const AutobrightnessToolbar: React.FC = () => {
  const classes = useStyles();
  const current = useSelector(selectCurrentLocation);
  const [location, setLocation] = useReducer(locationReducer, {
    latitude: '',
    longitude: '',
  });
  useEffect(() => {
    setLocation(['latitude', current?.latitude?.toString() ?? '']);
    setLocation(['longitude', current?.longitude?.toString() ?? '']);
  }, [current]);
  const dispatch = useDispatch();
  const [anchorEl, setAnchorEl] = useReducer(reducer, {
    location: null,
    help: null,
  });
  const error = validateLocation(current);
  const handleClick = (type: ActionType): React.MouseEventHandler<HTMLButtonElement> => event => {
    setAnchorEl([type, event.currentTarget]);
  };
  const handleClose = (type: ActionType): (() => void) => () => {
    error === undefined && setAnchorEl([type, null]);
  };
  const handleChange = (prop: keyof Location): React.ChangeEventHandler<HTMLInputElement> => e => {
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
  const locationId = locationOpen ? 'location-settings' : undefined;
  const helpId = helpOpen ? 'help' : undefined;
  return (
    <div>
      <Tooltip title={`${isValid ? 'Задать' : 'Укажите'} координаты экрана`}>
        <IconButton color="inherit" onClick={handleClick('location')}>
          <Badge variant="dot" color="secondary" invisible={isValid}>
            <LocationOnIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Tooltip title="Справка задания автояркости">
        <IconButton color="inherit" onClick={handleClick('help')}>
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
        <div className={classes.content}>
          <FormFieldSet
            legend="Координаты экрана"
            helper={error}
            error={!!error}
            className={classes.location}
            fullWidth
          >
            <TextField
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
              className={classes.item}
            />
            <TextField
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
              className={classes.item}
            />
          </FormFieldSet>
        </div>
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
        <div className={classes.help}>
          <AutobrightnessHelp />
        </div>
      </Popover>
    </div>
  );
};

export default React.memo(AutobrightnessToolbar);
