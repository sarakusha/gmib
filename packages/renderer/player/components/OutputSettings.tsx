import type { TextFieldProps } from '@mui/material';
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  Stack,
  TextField,
} from '@mui/material';
import React from 'react';

import { getDisplayLabel } from '/@common/video';

import { useDisplay } from '../../common/displays';
import { toHexId } from '../utils';

type Props = {
  id?: number;
  index?: number;
};

const readonly = { readOnly: true };

const ReadonlyField = React.forwardRef<HTMLDivElement, React.PropsWithoutRef<TextFieldProps>>(
  (props, ref) => (
    <TextField
      aria-readonly
      fullWidth
      margin="dense"
      disabled
      inputProps={readonly}
      ref={ref}
      {...props}
    />
  ),
);

const OutputSettings: React.FC<Props> = ({ id, index = 0 }) => {
  const { display = null } = useDisplay(id);
  return (
    display && (
      <FormControl component="fieldset" sx={{ width: 1 }}>
        <FormLabel component="legend">Дисплей #{toHexId(display.id)}</FormLabel>
        <TextField name="name" value={getDisplayLabel(display, index)} label="Имя" />
        <Stack direction="row" gap={2}>
          <ReadonlyField name="width" label="Ширина" value={display.bounds.width} />
          <ReadonlyField name="height" label="Высота" value={display.bounds.height} />
        </Stack>
        <Stack direction="row" gap={2}>
          <ReadonlyField name="x" label="X" value={display.bounds.x} />
          <ReadonlyField name="y" label="Y" value={display.bounds.y} />
        </Stack>
        <Stack direction="row" gap={2}>
          <FormControlLabel
            label="Основной"
            disabled
            control={<Checkbox checked={display.primary} />}
            sx={{ flex: 1 }}
          />
          <FormControlLabel
            label="Встроенный"
            disabled
            control={<Checkbox checked={display.internal} />}
            sx={{ flex: 1 }}
          />
        </Stack>
      </FormControl>
    )
  );
};

export default OutputSettings;
