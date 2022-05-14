import type {
  SelectChangeEvent} from '@mui/material';
import {
  Box,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import type { AnyAction } from '@reduxjs/toolkit';
import ChipInput from '@sarakusha/material-ui-chip-input';
import React, { useCallback, useMemo } from 'react';

import { useDispatch, useSelector } from '../store';
import { addAddress, removeAddress, setScreenProp } from '../store/configSlice';
import {selectDisplays, selectScreenById} from '../store/selectors';

import type { Screen} from '/@common/config';
import { reAddress } from '/@common/config';
import { toNumber } from '/@common/helpers';

import useDelayUpdate from '../util/useDelayUpdate';

import FormFieldSet from './FormFieldSet';

// const useStyles = makeStyles(theme => ({
//   content: {
//     height: '100%',
//     padding: theme.spacing(1),
//     '& > * ~ *': {
//       marginTop: theme.spacing(1),
//     },
//   },
//   params: {
//     display: 'flex',
//     flexWrap: 'wrap',
//     gap: theme.spacing(1),
//     // justifyContent: 'center',
//   },
//   fieldset: {
//     padding: theme.spacing(1),
//     borderRadius: theme.shape.borderRadius,
//     borderColor: 'rgba(0, 0, 0, 0.23)',
//     borderWidth: 1,
//     borderStyle: 'solid',
//     width: '26ch',
//   },
//   item: {
//     flex: 1,
//     '& ~ $item': {
//       marginLeft: theme.spacing(2),
//     },
//     width: '10ch',
//   },
//   // formControl: {
//   //   margin: theme.spacing(1),
//   //   minWidth: '23ch',
//   // },
// }));

const FieldSet = styled(FormFieldSet)(({ theme }) => ({
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  borderColor: 'rgba(0, 0, 0, 0.23)',
  borderWidth: 1,
  borderStyle: 'solid',
  width: '26ch',
}));

const Field = styled(TextField)(({ theme }) => ({
  flex: 1,
  '& ~ &': {
    marginLeft: theme.spacing(2),
  },
  width: '10ch',
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

const ScreenComponent: React.FC<Props> = ({
  id: scrId,
  selected,
  readonly = true,
  single = true,
}) => {
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
    [dispatch, scrId],
  );
  const [displayChanged, changeHandler, onBeforeAddAddress, setName] = useMemo(
    () => [
      (event: SelectChangeEvent): void => {
        dispatch(setScreenProp([scrId, ['display', toDisplay(`${event.target.value}`)]]));
      },
      (event: React.ChangeEvent<HTMLInputElement>): void => {
        const { value, id, type, checked } = event.target;
        dispatch(
          setScreenProp([scrId, [id as keyof Screen, type === 'checkbox' ? checked : value]]),
        );
      },
      (value: string): boolean => reAddress.test(value),
      (value: string): AnyAction => setScreenProp([scrId, ['name', value]]),
    ],
    [dispatch, scrId],
  );
  const [name, nameChanged] = useDelayUpdate(current?.name ?? '', setName);
  return !current ? null : (
    <Paper sx={{ height: 1, p: 1, '& > * ~ *': { mt: 1 } }} hidden={scrId !== selected}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <FieldSet legend="Название" disabled={readonly}>
          <TextField
            id="name"
            value={name}
            onChange={nameChanged}
            fullWidth
            disabled={readonly}
            variant="standard"
          />
        </FieldSet>
        <FieldSet
          legend="Коэффициент яркости"
          disabled={readonly}
          title="Применяется при использовании нескольких типов экранов"
        >
          <TextField
            variant="standard"
            id="brightnessFactor"
            value={current.brightnessFactor}
            type="number"
            inputProps={inputFactor}
            onChange={changeNumberHandler}
            fullWidth
            disabled={readonly || single}
          />
        </FieldSet>
        <FieldSet legend="По горизонтали" disabled={readonly} title="Порядок модулей">
          <FormControlLabel
            control={<Checkbox checked={!!current.dirh} onChange={changeHandler} id="dirh" />}
            label="Справа налево"
          />
        </FieldSet>
        <FieldSet legend="По вертикали" disabled={readonly} title="Порядок модулей">
          <FormControlLabel
            control={<Checkbox checked={!!current.dirv} onChange={changeHandler} id="dirv" />}
            label="Сверху вниз"
          />
        </FieldSet>
        <FieldSet legend="Экран" title="Размеры в пикселях">
          <Field
            variant="standard"
            id="width"
            label="Ширина"
            value={current.width ?? ''}
            onChange={changeNumberHandler}
            type="number"
            inputProps={inputSize}
            disabled={readonly}
          />
          <Field
            variant="standard"
            id="height"
            label="Высота"
            value={current.height ?? ''}
            onChange={changeNumberHandler}
            type="number"
            inputProps={inputSize}
            disabled={readonly}
          />
        </FieldSet>
        <FieldSet legend="Модуль" title="Размеры в пикселях">
          <Field
            variant="standard"
            id="moduleHres"
            label="Ширина"
            value={current.moduleHres ?? ''}
            onChange={changeNumberHandler}
            type="number"
            inputProps={inputSize}
            disabled={readonly}
          />
          <Field
            variant="standard"
            id="moduleVres"
            label="Высота"
            value={current.moduleVres ?? ''}
            onChange={changeNumberHandler}
            type="number"
            inputProps={inputSize}
            disabled={readonly}
          />
        </FieldSet>
        <FieldSet legend="Рамка">
          <Field
            variant="standard"
            id="borderLeft"
            label="Слева"
            value={current.borderLeft ?? ''}
            onChange={changeNumberHandler}
            type="number"
            disabled={readonly}
          />
          <Field
            variant="standard"
            id="borderRight"
            label="Справа"
            value={current.borderRight ?? ''}
            onChange={changeNumberHandler}
            type="number"
            disabled={readonly}
          />
        </FieldSet>
        <FieldSet legend="Рамка">
          <Field
            variant="standard"
            id="borderTop"
            label="Сверху"
            value={current.borderTop ?? ''}
            onChange={changeNumberHandler}
            type="number"
            disabled={readonly}
          />
          <Field
            variant="standard"
            id="borderBottom"
            label="Снизу"
            value={current.borderBottom ?? ''}
            onChange={changeNumberHandler}
            type="number"
            disabled={readonly}
          />
        </FieldSet>
        <FieldSet legend="Отступ" title="Отступ изображения от края монитора">
          <Field
            variant="standard"
            id="x"
            label="Слева"
            value={current.x ?? ''}
            onChange={changeNumberHandler}
            type="number"
            disabled={readonly}
          />
          <Field
            variant="standard"
            id="y"
            label="Сверху"
            value={current.y ?? ''}
            onChange={changeNumberHandler}
            type="number"
            disabled={readonly}
          />
        </FieldSet>
        <FieldSet legend="Дисплей" disabled={readonly}>
          <Select
            variant="standard"
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
        </FieldSet>
      </Box>

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

export default React.memo(ScreenComponent);
