import { Checkbox, FormControlLabel, FormLabel, Stack } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
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
    <Dialog open={open && !!playerId} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Окно вывода</DialogTitle>
      <DialogContent>
        <DialogContentText>Укажите параметры окна вывода для {player?.name}</DialogContentText>
        <Formik
          initialValues={
            mapping ?? {
              name: `${player?.name} - Вывод`,
              display: 0,
              left: 0,
              top: 0,
              width: player?.width ?? 320,
              height: player?.height ?? 240,
              zOrder: 0,
              kiosk: false,
              transparent: false,
            }
          }
          onSubmit={async (newValues, { setSubmitting }) => {
            if (!playerId) throw new Error('Unknown player');
            if (mapping) await updateMapping({ ...mapping, ...newValues, player: playerId });
            else await createMapping({ ...newValues, player: playerId });
            setSubmitting(false);
            onClose();
          }}
        >
          {({ values, handleBlur, handleChange }) => (
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
              <FormControl component="fieldset" sx={{ width: 1 }} margin="normal">
                <FormLabel component="legend">Положение</FormLabel>
                <Stack direction="row" gap={2}>
                  <Field
                    name="left"
                    label="X"
                    type="number"
                    component={FormikTextField}
                    fullWidth
                  />
                  <Field name="top" label="Y" type="number" component={FormikTextField} fullWidth />
                </Stack>
              </FormControl>
              <FormControl component="fieldset" sx={{ width: 1 }} margin="normal">
                <FormLabel component="legend">Размер</FormLabel>
                <Stack direction="row" gap={2}>
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
              <FormControl component="fieldset" sx={{ width: 1 }} margin="normal">
                <FormLabel component="legend">Окно</FormLabel>
                <Stack direction="row" gap={2}>
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
