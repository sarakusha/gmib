/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import TableCell from '@material-ui/core/TableCell';
import Select from '@material-ui/core/Select';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { ChangeEvent, useCallback, useMemo } from 'react';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import setDisplayName from 'recompose/setDisplayName';
import MenuItem from '@material-ui/core/MenuItem';
import EditCell from './EditCell';

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
const safeParseNumber = (value: any) => {
  const num = parseFloat(value);
  return Number.isNaN(num) ? value : num;
};
// const toInt = (value: number | boolean) => typeof value === 'boolean'
//   ? value ? 1 : 0
//   : value;

const styles = (theme: Theme) => createStyles({
  menuItem: {
    fontSize: theme.typography.pxToRem(13),
  },
  select: {
    fontSize: theme.typography.pxToRem(13),
  },
  selectCellRoot: {
    paddingRight: '6px !important',
  },
  cellRoot: {
    '&:last-child': {
      paddingRight: 38,
    },
  },
});

type Props = {
  proto: Object,
  name: string,
  value: any,
  onChangeProperty: (name: string, value: any) => void,
};

type InnerProps = Props & WithStyles<typeof styles>;

type CellProps = Pick<Props, 'value'>;
type CellComponent = React.FunctionComponent<CellProps>;
const PropertyValueCell = ({ proto, name, value, classes, onChangeProperty }: InnerProps) => {
  // console.log(name, value, typeof value);
  const cellFactory = useCallback<() => CellComponent>(
    () => {
      const componentName = `${capitalize(Reflect.getMetadata('mib', proto))}.${capitalize(name)}`;
      const simpleType = Reflect.getMetadata('simpleType', proto, name);
      const enumeration = Reflect.getMetadata(
        'enum',
        proto,
        name,
      ) as ([string, number][]);
      const isWritable = Reflect.getMetadata('isWritable', proto, name);
      // console.log(`name=${name} type=${simpleType},
      // value=${value}, enum=${JSON.stringify(enumeration)}`);
      if (!isWritable) {
        return setDisplayName(componentName)(
          ({ value }: CellProps) =>
            <TableCell align="right" classes={{ root: classes.cellRoot }}>{value}</TableCell>,
        );
      }
      const unit = Reflect.getMetadata('unit', proto, name);
      const min = Reflect.getMetadata('min', proto, name);
      const max = Reflect.getMetadata('max', proto, name);
      const selectChanged = (event: ChangeEvent<HTMLSelectElement>) => {
        onChangeProperty(name, event.target.value);
      };
      const rawValue = (value: any) =>
        Reflect.getMetadata('convertFrom', proto, name)(value);
      if (enumeration && enumeration.length > 0) {
        return setDisplayName(componentName)(
          ({ value }) => {
            // console.log('SELECT', name, value, rawValue(value), enumeration);
            return (
              <TableCell align="right" classes={{ root: classes.selectCellRoot }}>
                <Select
                  fullWidth
                  disableUnderline
                  className={classes.select}
                  value={String(rawValue(value)) || ''}
                  onChange={selectChanged}
                >
                  {(value === '' || value === undefined) &&
                  (<MenuItem value="" className={classes.menuItem}>
                    <em>Не задано</em>
                  </MenuItem>)}
                  {enumeration.map(([name, val], index) =>
                    <MenuItem
                      className={classes.menuItem}
                      key={index}
                      value={val}
                    >
                      {name}
                    </MenuItem>)}
                </Select>
              </TableCell>
            );
          },
        );
      }
      const [convert, type] = simpleType === 'xs:string'
        ? [String, 'text']
        : [unit ? rawValue : safeParseNumber, 'number'];
      return setDisplayName(componentName)(
        ({ value }: CellProps) => (
          <EditCell
            name={name}
            type={type}
            value={convert(value)}
            align="right"
            min={min}
            max={max}
            unit={unit}
            onChangeProperty={onChangeProperty}
          />
        ),
      );
    },
    [proto, name, classes],
  );
  const Cell = useMemo(() => cellFactory(), [cellFactory]);
  return <Cell value={value} />;
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(PropertyValueCell);
