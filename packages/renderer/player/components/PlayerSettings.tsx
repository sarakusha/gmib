import ClearIcon from '@mui/icons-material/Clear';
import {
  Box,
  Checkbox,
  Collapse,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
} from '@mui/material';
import { Field, Form, Formik } from 'formik';
import React from 'react';
import { TransitionGroup } from 'react-transition-group';

import FormikTextField from '../../common/FormikTextField';
import SubmitListener from '../../common/SubmitListener';
import { useDisplays } from '../../common/displays';
import { useDeleteMappingMutation, usePlayerMappings } from '../api/mapping';
import { usePlayer } from '../api/player';
import updatePlayer from '../api/updatePlayer';
import usePlayerMappingDialog from '../hooks/usePlayerMappingDialog';
import { useDispatch } from '../store';
import { toHexId } from '../utils';

import { DefaultDisplays, getDisplayLabel } from '/@common/video';


const keys = ['width', 'height'] as const;
const stopPropagation: React.MouseEventHandler = e => e.stopPropagation();
const noWrap = { noWrap: true };

const PlayerSettings: React.FC<{ id?: number }> = ({ id }) => {
  const { player } = usePlayer(id);
  const {
    name = '',
    width = 320,
    height = 240,
    disableFadeIn = false,
    disableFadeOut = false,
    autoPlay = false,
  } = player ?? {};
  const dispatch = useDispatch();
  const { mappings = [] } = usePlayerMappings();
  const { displays = [] } = useDisplays();
  const filtered = mappings.filter(item => item.player === id);
  const getDisplay = (value: number | undefined): string => {
    switch (value) {
      case DefaultDisplays.Primary:
        return 'Основной';
      case DefaultDisplays.Secondary:
        return 'Второстепенный';
      default: {
        const index = displays.findIndex(item => item.id === value);
        if (index === -1) return typeof value === 'number' ? `#${toHexId(value)}` : 'Не задан';
        return getDisplayLabel(displays[index], index);
      }
    }
  };
  const openPlayerMappingDialog = usePlayerMappingDialog();
  const [deleteMapping] = useDeleteMappingMutation();
  if (!player) return null;
  return (
    <Box sx={{ width: 1, height: 1, overflowY: 'auto' }}>
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
            <Field
              name="name"
              label="Имя"
              component={FormikTextField}
              variant="standard"
              fullWidth
            />
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
      <FormLabel component="legend">Области вывода</FormLabel>
      <List>
        <TransitionGroup>
          {filtered.map(item => (
            <Collapse key={item.id}>
              <ListItemButton onClick={() => id && openPlayerMappingDialog(id, item.id)} dense>
                <ListItemText
                  primary={item.name}
                  secondary={`${getDisplay(item.display)} (${item.left},${item.top}-${item.width}x${
                    item.height
                  })`}
                  primaryTypographyProps={noWrap}
                  secondaryTypographyProps={noWrap}
                />
                <ListItemSecondaryAction onClick={stopPropagation} onMouseDown={stopPropagation}>
                  <IconButton size="small" onClick={() => deleteMapping(item.id)}>
                    <ClearIcon fontSize="inherit" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItemButton>
            </Collapse>
          ))}
        </TransitionGroup>
      </List>
    </Box>
  );
};

export default React.memo(PlayerSettings);
