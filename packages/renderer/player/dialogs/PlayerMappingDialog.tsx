import { Box, Checkbox, FormControlLabel, FormHelperText, FormLabel, Stack } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { Field, Form, Formik } from 'formik';
import * as React from 'react';

import FormikTextField from '../../common/FormikTextField';
import { useDisplays } from '../../common/displays';

import { DefaultDisplays, getDisplayLabel } from '/@common/video';
import type { ObjectFitMode, PlayerMapping } from '/@common/video';

import {
  useCreateMappingMutation,
  usePlayerMapping,
  useUpdateMappingMutation,
} from '../api/mapping';
import { usePlayer } from '../api/player';
import { toHexId } from '../utils';

type Props = {
  id?: number | null;
  playerId?: number | null;
  open: boolean;
  onClose: () => void;
};

const formId = 'playerMappingForm';

type MappingFormValues = Omit<PlayerMapping, 'id' | 'objectFit'> & {
  id?: number;
  objectFit: ObjectFitMode;
};

const objectFitOptions: Array<{ value: ObjectFitMode; label: string }> = [
  { value: 'cover', label: 'Заполнить область с обрезкой краев' },
  { value: 'contain', label: 'Показать целиком, оставив поля' },
  { value: 'fill', label: 'Растянуть без сохранения пропорций' },
  { value: 'none', label: 'Оставить исходный размер' },
  { value: 'scale-down', label: 'Уменьшать только при необходимости' },
];

const shaderPresets = [
  {
    value: '',
    label: 'Без шейдера',
    source: '',
  },
  {
    value: 'grayscale',
    label: 'Черно-белый',
    source: `float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
return vec4(vec3(luma), color.a);`,
  },
  {
    value: 'soft-contrast',
    label: 'Мягкий контраст',
    source: `vec3 adjusted = smoothstep(0.05, 0.95, color.rgb);
return vec4(adjusted, color.a);`,
  },
  {
    value: 'vignette',
    label: 'Виньетка',
    source: `float distanceFromCenter = distance(uv, vec2(0.5));
float vignette = smoothstep(0.75, 0.25, distanceFromCenter);
return vec4(color.rgb * vignette, color.a);`,
  },
  {
    value: 'scanlines',
    label: 'Скан-линии',
    source: `float line = sin(uv.y * u_sourceResolution.y * 3.14159265);
float brightness = mix(0.82, 1.0, step(0.0, line));
return vec4(color.rgb * brightness, color.a);`,
  },
];

