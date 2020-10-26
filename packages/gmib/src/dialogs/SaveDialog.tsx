/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { IDevice } from '@nibus/core';
import React, { useCallback, useMemo, useReducer } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import { ipcRenderer } from 'electron';
import fs from 'fs';
import some from 'lodash/some';
import pick from 'lodash/pick';
import { tuplify } from '../util/helpers';
import FormFieldSet from '../components/FormFieldSet';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
  },
  formControl: {
    margin: theme.spacing(3),
  },
}));

type Props = {
  device: IDevice;
  open: boolean;
  close: () => void;
};

type Action = {
  name: string;
  value: boolean;
};

type State = Record<string, boolean>;

const reducer = (state: State, { name, value }: Action): State => {
  if (name === '$all$') {
    return Object.keys(state).reduce<State>((result, key) => ({ ...result, [key]: value }), {});
  }
  return {
    ...state,
    [name]: value,
  };
};

const SaveDialog: React.FC<Props> = ({ device, open, close }) => {
  const classes = useStyles();
  const [names, initial] = useMemo(() => {
    const keys = !device
      ? []
      : Object.entries<string[]>(Reflect.getMetadata('map', device) || {})
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([id, key]) =>
            tuplify(
              Number(id),
              key[0] as string,
              Reflect.getMetadata('displayName', device, key[0]) as string
            )
          )
          .filter(
            ([, name]) =>
              Reflect.getMetadata('isReadable', device, name) &&
              Reflect.getMetadata('isWritable', device, name)
          );
    return [keys, keys.reduce((res, [, name]) => ({ ...res, [name]: false }), {})];
  }, [device]);

  const [state, dispatch] = useReducer(reducer, initial);
  const changeHandler = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        name: event.currentTarget.value,
        value: event.currentTarget.checked,
      });
    },
    [dispatch]
  );
  const closeHandler = useCallback(() => close(), [close]);
  const showDialog = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const mib = Reflect.getMetadata('mib', device);
      const fileName: string | undefined = ipcRenderer.sendSync('showSaveDialogSync', {
        title: 'Сохранить как',
        defaultPath: mib,
        filters: [
          {
            name: 'JSON',
            extensions: ['json'],
          },
        ],
      });

      if (fileName) {
        const props =
          event.currentTarget.id === 'all'
            ? names.map(([, name]) => name)
            : Object.entries(state)
                .filter(([, checked]) => checked)
                .map(([name]) => name);
        const data = pick(device, props);
        data.$mib = mib;
        fs.writeFileSync(fileName, JSON.stringify(data));
        close();
      }
    },
    [close, device, names, state]
  );

  const hasSelected = some(Object.values(state), Boolean);
  // console.log(state, Object.values(state));

  return (
    <Dialog
      open={open}
      aria-labelledby="select-properties-title"
      aria-describedby="select-properties-description"
    >
      <DialogTitle id="select-properties-title">Сохранить значения</DialogTitle>
      <DialogContent className={classes.root}>
        <FormFieldSet className={classes.formControl} legend="Укажите свойства для сохранения">
          <FormControlLabel
            key="all"
            control={
              <Checkbox
                checked={names.reduce((acc, [, name]) => acc && state[name], true)}
                value="$all$"
                onChange={changeHandler}
              />
            }
            label="Все свойства"
          />
          {names.map(([id, name, displayName]) => (
            <FormControlLabel
              key={id}
              control={
                <Checkbox checked={state[name] || false} value={name} onChange={changeHandler} />
              }
              label={displayName}
            />
          ))}
        </FormFieldSet>
      </DialogContent>
      <DialogActions>
        {/*
        <Button id="all" color="primary" type="submit" onClick={showDialog}>
          Сохранить все
        </Button>
*/}
        <Button color="primary" type="submit" onClick={showDialog} disabled={!hasSelected}>
          Сохранить
        </Button>
        <Button onClick={closeHandler} color="primary">
          Отмена
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveDialog;
