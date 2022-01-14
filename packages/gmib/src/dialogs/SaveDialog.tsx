/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { DeviceId } from '@nibus/core';
import React, { useCallback, useMemo, useReducer } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
} from '@material-ui/core';
import { ipcRenderer } from 'electron';
import fs from 'fs';
import some from 'lodash/some';
import pick from 'lodash/pick';
import sortBy from 'lodash/sortBy';
import sortedUniqBy from 'lodash/sortedUniqBy';
import { useDevice, useSelector } from '../store';
import type { ValueState, ValueType } from '../store/devicesSlice';
import FormFieldSet from '../components/FormFieldSet';
import { selectMibByName } from '../store/mibsSlice';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
  },
  formControl: {
    margin: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
  },
}));

type Props = {
  deviceId?: DeviceId;
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

type PropIds = [id: number, name: string, displayName: string];
const byId = ([id]: PropIds): number => id;
const selectValue = ({ value }: ValueState): ValueType => value;
const extractValues = (props: Record<string, ValueState>): Record<string, ValueType> =>
  Object.fromEntries(
    Object.entries<ValueState>(props).map(([name, state]) => [name, selectValue(state)])
  );

const SaveDialog: React.FC<Props> = ({ deviceId, open, close }) => {
  const classes = useStyles();
  const { mib = 0, props = {} } = useDevice(deviceId) ?? {};
  const meta = useSelector(state => selectMibByName(state, mib));
  const [names, initial] = useMemo(() => {
    const keys: [id: number, name: string, displayName: string][] = meta
      ? sortedUniqBy(
          sortBy(
            Object.entries(meta.properties)
              .filter(([, { isWritable, isReadable }]) => isWritable && isReadable)
              .map<PropIds>(([name, { displayName, id }]) => [id, name, displayName]),
            byId
          ),
          byId
        )
      : [];
    return [
      keys,
      keys.reduce<Record<string, boolean>>((res, [, name]) => ({ ...res, [name]: false }), {}),
    ];
  }, [meta]);

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
        const properties =
          event.currentTarget.id === 'all'
            ? names.map(([, name]) => name)
            : Object.entries(state)
                .filter(([, checked]) => checked)
                .map(([name]) => name);
        const data = extractValues(pick(props, properties));
        data.$mib = mib;
        fs.writeFileSync(fileName, JSON.stringify(data));
        close();
      }
    },
    [close, mib, names, state, props]
  );

  const hasSelected = some(Object.values(state), Boolean);

  return (
    <Dialog
      open={open && !!deviceId}
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
