import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Stack,
} from '@mui/material';
import { Field, Form, Formik } from 'formik';
import React from 'react';

import SubmitListener from '/@common/SubmitListener';

import { usePlayer } from '../api/player';
import updatePlayer from '../api/updatePlayer';
import { useDispatch } from '../store';

import FormikTextField from './FormikTextField';


const keys = ['width', 'height'] as const;

const PlayerSettings: React.FC<{ id?: number }> = ({ id }) => {
  const { data: player } = usePlayer(id);
  const {
    name = '',
    width = 320,
    height = 240,
    disableFadeIn = false,
    disableFadeOut = false,
    autoPlay = false,
  } = player ?? {};
  const dispatch = useDispatch();
  if (!player) return null;
  return (
    <Formik
      initialValues={{ name, width, height, disableFadeIn, disableFadeOut, autoPlay }}
      onSubmit={(values, { setSubmitting }) => {
        id && dispatch(updatePlayer(id, prev => ({ ...prev, ...values })));
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
      {({ values, handleChange }) => (
        <Form id="player">
          <Field name="name" label="Имя" component={FormikTextField} variant="standard" fullWidth />
          <FormControl component="fieldset" margin="normal" fullWidth>
            <FormLabel component="legend">Предпочтительный размер в пикселях</FormLabel>
            <Stack direction="row" gap={4}>
              <Field
                name="width"
                label="Ширина"
                component={FormikTextField}
                variant="standard"
                type="number"
                inputProps={{ min: 4, step: 4 }}
                fullWidth
              />
              <Field
                name="height"
                label="Высота"
                component={FormikTextField}
                variant="standard"
                type="number"
                inputProps={{ min: 4, step: 4 }}
                fullWidth
              />
            </Stack>
          </FormControl>
{/*           <FormControlLabel
            name="autoPlay"
            control={<Checkbox checked={values.autoPlay} onChange={handleChange} />}
            label="Авозапуск"
            /> */}
          <FormControl component="fieldset" margin="normal">
            <FormLabel component="legend">Переходы между роликами</FormLabel>
            <FormGroup>
              <FormControlLabel
                name="disableFadeIn"
                control={<Checkbox checked={values.disableFadeIn} onChange={handleChange} />}
                label="Отключить плавное появление"
              />
              <FormControlLabel
                name="disableFadeOut"
                control={<Checkbox checked={values.disableFadeOut} onChange={handleChange} />}
                label="Отключить плавное исчезание"
              />
            </FormGroup>
          </FormControl>
          <SubmitListener />
        </Form>
      )}
    </Formik>
  );
};

export default React.memo(PlayerSettings);
