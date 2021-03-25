/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import Container from '@material-ui/core/Container';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Checkbox from '@material-ui/core/Checkbox';
import Paper from '@material-ui/core/Paper';
import Select from '@material-ui/core/Select';
import makeStyles from '@material-ui/core/styles/makeStyles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { Address, AddressType } from '@nibus/core';
import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { useDispatch, useSelector } from '../store';
import { selectCurrentTab, selectScreen, setScreenProp } from '../store/currentSlice';
import { selectDisplays } from '../store/sessionsSlice';
import { Screen } from '../util/config';
import { createPropsReducer, FilterNames, toNumber } from '../util/helpers';
import FormFieldSet from './FormFieldSet';

const useStyles = makeStyles(theme => ({
  root: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
  },
  content: {
    height: '100%',
    padding: theme.spacing(1),
  },
  params: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  fieldset: {
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    borderColor: 'rgba(0, 0, 0, 0.23)',
    borderWidth: 1,
    borderStyle: 'solid',
    width: '26ch',
  },
  item: {
    flex: 1,
    '& ~ $item': {
      marginLeft: theme.spacing(2),
    },
    width: '10ch',
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: '23ch',
  },
}));

/*
type ParamProps = {
  id: string;
  name: string;
  value: number | string;
  min?: number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};
*/

/*
const Param: React.FC<ParamProps> = ({ id, name, value, onChange, min = 2 }) => {
  const classes = useStyles();
  return (
    <FormControl className={classes.formControl}>
      <InputLabel htmlFor={id}>{name}</InputLabel>
      <Input
        id={id}
        value={value}
        onChange={onChange}
        type="number"
        inputProps={{
          min,
          step: 2,
        }}
        classes={{ input: classes.input }}
      />
    </FormControl>
  );
};
*/

const toDisplay = (value: string): boolean | string => {
  switch (value.toLowerCase()) {
    case 'true':
      return true;
    case 'false':
      return false;
    default:
      return value;
  }
};

type NumberProps = FilterNames<Required<Screen>, number>;
const screenReducer = createPropsReducer<Record<NumberProps, string>>();

// type Names = keyof TestQuery;

const inputSize = { min: 8, step: 4 };

const TestParams: React.FC = () => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const current = useSelector(selectScreen);
  const displays = useSelector(selectDisplays);
  const isActive = useSelector(selectCurrentTab) === 'tests';
  const [screen, setScreen] = useReducer(screenReducer, {
    width: '',
    height: '',
    moduleHres: '',
    moduleVres: '',
    x: '',
    y: '',
  });
  const [invalidAddress, setInvalidAddress] = useState<string>();
  useEffect(() => {
    Object.entries(current).forEach(([name, value]) =>
      setScreen([name as NumberProps, value?.toString() ?? ''])
    );
  }, [current]);
  const changeNumberHandler = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    e => {
      const { value, id } = e.currentTarget;
      const name = id as NumberProps;
      const res = toNumber(value);
      setScreen([name, value]);
      if (res === undefined || res.toString() === value.trim())
        dispatch(setScreenProp([name, res]));
    },
    [dispatch]
  );
  const [displayChanged, changeHandler, validateAddress, resetError] = useMemo(
    () => [
      (event: React.ChangeEvent<{ value: string }>): void => {
        dispatch(setScreenProp(['display', toDisplay(event.target.value)]));
      },
      (event: React.ChangeEvent<HTMLInputElement>): void => {
        const { value, id, type, checked } = event.target;
        dispatch(setScreenProp([id as keyof Screen, type === 'checkbox' ? checked : value]));
      },
      (event: { target: { value: string | undefined } }): void => {
        try {
          const address = new Address(event.target.value);
          setInvalidAddress(address.type === AddressType.group ? 'Неверный адрес' : undefined);
          // console.log({ address: address.toString() });
        } catch {
          setInvalidAddress('Неверный адрес');
        }
      },
      () => setInvalidAddress(undefined),
    ],
    [dispatch]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => validateAddress({ target: { value: current.address } }), [
    isActive,
    validateAddress,
  ]);
  return (
    <Container maxWidth="md" className={classes.root}>
      <Paper className={classes.content}>
        <div className={classes.params}>
          <FormFieldSet legend="По горизонтали" className={classes.fieldset}>
            <FormControlLabel
              control={<Checkbox checked={!!current.dirh} onChange={changeHandler} id="dirh" />}
              label="Справа налево"
            />
          </FormFieldSet>
          <FormFieldSet legend="По вертикали" className={classes.fieldset}>
            <FormControlLabel
              control={<Checkbox checked={!!current.dirv} onChange={changeHandler} id="dirv" />}
              label="Снизу вверх"
            />
          </FormFieldSet>
          <FormFieldSet legend="Экран" className={classes.fieldset}>
            <TextField
              id="width"
              label="Ширина"
              value={screen.width}
              onChange={changeNumberHandler}
              type="number"
              inputProps={inputSize}
              className={classes.item}
            />
            <TextField
              id="height"
              label="Высота"
              value={screen.height}
              onChange={changeNumberHandler}
              type="number"
              inputProps={inputSize}
              className={classes.item}
            />
          </FormFieldSet>
          <FormFieldSet legend="Модуль" className={classes.fieldset}>
            <TextField
              id="moduleHres"
              label="Ширина"
              value={screen.moduleHres}
              onChange={changeNumberHandler}
              type="number"
              inputProps={inputSize}
              className={classes.item}
            />
            <TextField
              id="moduleVres"
              label="Высота"
              value={screen.moduleVres}
              onChange={changeNumberHandler}
              type="number"
              inputProps={inputSize}
              className={classes.item}
            />
          </FormFieldSet>
          <FormFieldSet legend="Отступ" className={classes.fieldset}>
            <TextField
              id="x"
              label="Слева"
              value={screen.x}
              onChange={changeNumberHandler}
              type="number"
              className={classes.item}
            />
            <TextField
              id="y"
              label="Сверху"
              value={screen.y}
              onChange={changeNumberHandler}
              type="number"
              className={classes.item}
            />
          </FormFieldSet>
        </div>
        <FormControl className={classes.formControl}>
          <InputLabel id="display-label">Дисплей</InputLabel>
          <Select
            labelId="display-label"
            value={(current.display ?? true).toString()}
            onChange={displayChanged}
          >
            <MenuItem value="true">Основной</MenuItem>
            <MenuItem value="false">Второстепенный</MenuItem>
            {displays.map(({ id, bounds, primary, internal }) => (
              <MenuItem value={id.toString()} key={id}>
                <Typography variant="subtitle1">id:{id}&nbsp;</Typography>
                <Typography variant="subtitle2">
                  {bounds.width}x{bounds.height} {primary ? ' основной' : ''}
                  {internal ? ' встроенный' : ''}
                </Typography>
              </MenuItem>
            ))}
            {typeof current.display === 'string' &&
              displays.findIndex(({ id }) => id.toString() === current.display) === -1 && (
                <MenuItem value={current.display}>{current.display} (отключен)</MenuItem>
              )}
          </Select>
        </FormControl>
        <TextField
          id="address"
          className={classes.formControl}
          label="Адрес устройства"
          value={current.address ?? ''}
          onChange={changeHandler}
          onBlur={validateAddress}
          onFocus={resetError}
          error={!!invalidAddress}
          helperText={invalidAddress}
        />
      </Paper>
    </Container>
  );
};

export default React.memo(TestParams);
