/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

/* eslint-disable indent,@typescript-eslint/no-explicit-any */
import Select from '@material-ui/core/Select';
import { makeStyles } from '@material-ui/core/styles';
import React, { memo, useCallback, useMemo } from 'react';
import MenuItem from '@material-ui/core/MenuItem';
import classNames from 'classnames';
import setDisplayName from '../util/setDisplayName';
import TableCell from './TableCell';
import EditCell from './EditCell';
import SerialNoCell from './SerialNoCell';

const capitalize = (str?: string): string | undefined =>
  str && str.charAt(0).toUpperCase() + str.slice(1);
const safeParseNumber = (value: unknown): number => parseFloat(value as string) || 0;

const useStyles = makeStyles(_theme => ({
  select: {
    fontSize: 'inherit',
  },
  inputDirty: {
    fontWeight: 'bold',
  },
  error: {
    color: 'red',
  },
}));

type Props = {
  proto: Record<string, any>;
  name: string;
  value: any;
  dirty?: boolean;
  onChangeProperty: (name: string, value: any) => void;
};

type CellProps = { value: any; dirty?: boolean };
type CellComponent = React.FunctionComponent<CellProps>;

const PropertyValueCell: React.FC<Props> = ({
  proto,
  name,
  value,
  onChangeProperty,
  dirty = false,
}) => {
  const classes = useStyles();
  const cellFactory = useCallback<() => CellComponent>(() => {
    const componentName = `${capitalize(Reflect.getMetadata('mib', proto))}.${capitalize(name)}`;
    const simpleType = Reflect.getMetadata('simpleType', proto, name);
    const enumeration = Reflect.getMetadata('enum', proto, name) as [string, number][];
    const isWritable = Reflect.getMetadata('isWritable', proto, name);
    if (!isWritable) {
      return setDisplayName(componentName)(({ value: val }: CellProps) => (
        <TableCell align="right" className={classNames({ [classes.error]: val instanceof Error })}>
          {val instanceof Error ? val.message : val}
        </TableCell>
      ));
    }
    const unit = Reflect.getMetadata('unit', proto, name);
    const min = Reflect.getMetadata('min', proto, name);
    const max = Reflect.getMetadata('max', proto, name);
    let step = Reflect.getMetadata('step', proto, name);
    if (step === undefined) {
      step = simpleType === 'xs:float' || simpleType === 'xs.double' ? 0.01 : 1;
    }
    const selectChanged = (event: React.ChangeEvent<{ name?: string; value: unknown }>): void => {
      onChangeProperty(name, event.target.value);
    };
    const convertFrom = Reflect.getMetadata('convertFrom', proto, name);
    const rawValue = (val: unknown): string =>
      val instanceof Error ? val.message : convertFrom(val);
    if (enumeration && enumeration.length > 0) {
      return setDisplayName(componentName)(({ value: val, dirty: cellDirty }) => (
        <TableCell align="right">
          <Select
            fullWidth
            disableUnderline
            className={classNames(classes.select, { [classes.inputDirty]: cellDirty })}
            value={String(rawValue(val)) || ''}
            onChange={selectChanged}
          >
            {(val === '' || val === undefined) && (
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
      ));
    }
    if (simpleType === 'xs:unsignedLong' && name === 'serno') {
      return setDisplayName(componentName)(({ value: val, dirty: cellDirty }: CellProps) => (
        <SerialNoCell
          name={name}
          onChangeProperty={onChangeProperty}
          value={val}
          dirty={cellDirty}
          align="right"
        />
      ));
    }
    const [convert, type] =
      simpleType === 'xs:string' ? [String, 'text'] : [unit ? rawValue : safeParseNumber, 'number'];
    return setDisplayName(componentName)(({ value: val, dirty: cellDirty }: CellProps) => (
      <EditCell
        name={name}
        type={type}
        value={convert(val)}
        align="right"
        min={min}
        max={max}
        step={step}
        // unit={unit}
        onChangeProperty={onChangeProperty}
        dirty={cellDirty}
      />
    ));
  }, [proto, name, classes.error, classes.select, classes.inputDirty, onChangeProperty]);
  const Cell = useMemo(() => cellFactory(), [cellFactory]);
  return <Cell value={value} dirty={dirty} />;
};

export default memo(PropertyValueCell);
