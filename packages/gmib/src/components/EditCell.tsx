/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import InputAdornment from '@material-ui/core/InputAdornment';
import { InputBaseProps } from '@material-ui/core/InputBase';
import { instanceOf } from 'prop-types';
import React, { ChangeEvent, useCallback, useMemo, useState } from 'react';
import { hot } from 'react-hot-loader/root';
import Input from '@material-ui/core/Input';
import TableCell, { TableCellProps } from '@material-ui/core/TableCell';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import compose from 'recompose/compose';
import classNames from 'classnames';

const safeParseNumber = (value: any) => {
  const num = parseFloat(value);
  return Number.isNaN(num) ? value : num;
};

const styles = (theme: Theme) => createStyles({
  inputRoot: {
    // width: '100%',
    fontSize: theme.typography.pxToRem(13),
  },
  inputRight: {
    textAlign: 'right',
  },
  inputCenter: {
    textAlign: 'center',
  },
  cell: {
    paddingRight: theme.spacing.unit,
    paddingLeft: theme.spacing.unit,
  },
  positionEnd: {
    marginLeft: 0,
    marginRight: -20,
  },
  inputDirty: {
    fontWeight: 'bold',
  },
});

type Props = {
  name: string,
  value?: InputBaseProps['value'] | Error,
  type?: InputBaseProps['type'],
  unit?: string,
  min?: number,
  max?: number,
  step?: number,
  dirty?: boolean,
  onChangeProperty?: (name: string, value: any) => void,
} & TableCellProps;
type InnerProps = Props & WithStyles<typeof styles>;

const EditCell: React.FC<InnerProps> =
  ({
    value, classes, className, align,
    type, unit, min, max, step, name, onChangeProperty, dirty, ...props
  }) => {
    const [controlled, setControlled] = useState(value !== undefined);
    const inputClasses = {
      input: classNames({
        [classes.inputRight]: align === 'right',
        [classes.inputCenter]: align === 'center',
        [classes.inputDirty]: dirty || !controlled,
      }),
    };
    const endAdornment = useMemo(
      () => unit
        ? (
          <InputAdornment position="end" classes={{ positionEnd: classes.positionEnd }}>
            {unit}
          </InputAdornment>
        )
        : null,
      [unit],
    );
    // let controlled = value !== undefined;
    const [val, setVal] = useState(value === undefined || value instanceof Error ? '' : value);
    const changeHandler = useCallback(
      (event: ChangeEvent<HTMLInputElement>) => {
        const controlled = ((min === undefined || safeParseNumber(event.target.value) >= min) &&
          (max === undefined || safeParseNumber(event.target.value) <= max));
        setControlled(controlled);
        controlled && onChangeProperty && onChangeProperty(name, event.target.value);
        setVal(event.target.value);
      },
      [onChangeProperty, setControlled],
    );
    const blurHandler = useCallback(
      () => {
        console.log('BLUR');
        setControlled(true);
        setVal((val) => {
          onChangeProperty && onChangeProperty(name, val);
          console.log('BBB', val);
          return val;
        });
      },
      [setControlled, setVal],
    );
    const hasError = value instanceof Error ? value.message : undefined;
    const current = hasError || value === undefined ? '' : controlled ? value : val;
    return (
      <TableCell className={classNames(classes.cell, className)}{...props}>
        <Input
          error={!!hasError}
          name={name}
          className={classes.inputRoot}
          classes={inputClasses}
          fullWidth
          value={current}
          type={type || 'text'}
          disableUnderline
          endAdornment={endAdornment}
          inputProps={{
            min,
            max,
            step,
            onBlur: blurHandler,
          }}
          onChange={changeHandler}
        />
      </TableCell>
    );
  };

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(EditCell);
