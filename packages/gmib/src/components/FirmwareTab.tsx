/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import Backdrop from '@material-ui/core/Backdrop';
import Box from '@material-ui/core/Box';
import { makeStyles } from '@material-ui/core/styles';
import { Flasher, FlashKinds, Kind, KindMap } from '@nibus/core';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import LinearProgress from '@material-ui/core/LinearProgress';
import RadioGroup from '@material-ui/core/RadioGroup';
import Radio from '@material-ui/core/Radio';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import { useDevice } from '../providers/DevicesStateProvider';
import CircularProgressWithLabel from './CircularProgressWithLabel';
import FlashUpgrade, { Props as FlashUpgradeProps } from './FlashUpgrade';
import FormFieldSet from './FormFieldSet';
import type { Props } from './TabContainer';

const useStyles = makeStyles(theme => ({
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-evenly',
  },
  kinds: {
    padding: theme.spacing(1),
  },
  progress: {
    width: '80%',
  },
}));

const OFFSET_SUCCESS = 0x1800;

function* generateSuccessKey(maxSuccess = 2): Generator<number, number> {
  let id = 0;
  while (true) {
    yield id + OFFSET_SUCCESS;
    id = (id + 1) % maxSuccess;
  }
}

const successId = generateSuccessKey();

const FirmwareTab: React.FC<Props> = ({ id, selected }) => {
  const classes = useStyles();
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();
  const { device } = useDevice(id);
  const [progress, setProgress] = useState(0);
  const [flashing, setFleshing] = useState(false);
  const snacksRef = useRef<number[]>([]);
  useEffect(() => {
    return () => snacksRef.current.forEach(closeSnackbar);
  }, [closeSnackbar]);
  const flashHandler = useCallback<FlashUpgradeProps['onFlash']>(
    (kind, filename, moduleSelect) => {
      if (!device) return;
      snacksRef.current.forEach(closeSnackbar);
      snacksRef.current = [];
      setProgress(0);
      const flasher = new Flasher(device);
      const { total } = flasher.flash(kind, filename, moduleSelect);
      setFleshing(true);
      let current = 0;
      const normalize = (value: number): number => (value * 100) / total;
      flasher.once('finish', () => {
        flasher.removeAllListeners();
        setFleshing(false);
        setProgress(0);
      });
      flasher.on('tick', length => {
        current += length;
        setProgress(normalize(current));
      });
      flasher.on('module', ({ x, y, msg, moduleSelect: ms }) => {
        let key = ms;
        if (!msg) {
          key = successId.next().value;
          enqueueSnackbar(`Модуль ${x},${y}: Ok`, { key, variant: 'success' });
        } else {
          enqueueSnackbar(msg, { key, persist: true, variant: 'error' });
        }
        snacksRef.current.push(key);
      });
    },
    [device, closeSnackbar, enqueueSnackbar]
  );
  const [kind, setKind] = useState<Kind>('fpga');
  const kindHandler = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    e => setKind(e.target.value as Kind),
    []
  );
  const [, isModule, legacy] = KindMap[kind];
  return (
    <Box display={selected ? 'block' : 'none'} width={1} p={1} bgcolor="background.paper">
      <FormFieldSet
        legend="Тип прошивки"
        helper={`Для ${isModule ? 'модулей' : 'процессора'}${legacy ? ' (устаревшая)' : ''}`}
        className={classes.kinds}
      >
        <RadioGroup row aria-label="firmware kind" value={kind} onChange={kindHandler}>
          {FlashKinds.map(value => (
            <FormControlLabel
              key={value}
              value={value}
              control={<Radio />}
              label={value.toUpperCase()}
              labelPlacement="top"
            />
          ))}
        </RadioGroup>
      </FormFieldSet>
      {FlashKinds.map(value => (
        <FlashUpgrade key={value} kind={value} onFlash={flashHandler} hidden={value !== kind} />
      ))}
      <Backdrop open={flashing} className={classes.backdrop}>
        <CircularProgressWithLabel color="inherit" value={progress} />
        <LinearProgress variant="determinate" value={progress} className={classes.progress} />
      </Backdrop>
    </Box>
  );
};

export default FirmwareTab;
