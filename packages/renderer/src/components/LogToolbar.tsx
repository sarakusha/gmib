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
  Box,
  FormControlLabel,
  IconButton,
  Popover,
  Radio,
  RadioGroup,
  Tooltip,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import { LogLevel, LogLevelV } from '@nibus/core';
import React, { useState } from 'react';
import FormFieldSet from './FormFieldSet';
import { useDispatch, useSelector } from '../store';
import { selectLogLevel, setLogLevel } from '../store/configSlice';

// const useStyles = makeStyles(theme => ({
//   content: {
//     margin: theme.spacing(1),
//   },
//   levels: {
//     padding: theme.spacing(1),
//     borderRadius: theme.shape.borderRadius,
//     borderColor: ,
//     borderWidth: 1,
//     borderStyle: 'solid',
//     // display: 'block',
//     // flexDirection: 'row',
//     // '&:not(:last-child)': {
//     //   marginRight: theme.spacing(2),
//     // },
//   },
// }));
//
const levels = Object.keys(LogLevelV.keys) as LogLevel[];

const LogToolbar: React.FC = () => {
  const logLevel = useSelector(selectLogLevel);
  const dispatch = useDispatch();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = e => {
    dispatch(setLogLevel(e.target.value as LogLevel));
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
        <IconButton color="inherit" onClick={handleClick} aria-describedby={id} size="large">
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
        <Box sx={{ m: 1 }}>
          <RadioGroup row aria-label="nibus log level" value={logLevel} onChange={handleChange}>
            <FormFieldSet
              legend="Формат пакетов NiBUS"
              sx={{ p: 1, borderRadius: 1, borderColor: 'rgba(0, 0, 0, 0.23)', border: 1 }}
            >
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
        </Box>
      </Popover>
    </div>
  );
};

export default React.memo(LogToolbar);
