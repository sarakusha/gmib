import {
  Box,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ChipInput from '@sarakusha/material-ui-chip-input';
import { Field, Form, Formik } from 'formik';
import React, { useCallback } from 'react';

import FormikTextField from '../../common/FormikTextField';
import SubmitListener from '../../common/SubmitListener';
import { useDisplays } from '../../common/displays';
import { updateScreen, useScreen } from '../api/screens';
import { useDispatch } from '../store';

import { DefaultDisplays } from '/@common/video';
import { reAddress } from '/@common/config';
import { reIPv4, toHexId } from '/@common/helpers';

import FormFieldSet from './FormFieldSet';
import { setInvalidState } from '../store/currentSlice';

// import type { Screen } from '/@common/video';

const onBeforeAddress = (value: string): boolean => reAddress.test(value) || reIPv4.test(value);

const FieldSet = styled(FormFieldSet)(({ theme }) => ({
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  borderColor: 'rgba(0, 0, 0, 0.23)',
  borderWidth: 1,
  borderStyle: 'solid',
  width: '26ch',
}));

const StyledFormikTextField = styled(FormikTextField)(({ theme }) => ({
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
// const inputFactor = { min: 0, max: 4, step: 0.01 };

type Props = {
  id: number;
  selected?: number;
  readonly?: boolean;
  single?: boolean;
};

const keys = ['width', 'height'] as const;

const ScreenComponent: React.FC<Props> = ({
  id: scrId,
  selected,
  readonly = true,
  single = true,
}) => {
  const dispatch = useDispatch();
  const { screen } = useScreen(scrId);
  const { displays = [] } = useDisplays();
  const addAddress = useCallback(
    (address: string) => {
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
  const validDisplays = [
    ...displays.map(display => display.id),
    DefaultDisplays.None,
    DefaultDisplays.Primary,
    DefaultDisplays.Secondary,
  ];
  const {
    name = '',
    width = 320,
    height = 240,
    moduleWidth = 40,
    moduleHeight = 40,
    left = 0,
    top = 0,
    display = DefaultDisplays.None,
    addresses = [],
    downToTop = false,
    rightToLeft = false,
    borderTop = 0,
    borderBottom = 0,
    borderLeft = 0,
    borderRight = 0,
    brightnessFactor = 1,
  } = screen ?? {};
  return !screen ? null : (
    <Paper sx={{ height: 1, p: 1, '& > * ~ *': { mt: 1 } }} hidden={scrId !== selected}>
      <Formik
        initialValues={{
          name,
          width,
          height,
          moduleWidth,
          moduleHeight,
          left,
          top,
          display,
          addresses,
          downToTop,
          rightToLeft,
          borderTop,
          borderBottom,
          borderLeft,
          borderRight,
          brightnessFactor,
        }}
        onSubmit={(newValues, { setSubmitting }) => {
          dispatch(updateScreen(scrId, prev => ({ ...prev, ...newValues })));
          setSubmitting(false);
        }}
        validate={props => {
          const errs: Partial<Record<keyof typeof props, string>> = {};
          if (!props.name.trim()) errs.name = 'Требуется';
          keys.forEach(key => {
            if (props[key] < 4) errs[key] = 'Должно быть не меньше 4';
            else if (props[key] % 2 !== 0) errs[key] = 'Должно быть четным';
          });
          return errs;
        }}
        enableReinitialize
      >
        {({ values, handleChange, handleBlur, isValid }) => {
          if (selected === scrId) dispatch(setInvalidState(!isValid));
          return (
            <Form id="screen">
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <FieldSet legend="Название" disabled={readonly}>
                  <Field name="name" component={FormikTextField} fullWidth disabled={readonly} />
                </FieldSet>
                <FieldSet
                  legend="Коэффициент автояркости"
                  disabled={readonly}
                  title="Применяется при использовании нескольких типов экранов"
                >
                  <Field
                    name="brightnessFactor"
                    component={FormikTextField}
                    type="number"
                    fullWidth
                    disabled={readonly || single}
                  />
                </FieldSet>
                <FieldSet legend="По горизонтали" disabled={readonly} title="Порядок модулей">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={!!values.rightToLeft}
                        onChange={handleChange}
                        name="rightToLeft"
                      />
                    }
                    label="Справа налево"
                  />
                </FieldSet>
                <FieldSet legend="По вертикали" disabled={readonly} title="Порядок модулей">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={!!values.downToTop}
                        onChange={handleChange}
                        id="downToTop"
                      />
                    }
                    label="Снизу вверх"
                  />
                </FieldSet>
                <FieldSet legend="Экран" title="Размеры в пикселях">
                  <Field
                    variant="standard"
                    name="width"
                    label="Ширина"
                    type="number"
                    component={StyledFormikTextField}
                    inputProps={inputSize}
                    disabled={readonly}
                  />
                  <Field
                    variant="standard"
                    name="height"
                    label="Высота"
                    type="number"
                    component={StyledFormikTextField}
                    inputProps={inputSize}
                    disabled={readonly}
                  />
                </FieldSet>
                <FieldSet legend="Модуль" title="Размеры в пикселях">
                  <Field
                    variant="standard"
                    name="moduleWidth"
                    label="Ширина"
                    type="number"
                    component={StyledFormikTextField}
                    inputProps={inputSize}
                    disabled={readonly}
                  />
                  <Field
                    variant="standard"
                    name="moduleHeight"
                    label="Высота"
                    type="number"
                    component={StyledFormikTextField}
                    inputProps={inputSize}
                    disabled={readonly}
                  />
                </FieldSet>
                <FieldSet legend="Рамка">
                  <Field
                    variant="standard"
                    name="borderLeft"
                    label="Слева"
                    type="number"
                    component={StyledFormikTextField}
                    disabled={readonly}
                  />
                  <Field
                    variant="standard"
                    name="borderRight"
                    label="Справа"
                    type="number"
                    component={StyledFormikTextField}
                    disabled={readonly}
                  />
                </FieldSet>
                <FieldSet legend="Рамка">
                  <Field
                    variant="standard"
                    name="borderTop"
                    label="Сверху"
                    type="number"
                    component={StyledFormikTextField}
                    disabled={readonly}
                  />
                  <Field
                    variant="standard"
                    name="borderBottom"
                    label="Снизу"
                    type="number"
                    component={StyledFormikTextField}
                    disabled={readonly}
                  />
                </FieldSet>
                <FieldSet legend="Отступ" title="Отступ изображения от края монитора">
                  <Field
                    variant="standard"
                    name="left"
                    label="Слева"
                    type="number"
                    component={StyledFormikTextField}
                    disabled={readonly}
                  />
                  <Field
                    variant="standard"
                    name="top"
                    label="Сверху"
                    type="number"
                    component={StyledFormikTextField}
                    disabled={readonly}
                  />
                </FieldSet>
                <FieldSet legend="Дисплей" disabled={readonly}>
                  <Select
                    variant="standard"
                    labelId="display-label"
                    value={values.display}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    fullWidth
                    name="display"
                  >
                    <MenuItem value={DefaultDisplays.None}>Не задан</MenuItem>
                    <MenuItem value={DefaultDisplays.Primary}>Основной</MenuItem>
                    <MenuItem value={DefaultDisplays.Secondary}>Второстепенный</MenuItem>
                    {displays.map(({ id, bounds, primary, internal }) => (
                      <MenuItem value={id} key={id}>
                        <Typography variant="subtitle1" noWrap>
                          #{toHexId(id)}&nbsp;
                          <small>
                            {bounds.width}x{bounds.height} {primary ? ' основной' : ''}
                            {internal ? ' встроенный' : ''}
                          </small>
                        </Typography>
                      </MenuItem>
                    ))}
                    {values.display && !validDisplays.includes(values.display) && (
                      <MenuItem value={values.display}>
                        #{toHexId(values.display)} (отключен)
                      </MenuItem>
                    )}
                  </Select>
                </FieldSet>
              </Box>

              <ChipInput
                label="Адреса минихостов"
                value={values.addresses}
                onBeforeAdd={onBeforeAddress}
                onAdd={addAddress}
                onDelete={removeAddress}
                // alwaysShowPlaceholder
                placeholder="address+X,Y:WxH"
                fullWidth
                disabled={readonly}
              />
              <SubmitListener />
            </Form>
          );
        }}
      </Formik>
    </Paper>
  );
};

export default React.memo(ScreenComponent);
