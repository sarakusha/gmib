import { Box, Checkbox, FormControlLabel, Paper, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import ChipInput from '@sarakusha/material-ui-chip-input';
import React, { useCallback } from 'react';

import { selectScreen, updateScreen, useGetScreensQuery } from '../api/screens';
import { useDispatch } from '../store';

import { reAddress } from '/@common/config';
import { toNumber } from '/@common/helpers';

import FormFieldSet from './FormFieldSet';

// import type { Screen } from '/@common/video';

const onBeforeAddress = (value: string): boolean => reAddress.test(value);

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

/*
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
*/

// type NumberProps = FilterNames<Required<Screen>, number>;
// const screenReducer = createPropsReducer<Record<NumberProps, string>>();

const inputSize = { min: 8, step: 4 };
const inputFactor = { min: 0, max: 4, step: 0.01 };

type Props = {
  id: number;
  selected?: number;
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
  const { data: screensData } = useGetScreensQuery();
  const current = screensData && selectScreen(screensData, scrId);
  // const refScreen = useRef<any>();
  // refScreen.current = current;
  const changeHandler = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    e => {
      const { value, id, type, checked } = e.target;
      // console.log({ id, value, type, checked });
      // const scr = { ...refScreen.current };
      let newValue: unknown = value;
      switch (type) {
        case 'number': {
          const res = toNumber(value);
          if (res === undefined || res.toString() === value.trim()) newValue = res;
          break;
        }
        case 'checkbox':
          newValue = checked;
          break;
        default:
          newValue = value;
          break;
      }
      dispatch(updateScreen(scrId, prev => ({ ...prev, [id]: newValue })));
    },
    [dispatch, scrId],
  );
  const addAddress = useCallback(
    (address: string) => {
      // const { addresses = [], ...other } = refScreen.current as Screen;
      dispatch(
        updateScreen(scrId, prev => ({ ...prev, addresses: [...(prev.addresses ?? []), address] })),
      );
    },
    [dispatch, scrId],
  );
  const removeAddress = useCallback(
    (address: string, index: number) => {
      dispatch(
        updateScreen(scrId, prev => {
          if (prev.addresses?.[index] === address) {
            const draft = [...prev.addresses];
            draft.splice(index, 1);
            return { ...prev, addresses: draft };
          }
          return prev;
        }),
      );
    },
    [dispatch, scrId],
  );
  // const current = useSelector(state => selectScreen(state, scrId));
  // const displays = useSelector(selectDisplays);
  // const [name, setName] = useState(current?.name ?? '');
  // const changeNumberHandler = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
  //   e => {
  //     const { value, id } = e.currentTarget;
  //     const res = toNumber(value);
  //     if (res === undefined || res.toString() === value.trim())
  //       dispatch(setScreenProp([scrId, [id as keyof Screen, res]]));
  //   },
  //   [dispatch, scrId],
  // );
  // const [/* displayChanged, */ changeHandler, onBeforeAddAddress, setName] = useMemo(
  //   () => [
  //     // (event: SelectChangeEvent): void => {
  //     //   dispatch(setScreenProp([scrId, ['display', toDisplay(`${event.target.value}`)]]));
  //     // },
  //     (event: React.ChangeEvent<HTMLInputElement>): void => {
  //       const { value, id, type, checked } = event.target;
  //       dispatch(
  //         setScreenProp([scrId, [id as keyof Screen, type === 'checkbox' ? checked : value]]),
  //       );
  //     },
  //     (value: string): boolean => reAddress.test(value),
  //     (value: string): AnyAction => setScreenProp([scrId, ['name', value]]),
  //   ],
  //   [dispatch, scrId],
  // );
  // const [name, nameChanged] = useDelayUpdate(current?.name ?? '', setName);
  return !current ? null : (
    <Paper sx={{ height: 1, p: 1, '& > * ~ *': { mt: 1 } }} hidden={scrId !== selected}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <FieldSet legend="Название" disabled={readonly}>
          <TextField
            id="name"
            value={current.name}
            onChange={changeHandler}
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
            onChange={changeHandler}
            fullWidth
            disabled={readonly || single}
          />
        </FieldSet>
        <FieldSet legend="По горизонтали" disabled={readonly} title="Порядок модулей">
          <FormControlLabel
            control={
              <Checkbox checked={!!current.rightToLeft} onChange={changeHandler} id="rightToLeft" />
            }
            label="Справа налево"
          />
        </FieldSet>
        <FieldSet legend="По вертикали" disabled={readonly} title="Порядок модулей">
          <FormControlLabel
            control={
              <Checkbox checked={!!current.downToTop} onChange={changeHandler} id="downToTop" />
            }
            label="Сверху вниз"
          />
        </FieldSet>
        <FieldSet legend="Экран" title="Размеры в пикселях">
          <Field
            variant="standard"
            id="width"
            label="Ширина"
            value={current.width ?? ''}
            onChange={changeHandler}
            type="number"
            inputProps={inputSize}
            disabled={readonly}
          />
          <Field
            variant="standard"
            id="height"
            label="Высота"
            value={current.height ?? ''}
            onChange={changeHandler}
            type="number"
            inputProps={inputSize}
            disabled={readonly}
          />
        </FieldSet>
        <FieldSet legend="Модуль" title="Размеры в пикселях">
          <Field
            variant="standard"
            id="moduleWidth"
            label="Ширина"
            value={current.moduleWidth ?? ''}
            onChange={changeHandler}
            type="number"
            inputProps={inputSize}
            disabled={readonly}
          />
          <Field
            variant="standard"
            id="moduleHeight"
            label="Высота"
            value={current.moduleHeight ?? ''}
            onChange={changeHandler}
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
            onChange={changeHandler}
            type="number"
            disabled={readonly}
          />
          <Field
            variant="standard"
            id="borderRight"
            label="Справа"
            value={current.borderRight ?? ''}
            onChange={changeHandler}
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
            onChange={changeHandler}
            type="number"
            disabled={readonly}
          />
          <Field
            variant="standard"
            id="borderBottom"
            label="Снизу"
            value={current.borderBottom ?? ''}
            onChange={changeHandler}
            type="number"
            disabled={readonly}
          />
        </FieldSet>
        <FieldSet legend="Отступ" title="Отступ изображения от края монитора">
          <Field
            variant="standard"
            id="x"
            label="Слева"
            value={current.left ?? ''}
            onChange={changeHandler}
            type="number"
            disabled={readonly}
          />
          <Field
            variant="standard"
            id="y"
            label="Сверху"
            value={current.top ?? ''}
            onChange={changeHandler}
            type="number"
            disabled={readonly}
          />
        </FieldSet>
        {/*
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
*/}
      </Box>

      <ChipInput
        label="Адреса минихостов"
        value={current.addresses}
        onBeforeAdd={onBeforeAddress}
        onAdd={addAddress}
        onDelete={removeAddress}
        // alwaysShowPlaceholder
        placeholder="address+X,Y:WxH"
        fullWidth
        disabled={readonly}
      />
    </Paper>
  );
};

export default React.memo(ScreenComponent);
