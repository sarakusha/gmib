import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import FormFieldSet from '../components/FormFieldSet';

import { getEnumEntries } from '/@common/helpers';
// import { initialSelectors, Minihost3Selector } from '../util/Minihost3Loader';

type Props = {
  properties: Record<string, number | string>;
  open?: boolean;
  initial?: Set<number>;
  onClose?: (value: Set<number>) => void;
};

// const useStyles = makeStyles(theme => ({
//   root: {
//     display: 'flex',
//   },
//   formControl: {
//     margin: theme.spacing(3),
//   },
// }));

// const getEnumKeys = <Enum extends Record<string, number | string>>(
//   numEnums: Enum
// ): (keyof Enum)[] => getEnumValues(numEnums).map(value => numEnums[value].toString());

const PropertySelectorDialog: React.FC<Props> = ({
  open = false,
  initial = new Set<number>(),
  properties,
  onClose,
}) => {
  const [selector, setSelector] = useState(initial);
  const refInitial = useRef(initial);
  refInitial.current = initial;
  useEffect(() => {
    open && setSelector(refInitial.current);
  }, [open]);
  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    e => {
      const { checked, name } = e.target;
      setSelector(prev => {
        const result = new Set(prev);
        if (checked) result.add(Number(properties[name]));
        else result.delete(Number(properties[name]));
        return result;
      });
    },
    [properties],
  );
  const closeHandler = useCallback(() => onClose && onClose(refInitial.current), [onClose]);
  const saveHandler = useCallback(
    () =>
      onClose &&
      setSelector(current => {
        onClose(current);
        return current;
      }),
    [onClose],
  );
  return (
    <Dialog open={open} aria-labelledby="selector-title">
      <DialogTitle id="selector-title">Выбор переменных для опроса</DialogTitle>
      <DialogContent>
        <Box display="flex">
          <FormFieldSet sx={{ m: 3 }} legend="Доступные переменные">
            <FormGroup>
              {getEnumEntries(properties).map(([name, value]) => (
                <FormControlLabel
                  control={
                    <Checkbox checked={selector.has(value)} onChange={handleChange} name={name} />
                  }
                  label={name}
                  key={name}
                />
              ))}
              {/*
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selector.has(Minihost3Selector.Voltage1)}
                    onChange={handleChange}
                    name="Voltage1"
                  />
                }
                label="Напряжение 1"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selector.has(Minihost3Selector.Voltage2)}
                    onChange={handleChange}
                    name="Voltage2"
                  />
                }
                label="Напряжение 2"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selector.has(Minihost3Selector.Version)}
                    onChange={handleChange}
                    name="Version"
                  />
                }
                label="Версия"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selector.has(Minihost3Selector.RedVertex)}
                    onChange={handleChange}
                    name="RedVertex"
                  />
                }
                label="Красная вершина"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selector.has(Minihost3Selector.GreenVertex)}
                    onChange={handleChange}
                    name="GreenVertex"
                  />
                }
                label="Зеленая вершина"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selector.has(Minihost3Selector.BlueVertex)}
                    onChange={handleChange}
                    name="BlueVertex"
                  />
                }
                label="Голубая вершина"
              />
*/}
            </FormGroup>
          </FormFieldSet>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button color="primary" type="submit" onClick={saveHandler} disabled={!selector.size}>
          Сохранить
        </Button>
        <Button onClick={closeHandler} color="primary">
          Отмена
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PropertySelectorDialog;
