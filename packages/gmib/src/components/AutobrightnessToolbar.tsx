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
import { makeStyles } from '@material-ui/core/styles';
import React, { useReducer } from 'react';
import Tooltip from '@material-ui/core/Tooltip';
import Popover from '@material-ui/core/Popover';
import IconButton from '@material-ui/core/IconButton';
import LocationOnIcon from '@material-ui/icons/LocationOn';
import TextField from '@material-ui/core/TextField';
import HelpIcon from '@material-ui/icons/Help';

import { selectLocation, setLatitude, setLongitude } from '../store/locationSlice';

import FormFieldSet from './FormFieldSet';
import { useDispatch, useSelector } from '../store';
import AutobrightnessHelp from './Help/AutobrightnessHelp';

const useStyles = makeStyles(theme => ({
  content: {
    padding: theme.spacing(1),
    width: '30ch',
  },
  location: {
    display: 'flex',
    flexDirection: 'row',
    paddingTop: theme.spacing(1),
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
type Action = [type: ActionType, payload: HTMLButtonElement | null];
type State = Record<ActionType, HTMLButtonElement | null>;
const reducer = (state: State, [type, payload]: Action): State => {
  switch (type) {
    case 'location':
      return { ...state, location: payload };
    case 'help':
      return { ...state, help: payload };
    default:
      throw new Error(`Invalid action type: ${type}`);
  }
};

const AutobrightnessToolbar: React.FC = () => {
  const classes = useStyles();
  const { longitude, latitude, error } = useSelector(selectLocation);
  const dispatch = useDispatch();
  const [anchorEl, setAnchorEl] = useReducer(reducer, { location: null, help: null });
  const handleClick = (type: ActionType): React.MouseEventHandler<HTMLButtonElement> => event => {
    setAnchorEl([type, event.currentTarget]);
  };
  const handleClose = (type: ActionType): (() => void) => () => {
    setAnchorEl([type, null]);
  };

  const isValid = latitude !== undefined && longitude !== undefined && error === undefined;
  const locationOpen = Boolean(anchorEl.location);
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
              value={latitude ?? ''}
              onChange={e => dispatch(setLatitude(Number(e.target.value)))}
              inputProps={{ min: -90, max: 90 }}
              className={classes.item}
            />
            <TextField
              type="number"
              label="Долгота"
              value={longitude ?? ''}
              onChange={e => dispatch(setLongitude(Number(e.target.value)))}
              inputProps={{ min: -180, max: 180 }}
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
