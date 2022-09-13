import CloseIcon from '@mui/icons-material/Close';
import ReplayIcon from '@mui/icons-material/Replay';
import {
  Backdrop,
  Button,
  FormControlLabel,
  LinearProgress,
  Paper,
  Radio,
  RadioGroup,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import type { SnackbarAction, SnackbarKey } from 'notistack';
import { useSnackbar } from 'notistack';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useDevice, useSelector } from '../store';
import { enqueueSnackbar as enqueueSnackbarAction } from '../store/flasherSlice';
import { startAppListening } from '../store/listenerMiddleware';
import { selectFlashing, selectProgress, selectProps } from '../store/selectors';

import CircularProgressWithLabel from './CircularProgressWithLabel';
import type { Props as FlashUpgradeProps } from './FlashUpgrade';
import FlashUpgrade, { displayName } from './FlashUpgrade';
import FormFieldSet from './FormFieldSet';
import type { MinihostTabProps } from './TabContainer';

import Address from '@nibus/core/Address';
import type { Kind } from '@nibus/core/flash/FlashKinds';
import { FlashKinds, KindMap } from '@nibus/core/flash/FlashKinds';

const KindFormFieldSet = styled(FormFieldSet)(({ theme }) => ({
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  borderColor: 'rgba(0, 0, 0, 0.23)',
  borderWidth: 1,
  borderStyle: 'solid',
  display: 'block',
  flexDirection: 'row',
  '& ~ &': {
    marginRight: theme.spacing(2),
  },
}));

const FirmwareTab: React.FC<MinihostTabProps> = ({ id, selected = false }) => {
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();
  const { address } = useDevice(id) ?? {};
  const { bootloader } = useSelector(state => selectProps(state, id, 'bootloader'));
  const isEmpty = Address.empty.equals(address);
  const progress = useSelector(selectProgress);
  const flashing = useSelector(selectFlashing);
  const snacksRef = useRef<SnackbarKey[]>([]);
  const [kind, setKind] = useState<Kind>('rbf');
  useEffect(() => () => snacksRef.current.forEach(closeSnackbar), [closeSnackbar, kind]);
  const flashHandler = useCallback<FlashUpgradeProps['onFlash']>(
    (currentKind, filename, moduleSelect) => {
      snacksRef.current.forEach(closeSnackbar);
      snacksRef.current = [];
      window.nibus.flash(id, currentKind, filename, moduleSelect).catch(err => {
        enqueueSnackbar(err.message, { variant: 'error' });
      });
      // setProgress(0);
      // const flasher = new Flasher(id);
      // if (!currentKind) {
      //   setFlashing(true);
      //   flasher.resetModule(moduleSelect ?? 0xffff).finally(() => setFlashing(false));
      //   return;
      // }
      // if (!filename) return;
      // let total = 0;
      // try {
      //   total = flasher.flash(currentKind, filename, moduleSelect).total;
      // } catch (e) {
      //   enqueueSnackbar(`Invalid source file: ${filename} (${toErrorMessage(e)})`, {
      //     variant: 'error',
      //   });
      //   return;
      // }
      // flasher.once('error', e => {
      //   flasher.removeAllListeners();
      //   setFlashing(false);
      //   setProgress(0);
      //   enqueueSnackbar(`Error while flashing: ${e}`, { variant: 'error' });
      // });
      // setFlashing(true);
      // let current = 0;
      // const normalize = (value: number): number => (value * 100) / total;
      // flasher.once('finish', () => {
      //   flasher.removeAllListeners();
      //   setFlashing(false);
      //   setProgress(0);
      // });
      // flasher.on('tick', ({ length, offset }) => {
      //   if (typeof offset === 'number') {
      //     current = offset;
      //   } else if (typeof length === 'number') {
      //     current += length;
      //   }
      //   setProgress(normalize(current));
      // });
      // const action: SnackbarAction = key => (
      //   <>
      //     <Button title="Повторить">
      //       <ReplayIcon
      //         onClick={() => {
      //           flashHandler(currentKind, filename, key as number);
      //         }}
      //       />
      //     </Button>
      //     <Button title="Закрыть">
      //       <CloseIcon onClick={() => closeSnackbar(key)} />
      //     </Button>
      //   </>
      // );
      // flasher.on('module', ({ x, y, msg, moduleSelect: ms }) => {
      //   let key = ms;
      //   if (!msg) {
      //     key = successId.next().value;
      //     enqueueSnackbar(`Модуль ${x},${y}: Ok`, {
      //       key,
      //       variant: 'success',
      //     });
      //   } else {
      //     enqueueSnackbar(msg, {
      //       key,
      //       persist: true,
      //       variant: 'error',
      //       action,
      //     });
      //   }
      //   snacksRef.current.push(key);
      // });
    },
    [id, closeSnackbar, enqueueSnackbar],
  );
  useEffect(() => {
    const createAction =
      (currentKind: Kind, filename: string): SnackbarAction =>
      // eslint-disable-next-line react/no-unstable-nested-components
      key =>
        (
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
    return startAppListening({
      actionCreator: enqueueSnackbarAction,
      effect({ payload: { message, options, kind: currentKind, filename } }) {
        if (options?.key) {
          snacksRef.current.push(options.key);
        }
        enqueueSnackbar(
          message,
          options?.variant === 'error'
            ? { action: createAction(currentKind, filename), ...options }
            : options,
        );
      },
    });
  }, [flashHandler, closeSnackbar, enqueueSnackbar]);

  const kindHandler = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    e => setKind(e.target.value as Kind),
    [],
  );
  return (
    <Paper
      sx={{
        p: 1,
        display: selected ? 'block' : 'none',
      }}
    >
      <RadioGroup
        row
        aria-label="firmware kind"
        value={kind}
        onChange={kindHandler}
        sx={{
          '& > fieldset ~ fieldset': {
            ml: 2,
          },
        }}
      >
        {[false, true].map(isModule => (
          <KindFormFieldSet legend={isModule ? 'Модуль' : 'Хост'} key={isModule.toString()}>
            {Object.entries(KindMap)
              .filter(([, [, module]]) => isModule === module)
              .map(([value]) => (
                <FormControlLabel
                  key={value}
                  value={value}
                  control={<Radio />}
                  label={displayName(value)}
                  labelPlacement="top"
                  sx={{ mx: 1 }}
                  disabled={(value === 'mcu' ? !bootloader?.raw : isEmpty) || value === 'fpga'}
                />
              ))}
          </KindFormFieldSet>
        ))}
      </RadioGroup>
      {FlashKinds.map(value => (
        <FlashUpgrade key={value} kind={value} onFlash={flashHandler} hidden={value !== kind} />
      ))}
      <Backdrop
        open={flashing}
        sx={{
          zIndex: theme => theme.zIndex.drawer + 1,
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-evenly',
        }}
      >
        <CircularProgressWithLabel color="inherit" value={progress} />
        <LinearProgress variant="determinate" value={progress} sx={{ width: 0.8 }} />
      </Backdrop>
    </Paper>
  );
};

export default memo(FirmwareTab);
