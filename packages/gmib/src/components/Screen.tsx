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
  FormControlLabel,
  MenuItem,
  Checkbox,
  Paper,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';
import { AnyAction } from '@reduxjs/toolkit';
import ChipInput from 'material-ui-chip-input';
import React, { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from '../store';
import { addAddress, removeAddress, selectScreenById, setScreenProp } from '../store/configSlice';
import { selectDisplays } from '../store/sessionsSlice';
import { reAddress, Screen } from '../util/config';
import { toNumber } from '../util/helpers';
import useDelayUpdate from '../util/useDelayUpdate';
import FormFieldSet from './FormFieldSet';

const useStyles = makeStyles(theme => ({
  content: {
    height: '100%',
    padding: theme.spacing(1),
    '& > * ~ *': {
      marginTop: theme.spacing(1),
    },
  },
  params: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    // justifyContent: 'center',
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
  // formControl: {
  //   margin: theme.spacing(1),
  //   minWidth: '23ch',
  // },
}));

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

// type NumberProps = FilterNames<Required<Screen>, number>;
// const screenReducer = createPropsReducer<Record<NumberProps, string>>();

const inputSize = { min: 8, step: 4 };
const inputFactor = { min: 0, max: 4, step: 0.01 };

type Props = {
  id: string;
  selected?: string;
  readonly?: boolean;
  single?: boolean;
};

const Screen: React.FC<Props> = ({ id: scrId, selected, readonly = true, single = true }) => {
  const classes = useStyles();
  const dispatch = useDispatch();
  const current = useSelector(state => selectScreenById(state, scrId));
  const displays = useSelector(selectDisplays);
  // const [name, setName] = useState(current?.name ?? '');
  const changeNumberHandler = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    e => {
      const { value, id } = e.currentTarget;
      const res = toNumber(value);
      if (res === undefined || res.toString() === value.trim())
        dispatch(setScreenProp([scrId, [id as keyof Screen, res]]));
    },
    [dispatch, scrId]
  );
  const [displayChanged, changeHandler, onBeforeAddAddress, setName] = useMemo(
    () => [
      (event: React.ChangeEvent<{ value: string }>): void => {
        dispatch(setScreenProp([scrId, ['display', toDisplay(event.target.value)]]));
      },
      (event: React.ChangeEvent<HTMLInputElement>): void => {
        const { value, id, type, checked } = event.target;
        dispatch(
          setScreenProp([scrId, [id as keyof Screen, type === 'checkbox' ? checked : value]])
        );
      },
      (value: string): boolean => reAddress.test(value),
      (value: string): AnyAction => setScreenProp([scrId, ['name', value]]),
    ],
    [dispatch, scrId]
  );
  const [name, nameChanged] = useDelayUpdate(current?.name ?? '', setName);
  return !current ? null : (
    <Paper className={classes.content} hidden={scrId !== selected}>
      <div className={classes.params}>
        <FormFieldSet legend="Название" className={classes.fieldset} disabled={readonly}>
          <TextField id="name" value={name} onChange={nameChanged} fullWidth disabled={readonly} />
        </FormFieldSet>
        <FormFieldSet
          legend="Коэффициент яркости"
          className={classes.fieldset}
          disabled={readonly}
          title="Применяется при использовании нескольких типов экранов"
        >
          <TextField
            id="brightnessFactor"
            value={current.brightnessFactor}
            type="number"
            inputProps={inputFactor}
            onChange={changeNumberHandler}
            fullWidth
            disabled={readonly || single}
          />
        </FormFieldSet>
        <FormFieldSet
          legend="По горизонтали"
          className={classes.fieldset}
          disabled={readonly}
          title="Порядок модулей"
        >
          <FormControlLabel
            control={<Checkbox checked={!!current.dirh} onChange={changeHandler} id="dirh" />}
            label="Справа налево"
          />
        </FormFieldSet>
        <FormFieldSet
          legend="По вертикали"
          className={classes.fieldset}
          disabled={readonly}
          title="Порядок модулей"
        >
          <FormControlLabel
            control={<Checkbox checked={!!current.dirv} onChange={changeHandler} id="dirv" />}
            label="Снизу вверх"
          />
        </FormFieldSet>
        <FormFieldSet legend="Экран" className={classes.fieldset} title="Размеры в пикселях">
          <TextField
            id="width"
            label="Ширина"
            value={current.width ?? ''}
            onChange={changeNumberHandler}
            type="number"
            inputProps={inputSize}
            className={classes.item}
            disabled={readonly}
          />
          <TextField
            id="height"
            label="Высота"
            value={current.height ?? ''}
            onChange={changeNumberHandler}
            type="number"
            inputProps={inputSize}
            className={classes.item}
            disabled={readonly}
          />
        </FormFieldSet>
        <FormFieldSet legend="Модуль" className={classes.fieldset} title="Размеры в пикселях">
          <TextField
            id="moduleHres"
            label="Ширина"
            value={current.moduleHres ?? ''}
            onChange={changeNumberHandler}
            type="number"
            inputProps={inputSize}
            className={classes.item}
            disabled={readonly}
          />
          <TextField
            id="moduleVres"
            label="Высота"
            value={current.moduleVres ?? ''}
            onChange={changeNumberHandler}
            type="number"
            inputProps={inputSize}
            className={classes.item}
            disabled={readonly}
          />
        </FormFieldSet>
        <FormFieldSet legend="Рамка" className={classes.fieldset}>
          <TextField
            id="borderLeft"
            label="Слева"
            value={current.borderLeft ?? ''}
            onChange={changeNumberHandler}
            type="number"
            className={classes.item}
            disabled={readonly}
          />
          <TextField
            id="borderRight"
            label="Справа"
            value={current.borderRight ?? ''}
            onChange={changeNumberHandler}
            type="number"
            className={classes.item}
            disabled={readonly}
          />
        </FormFieldSet>
        <FormFieldSet legend="Рамка" className={classes.fieldset}>
          <TextField
            id="borderTop"
            label="Сверху"
            value={current.borderTop ?? ''}
            onChange={changeNumberHandler}
            type="number"
            className={classes.item}
            disabled={readonly}
          />
          <TextField
            id="borderBottom"
            label="Снизу"
            value={current.borderBottom ?? ''}
            onChange={changeNumberHandler}
            type="number"
            className={classes.item}
            disabled={readonly}
          />
        </FormFieldSet>
        <FormFieldSet
          legend="Отступ"
          className={classes.fieldset}
          title="Отступ изображения от края монитора"
        >
          <TextField
            id="x"
            label="Слева"
            value={current.x ?? ''}
            onChange={changeNumberHandler}
            type="number"
            className={classes.item}
            disabled={readonly}
          />
          <TextField
            id="y"
            label="Сверху"
            value={current.y ?? ''}
            onChange={changeNumberHandler}
            type="number"
            className={classes.item}
            disabled={readonly}
          />
        </FormFieldSet>
        <FormFieldSet legend="Дисплей" className={classes.fieldset} disabled={readonly}>
          <Select
            labelId="display-label"
            value={(current.display ?? true).toString()}
            onChange={displayChanged}
            fullWidth
          >
            <MenuItem value="true">Основной</MenuItem>
            <MenuItem value="false">Второстепенный</MenuItem>
            {displays.map(({ id, bounds, primary, internal }) => (
              <MenuItem value={id.toString()} key={id}>
                <Typography variant="subtitle1" noWrap>
                  id:{id}&nbsp;
                </Typography>
                <Typography variant="subtitle2" noWrap>
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
        </FormFieldSet>
      </div>

      <ChipInput
        label="Адреса минихостов"
        value={current.addresses}
        onBeforeAdd={onBeforeAddAddress}
        onAdd={chip => dispatch(addAddress([scrId, chip]))}
        onDelete={(chip, index) => dispatch(removeAddress([scrId, chip, index]))}
        // alwaysShowPlaceholder
        placeholder="address+X,Y:WxH"
        fullWidth
        disabled={readonly}
      />
    </Paper>
  );
};

export default React.memo(Screen);
