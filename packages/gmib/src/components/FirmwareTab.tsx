/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { makeStyles } from '@material-ui/core/styles';
import {
  Paper,
  Backdrop,
  Button,
  FormControlLabel,
  LinearProgress,
  Radio,
  RadioGroup,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import ReplayIcon from '@material-ui/icons/Replay';
import { Address, Flasher, FlashKinds, Kind, KindMap } from '@nibus/core';
import classNames from 'classnames';
import { SnackbarAction, useSnackbar } from 'notistack';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useDevice, useSelector } from '../store';
import { selectProps } from '../store/devicesSlice';
import CircularProgressWithLabel from './CircularProgressWithLabel';
import FlashUpgrade, { displayName, Props as FlashUpgradeProps } from './FlashUpgrade';
import FormFieldSet from './FormFieldSet';
import type { MinihostTabProps } from './TabContainer';

const useStyles = makeStyles(theme => ({
  root: {
    padding: theme.spacing(1),
  },
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-evenly',
  },
  kinds: {
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    borderColor: 'rgba(0, 0, 0, 0.23)',
    borderWidth: 1,
    borderStyle: 'solid',
    display: 'block',
    flexDirection: 'row',
    '& ~ $kinds': {
      marginRight: theme.spacing(2),
    },
  },
  wrapper: {
    '& > fieldset ~ fieldset': {
      marginLeft: theme.spacing(2),
    },
  },
  kind: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  progress: {
    width: '80%',
  },
  hidden: {
    display: 'none',
  },
}));

const OFFSET_SUCCESS = 0x1800;

function* generateSuccessKey(maxSuccess = 3): Generator<number, number> {
  let id = 0;
  while (true) {
    yield id + OFFSET_SUCCESS;
    id = (id + 1) % maxSuccess;
  }
}

const successId = generateSuccessKey();

const FirmwareTab: React.FC<MinihostTabProps> = ({ id, selected = false }) => {
  const classes = useStyles();
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();
  const { address } = useDevice(id) ?? {};
  const { bootloader } = useSelector(state => selectProps(state, id, 'bootloader'));
  const isEmpty = Address.empty.equals(address);
  const [progress, setProgress] = useState(0);
  const [flashing, setFlashing] = useState(false);
  const snacksRef = useRef<number[]>([]);
  const [kind, setKind] = useState<Kind>('rbf');
  useEffect(() => () => snacksRef.current.forEach(closeSnackbar), [closeSnackbar, kind]);
  const flashHandler = useCallback<FlashUpgradeProps['onFlash']>(
    (currentKind, filename, moduleSelect) => {
      snacksRef.current.forEach(closeSnackbar);
      snacksRef.current = [];
      setProgress(0);
      const flasher = new Flasher(id);
      let total = 0;
      try {
        total = flasher.flash(currentKind, filename, moduleSelect).total;
      } catch (e) {
        enqueueSnackbar(`Invalid source file: ${filename} (${e.message})`, { variant: 'error' });
        return;
      }
      flasher.once('error', e => {
        flasher.removeAllListeners();
        setFlashing(false);
        setProgress(0);
        enqueueSnackbar(`Error while flashing: ${e}`, { variant: 'error' });
      });
      setFlashing(true);
      let current = 0;
      const normalize = (value: number): number => (value * 100) / total;
      flasher.once('finish', () => {
        flasher.removeAllListeners();
        setFlashing(false);
        setProgress(0);
      });
      flasher.on('tick', ({ length, offset }) => {
        if (typeof offset === 'number') {
          current = offset;
        } else if (typeof length === 'number') {
          current += length;
        }
        setProgress(normalize(current));
      });
      const action: SnackbarAction = key => (
        <>
          <Button title="Повторить">
            <ReplayIcon
              onClick={() => {
                flashHandler(currentKind, filename, key as number);
              }}
            />
          </Button>
          <Button title="Закрыть">
            <CloseIcon onClick={() => closeSnackbar(key)} />
          </Button>
        </>
      );
      flasher.on('module', ({ x, y, msg, moduleSelect: ms }) => {
        let key = ms;
        if (!msg) {
          key = successId.next().value;
          enqueueSnackbar(`Модуль ${x},${y}: Ok`, {
            key,
            variant: 'success',
          });
        } else {
          enqueueSnackbar(msg, { key, persist: true, variant: 'error', action });
        }
        snacksRef.current.push(key);
      });
    },
    [id, closeSnackbar, enqueueSnackbar]
  );
  const kindHandler = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    e => setKind(e.target.value as Kind),
    []
  );
  return (
    <Paper className={classNames(classes.root, { [classes.hidden]: !selected })}>
      <RadioGroup
        row
        aria-label="firmware kind"
        value={kind}
        onChange={kindHandler}
        className={classes.wrapper}
      >
        {[false, true].map(isModule => (
          <FormFieldSet
            legend={isModule ? 'Модуль' : 'Хост'}
            className={classes.kinds}
            key={isModule.toString()}
          >
            {Object.entries(KindMap)
              .filter(([, [, module]]) => isModule === module)
              .map(([value]) => (
                <FormControlLabel
                  key={value}
                  value={value}
                  control={<Radio />}
                  label={displayName(value)}
                  labelPlacement="top"
                  className={classes.kind}
                  disabled={(value === 'mcu' ? !bootloader?.raw : isEmpty) || value === 'fpga'}
                />
              ))}
          </FormFieldSet>
        ))}
      </RadioGroup>
      {FlashKinds.map(value => (
        <FlashUpgrade key={value} kind={value} onFlash={flashHandler} hidden={value !== kind} />
      ))}
      <Backdrop open={flashing} className={classes.backdrop}>
        <CircularProgressWithLabel color="inherit" value={progress} />
        <LinearProgress variant="determinate" value={progress} className={classes.progress} />
      </Backdrop>
    </Paper>
  );
};

export default memo(FirmwareTab);