const PlayerMappingDialog: React.FC<Props> = ({ playerId, open, onClose, id }) => {
  const { displays = [] } = useDisplays();
  const { player } = usePlayer(playerId);
  const { mapping } = usePlayerMapping(id);
  const [updateMapping] = useUpdateMappingMutation();
  const [createMapping] = useCreateMappingMutation();
  const validDisplays = [
    ...displays.map(display => display.id),
    DefaultDisplays.None,
    DefaultDisplays.Primary,
    DefaultDisplays.Secondary,
  ];
  return (
    <Dialog open={open && !!playerId} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Окно вывода для <b>{player?.name}</b>
      </DialogTitle>
      <DialogContent>
        {/* <DialogContentText>Укажите параметры окна вывода для {player?.name}</DialogContentText> */}
        <Formik
          initialValues={
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            (mapping
              ? {
                  ...mapping,
                  objectFit: mapping.objectFit ?? 'cover',
                  shader: mapping.shader ?? '',
                }
              : {
                  name: `${player?.name} - Вывод`,
                  player: playerId ?? 0,
                  display: 0,
                  left: 0,
                  top: 0,
                  width: player?.width ?? 320,
                  height: player?.height ?? 240,
                  zOrder: 0,
                  kiosk: false,
                  transparent: false,
                  alwaysOnTop: true,
                  objectFit: 'cover',
                  shader: '',
                }) as MappingFormValues
          }
          onSubmit={async (newValues, { setSubmitting }) => {
            if (!playerId) throw new Error('Unknown player');
            const nextMapping = {
              ...newValues,
              player: playerId,
              shader: newValues.shader?.trim() || undefined,
            };
            if (mapping) await updateMapping({ ...mapping, ...nextMapping });
            else await createMapping(nextMapping);
            setSubmitting(false);
            onClose();
          }}
        >
          {({ values, handleBlur, handleChange, setFieldValue }) => (
            <Form id={formId}>
              <Field name="name" label="Название" component={FormikTextField} fullWidth />
              <FormControl fullWidth margin="normal">
                <InputLabel id="display-label">Дисплей</InputLabel>
                <Select
                  labelId="display-label"
                  id="display"
                  name="display"
                  value={values.display}
                  onBlur={handleBlur}
                  onChange={handleChange}
                  // fullWidth
                  variant="standard"
                >
                  <MenuItem value={DefaultDisplays.None}>Не задан</MenuItem>
                  <MenuItem value={DefaultDisplays.Primary}>Основной</MenuItem>
                  <MenuItem value={DefaultDisplays.Secondary}>Второстепенный</MenuItem>
                  {displays.map((item, index) => (
                    <MenuItem
                      key={item.id}
                      value={item.id}
                      sx={{ fontWeight: item.primary ? 'bold' : 'inherit' }}
                    >
                      {getDisplayLabel(item, index)}
                    </MenuItem>
                  ))}
                  {values.display && !validDisplays.includes(values.display) && (
                    <MenuItem value={values.display}>#{toHexId(values.display)}</MenuItem>
                  )}
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl component="fieldset" sx={{ width: 1 }} margin="normal">
                  <FormLabel component="legend">Положение</FormLabel>
                  <Stack
                    direction="row"
                    sx={{
                      gap: 2,
                    }}
                  >
                    <Field
                      name="left"
                      label="X"
                      type="number"
                      component={FormikTextField}
                      fullWidth
                    />
                    <Field
                      name="top"
                      label="Y"
                      type="number"
                      component={FormikTextField}
                      fullWidth
                    />
                  </Stack>
                </FormControl>
                <FormControl component="fieldset" sx={{ width: 1 }} margin="normal">
                  <FormLabel component="legend">Размер</FormLabel>
                  <Stack
                    direction="row"
                    sx={{
                      gap: 2,
                    }}
                  >
                    <Field
                      name="width"
                      label="Ширина"
                      type="number"
                      component={FormikTextField}
                      fullWidth
                    />
                    <Field
                      name="height"
                      label="Высота"
                      type="number"
                      component={FormikTextField}
                      fullWidth
                    />
                  </Stack>
                </FormControl>
              </Box>
              <FormControl component="fieldset" sx={{ width: 1 }} margin="normal">
                <FormLabel component="legend">Окно</FormLabel>
                <Stack
                  direction="row"
                  sx={{
                    gap: 2,
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox checked={values.kiosk} onChange={handleChange} name="kiosk" />
                    }
                    label="На весь экран"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={values.transparent}
                        onChange={handleChange}
                        name="transparent"
                      />
                    }
                    label="Прозрачность"
                  />
                </Stack>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="alwaysOnTop"
                      checked={values.alwaysOnTop}
                      onChange={handleChange}
                    />
                  }
                  label="Всегда сверху"
                />
                <FormHelperText>
                  На Windows рекомендуется выбрать один из режимов <i>На весь экран</i> или{' '}
                  <i>Прозрачность</i>.
                </FormHelperText>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="object-fit-label">Режим масштабирования</InputLabel>
                  <Select
                    labelId="object-fit-label"
                    id="objectFit"
                    name="objectFit"
                    value={values.objectFit ?? 'cover'}
                    onBlur={handleBlur}
                    onChange={handleChange}
                    variant="standard"
                  >
                    {objectFitOptions.map(option => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    По умолчанию используется режим с заполнением области и обрезкой краев.
                  </FormHelperText>
                </FormControl>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="shader-preset-label">Шейдер</InputLabel>
                  <Select
                    labelId="shader-preset-label"
                    id="shaderPreset"
                    value={
                      shaderPresets.find(item => item.source === (values.shader ?? ''))?.value ??
                      'custom'
                    }
                    onBlur={handleBlur}
                    onChange={event => {
                      const preset = shaderPresets.find(item => item.value === event.target.value);
                      void setFieldValue('shader', preset?.source ?? '');
                    }}
                    variant="standard"
                  >
                    {shaderPresets.map(option => (
                      <MenuItem key={option.value || 'none'} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                    <MenuItem value="custom" disabled>
                      Пользовательский
                    </MenuItem>
                  </Select>
                  <FormHelperText>
                    Можно выбрать заготовку и отредактировать GLSL-код ниже.
                  </FormHelperText>
                </FormControl>
                <Field
                  name="shader"
                  label="Код шейдера"
                  component={FormikTextField}
                  fullWidth
                  multiline
                  minRows={8}
                  margin="normal"
                  placeholder="return color;"
                  helperText="Доступны uv, color, u_time, u_resolution, u_sourceResolution и sampleSource(uv)."
                  slotProps={{
                    input: {
                      sx: {
                        fontFamily: 'monospace',
                        fontSize: 13,
                      },
                    },
                  }}
                />
              </FormControl>
            </Form>
          )}
        </Formik>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button type="submit" form={formId}>
          {id ? 'Сохранить' : 'Добавить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlayerMappingDialog;
