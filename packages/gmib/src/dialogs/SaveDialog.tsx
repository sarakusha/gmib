/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { IDevice } from '@nibus/core/lib/mib';
import React, { useCallback, useMemo, useReducer } from 'react';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import {
  Button,
  Checkbox,
  Dialog, DialogActions,
  DialogContent,
  DialogTitle, FormControlLabel,
} from '@material-ui/core';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import { remote } from 'electron';
import fs from 'fs';
import some from 'lodash/some';
import pick from 'lodash/pick';
import { tuplify } from '../util/helpers';
import FormFieldSet from '../components/FormFieldSet';

const { dialog } = remote;

const styles = (theme: Theme) => createStyles({
  root: {
    display: 'flex',
  },
  formControl: {
    margin: theme.spacing.unit * 3,
  },
});

type Props = {
  device: IDevice,
  open: boolean,
  close: () => void,
};
type InnerProps = Props & WithStyles<typeof styles>;
type Action = {
  name: string,
  value: boolean,
};

const reducer = (state: Record<string, boolean>, { name, value }: Action) =>
  ({
    ...state,
    [name]: value,
  });

const SaveDialog: React.FC<InnerProps> = ({ classes, device, open, close }) => {
  const names = useMemo(
    () => Object.entries<string[]>(Reflect.getMetadata('map', device) || {})
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([id, names]) =>
        tuplify(
          Number(id),
          names[0] as string,
          Reflect.getMetadata('displayName', device, names[0]) as string,
        ))
      .filter(([, name]) => Reflect.getMetadata('isReadable', device, name)
        && Reflect.getMetadata('isWritable', device, name)),
    [device],
  );

  const [state, dispatch] = useReducer(reducer, {});
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
      const mib = Reflect.getMetadata('mib', device);
      const fileName = dialog.showSaveDialog({
        title: 'Сохранить как',
        defaultPath: mib,
        filters: [{
          name: 'JSON',
          extensions: ['json'],
        }],
      });

      if (fileName) {
        const props = event.currentTarget.id === 'all'
          ? names.map(([, name]) => name)
          : Object.entries(state).filter(([, checked]) => checked).map(([name]) => name);
        const data = pick(device, props);
        data.$mib = mib;
        fs.writeFileSync(fileName, JSON.stringify(data));
        close();
      }
    },
    [state],
  );

  const hasSelected = some(Object.values(state), Boolean);

  return (
    <Dialog
      open={open}
      aria-labelledby="select-properties-title"
      aria-describedby="select-properties-description"
    >
      <DialogTitle id="select-properties-title">Сохранить значения</DialogTitle>
      <DialogContent className={classes.root}>
        <FormFieldSet className={classes.formControl} legend="Укажите свойства для сохранения">
          {names.map(([id, name, displayName]) => (
            <FormControlLabel
              key={id}
              control={<Checkbox
                checked={state[name] || false}
                value={name}
                onChange={changeHandler}
              />}
              label={displayName}
            />
          ))}
        </FormFieldSet>
      </DialogContent>
      <DialogActions>
        <Button id="all" color="primary" type="submit" onClick={showDialog}>
          Сохранить все
        </Button>
        <Button color="primary" type="submit" onClick={showDialog} disabled={!hasSelected}>
          Сохранить
        </Button>
        <Button onClick={closeHandler} color="primary">Отмена</Button>
      </DialogActions>
    </Dialog>

  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(SaveDialog);
