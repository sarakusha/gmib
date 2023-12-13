/* eslint-disable indent,@typescript-eslint/no-explicit-any */
import type { SelectChangeEvent } from '@mui/material';
import { Box, MenuItem, Select } from '@mui/material';
import React, { memo, useCallback, useMemo } from 'react';

import type { PropMetaInfo } from '../store/mibsSlice';
import setDisplayName from '../util/setDisplayName';

import EditCell from './EditCell';
import SerialNoCell from './SerialNoCell';
import TableCell from './TableCell';

import type { ValueState, ValueType } from '/@common/helpers';

const capitalize = <T extends string | undefined>(
  str: T,
): T extends string ? Capitalize<T> : undefined =>
  str && ((str.charAt(0).toUpperCase() + str.slice(1)) as any);

type Props = {
  meta: PropMetaInfo;
  name: string;
  state: ValueState;
  onChangeProperty: (name: string, value: unknown) => void;
};

type CellComponent = React.FunctionComponent<ValueState>;

const PropertyValueCell: React.FC<Props> = ({ meta, name, state, onChangeProperty }) => {
  const cellFactory = useCallback<() => CellComponent>(() => {
    const componentName = capitalize(name);
    const { simpleType, isWritable, enumeration, min, max, convertFrom = x => x } = meta;
    if (!isWritable) {
      return setDisplayName(componentName)(({ value, status, error }: ValueState) => (
        <TableCell
          align="right"
          sx={{ color: status === 'failed' ? 'rgba(255,0,0,0.875) !important' : 'inherit' }}
        >
          {status === 'failed' ? error : value}
        </TableCell>
      ));
    }

    let { step } = meta;
    if (step === undefined) {
      step = simpleType === 'xs:float' || simpleType === 'xs.double' ? 0.01 : 1;
    }
    const selectChanged = (event: SelectChangeEvent<ValueType>): void => {
      onChangeProperty(name, event.target.value);
    };
    const rawValue = ({ error, value }: ValueState): ValueType => error ?? convertFrom(value) ?? '';
    if (enumeration && enumeration.length > 0) {
      return setDisplayName(componentName)(props => {
        const { value, status, error } = props;
        const isDirty = status === 'pending';
        return (
          <TableCell align="right">
            <Select
              variant="standard"
              fullWidth
              disableUnderline
              sx={{
                fontSize: 'inherit',
                fontWeight: isDirty ? 'bold' : 'inherit',
              }}
              value={String(rawValue(props)) || ''}
              onChange={selectChanged}
            >
              {(error || !value) && (
                <MenuItem value={error ?? ''}>
                  <Box
                    component="em"
                    sx={{ color: error ? 'rgba(255,0,0,0.875) !important' : 'inherit' }}
                  >
                    {error ?? 'Не задано'}
                  </Box>
                </MenuItem>
              )}
              {enumeration.map(([key, itemValue]) => (
                <MenuItem key={key} value={String(itemValue)}>
                  {key}
                </MenuItem>
              ))}
            </Select>
          </TableCell>
        );
      });
    }

    if (simpleType === 'xs:unsignedLong' && name === 'serno') {
      return setDisplayName(componentName)(({ value, status }) => (
        <SerialNoCell
          name={name}
          onChangeProperty={onChangeProperty}
          value={(value || '').toString()}
          dirty={status === 'pending'}
          align="right"
        />
      ));
    }

    const type = simpleType === 'xs:string' ? 'text' : 'number';
    return setDisplayName(componentName)(props => (
      <EditCell
        name={name}
        type={type}
        // value={convert(props)}
        value={props.error ? new Error(props.error) : props.value}
        align="right"
        min={min}
        max={max}
        step={step}
        // unit={unit}
        onChangeProperty={onChangeProperty}
        dirty={props.status === 'pending'}
      />
    ));
  }, [meta, name, onChangeProperty]);
  const Cell = useMemo(() => cellFactory(), [cellFactory]);
  return <Cell {...state} />;
};

export default memo(PropertyValueCell);
