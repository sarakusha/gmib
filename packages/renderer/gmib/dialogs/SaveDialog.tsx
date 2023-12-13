import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
} from '@mui/material';
import type { DeviceId } from '@nibus/core';
import pick from 'lodash/pick';
import some from 'lodash/some';
import sortBy from 'lodash/sortBy';
import sortedUniqBy from 'lodash/sortedUniqBy';
import React, { useCallback, useMemo, useReducer } from 'react';

import FormFieldSet from '../components/FormFieldSet';
import { useDevice, useSelector } from '../store';
import { selectMibByName } from '../store/selectors';

import type { ValueState, ValueType } from '/@common/helpers';

// const useStyles = makeStyles(theme => ({
//   root: {
//     display: 'flex',
//   },
//   formControl: {
//     margin: theme.spacing(3),
//     display: 'flex',
//     flexDirection: 'column',
//   },
// }));

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
    return Object.keys(state).reduce<State>(
      (result, key) => ({
        ...result,
        [key]: value,
      }),
      {},
    );
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
    Object.entries<ValueState>(props).map(([name, state]) => [name, selectValue(state)]),
  );

const SaveDialog: React.FC<Props> = ({ deviceId, open, close }) => {
  const { mib = '', props = {} } = useDevice(deviceId) ?? {};
  const meta = useSelector(state => selectMibByName(state, mib));
  const [names, initial] = useMemo(() => {
    const keys: [id: number, name: string, displayName: string][] = meta
      ? sortedUniqBy(
          sortBy(
            Object.entries(meta.properties)
              .filter(([, { isWritable, isReadable }]) => isWritable && isReadable)
              .map<PropIds>(([name, { displayName, id }]) => [id, name, displayName]),
            byId,
          ),
          byId,
        )
      : [];
    return [
      keys,
      keys.reduce<Record<string, boolean>>(
        (res, [, name]) => ({
          ...res,
          [name]: false,
        }),
        {},
      ),
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
    [dispatch],
  );
  const closeHandler = useCallback(() => close(), [close]);
  const showDialog = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const properties =
        event.currentTarget.id === 'all'
          ? names.map(([, name]) => name)
          : Object.entries(state)
              .filter(([, checked]) => checked)
              .map(([name]) => name);
      const data = extractValues(pick(props, properties));
      data.$mib = mib;
      window.dialogs.saveJSON({ data, defaultPath: mib });
      // deviceId  && window.nibus.saveRawData(deviceId);
      close();
    },
    [close, mib, names, state, props],
  );

  const hasSelected = some(Object.values(state), Boolean);

  return (
    <Dialog
      open={open && !!deviceId}
      aria-labelledby="select-properties-title"
      aria-describedby="select-properties-description"
    >
      <DialogTitle id="select-properties-title">Сохранить значения</DialogTitle>
      <DialogContent sx={{ display: 'flex' }}>
        <FormFieldSet
          sx={{ m: 3, display: 'flex', flexDirection: 'column' }}
          legend="Укажите свойства для сохранения"
        >
          <FormControlLabel
            key="all"
            control={
              <Checkbox
                checked={names.reduce<boolean>(
                  (acc, [, name]) => Boolean(acc && state[name]),
                  true,
                )}
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
