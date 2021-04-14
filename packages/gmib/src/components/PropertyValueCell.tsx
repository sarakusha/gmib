/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

/* eslint-disable indent,@typescript-eslint/no-explicit-any */
import { makeStyles } from '@material-ui/core/styles';
import { Select, MenuItem } from '@material-ui/core';
import React, { memo, useCallback, useMemo } from 'react';
import classNames from 'classnames';
import { ValueState, ValueType } from '../store/devicesSlice';
import { PropMetaInfo } from '../store/mibsSlice';
import setDisplayName from '../util/setDisplayName';
import TableCell from './TableCell';
import EditCell from './EditCell';
import SerialNoCell from './SerialNoCell';

const capitalize = (str?: string): string | undefined =>
  str && str.charAt(0).toUpperCase() + str.slice(1);

// const safeParseNumber = ({ value }: ValueState): number => parseFloat(value as string) || 0;

const useStyles = makeStyles(_theme => ({
  select: {
    fontSize: 'inherit',
  },
  inputDirty: {
    fontWeight: 'bold',
  },
  error: {
    color: 'rgba(255,0,0,0.875) !important',
  },
  // readonly: {
  //   whiteSpace: 'nowrap',
  // },
}));

type Props = {
  meta: PropMetaInfo;
  name: string;
  state: ValueState;
  onChangeProperty: (name: string, value: unknown) => void;
};

type CellComponent = React.FunctionComponent<ValueState>;

const PropertyValueCell: React.FC<Props> = ({ meta, name, state, onChangeProperty }) => {
  const classes = useStyles();
  const cellFactory = useCallback<() => CellComponent>(() => {
    const componentName = capitalize(name)!;
    const { simpleType, isWritable, enumeration, min, max, convertFrom = x => x } = meta;
    if (!isWritable) {
      return setDisplayName(componentName)(({ value, status, error }: ValueState) => (
        <TableCell align="right" className={classNames({ [classes.error]: status === 'failed' })}>
          {status === 'failed' ? error : value}
        </TableCell>
      ));
    }

    let { step } = meta;
    if (step === undefined) {
      step = simpleType === 'xs:float' || simpleType === 'xs.double' ? 0.01 : 1;
    }
    const selectChanged = (event: React.ChangeEvent<{ name?: string; value: unknown }>): void => {
      onChangeProperty(name, event.target.value);
    };
    const rawValue = ({ status, error, value }: ValueState): ValueType =>
      (status === 'failed' ? error : convertFrom(value)) ?? '';
    if (enumeration && enumeration.length > 0) {
      return setDisplayName(componentName)(props => {
        const { value, status } = props;
        const isDirty = status === 'pending';
        return (
          <TableCell align="right">
            <Select
              fullWidth
              disableUnderline
              className={classNames(classes.select, { [classes.inputDirty]: isDirty })}
              value={String(rawValue(props)) || ''}
              onChange={selectChanged}
            >
              {(value === '' || value === undefined) && (
                <MenuItem value="">
                  <em>Не задано</em>
                </MenuItem>
              )}
              {enumeration.map(([key, itemValue]) => (
                <MenuItem key={key} value={itemValue}>
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
        value={props.value}
        align="right"
        min={min}
        max={max}
        step={step}
        // unit={unit}
        onChangeProperty={onChangeProperty}
        dirty={props.status === 'pending'}
      />
    ));
  }, [meta, name, classes, onChangeProperty]);
  const Cell = useMemo(() => cellFactory(), [cellFactory]);
  return <Cell {...state} />;
};

export default memo(PropertyValueCell);
