/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import { makeStyles } from '@material-ui/core/styles';
import Tooltip from '@material-ui/core/Tooltip';
import IconButton from '@material-ui/core/IconButton';
import TuneIcon from '@material-ui/icons/Tune';
import Popover from '@material-ui/core/Popover';
import session, { LogLevel, LogLevelV } from '@nibus/core';
import React, { useState } from 'react';
import FormFieldSet from './FormFieldSet';
import { useSelector } from '../store';
import { selectLogLevel } from '../store/sessionSlice';

const useStyles = makeStyles(theme => ({
  content: {
    margin: theme.spacing(1),
  },
  levels: {
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    borderColor: 'rgba(0, 0, 0, 0.23)',
    borderWidth: 1,
    borderStyle: 'solid',
    display: 'block',
    flexDirection: 'row',
    '&:not(:last-child)': {
      marginRight: theme.spacing(2),
    },
  },
}));

const levels = Object.keys(LogLevelV.keys) as LogLevel[];

const LogToolbar: React.FC = () => {
  const classes = useStyles();
  // const [open, setOpen] = useState(false);
  // const triggerOpen = () => setOpen(prev => !prev);
  const logLevel = useSelector(selectLogLevel);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = e => {
    session.setLogLevel(e.target.value as LogLevel);
    setAnchorEl(null);
  };
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (): void => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'logo-settings' : undefined;

  return (
    <div>
      <Tooltip title="Задать формат вывода пакетов NiBUS">
        <IconButton color="inherit" onClick={handleClick} aria-describedby={id}>
          <TuneIcon />
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        id={id}
        anchorEl={anchorEl}
        onClose={handleClose}
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
          <RadioGroup row aria-label="nibus log level" value={logLevel} onChange={handleChange}>
            <FormFieldSet legend="Формат пакетов NiBUS" className={classes.levels}>
              {levels.map(value => (
                <FormControlLabel
                  key={value}
                  value={value}
                  control={<Radio />}
                  label={value}
                  labelPlacement="top"
                />
              ))}
            </FormFieldSet>
          </RadioGroup>
        </div>
      </Popover>
    </div>
  );
};

export default React.memo(LogToolbar);
