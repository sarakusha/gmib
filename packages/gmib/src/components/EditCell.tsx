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
import React, { ChangeEvent, useCallback, useMemo } from 'react';
import { hot } from 'react-hot-loader/root';
import Input from '@material-ui/core/Input';
import TableCell, { TableCellProps } from '@material-ui/core/TableCell';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import compose from 'recompose/compose';
import classNames from 'classnames';

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
});

type Props = {
  name: string,
  value?: InputBaseProps['value'],
  type?: InputBaseProps['type'],
  unit?: string,
  min?: number,
  max?: number,
  onChangeProperty?: (name: string, value: any) => void,
} & TableCellProps;
type InnerProps = Props & WithStyles<typeof styles>;

const EditCell =
  ({
    value, classes, className, align, type, unit, min, max, name, onChangeProperty, ...props
  }: InnerProps) => {
    const inputClasses = useMemo(
      () => ({
        input: classNames({
          [classes.inputRight]: align === 'right',
          [classes.inputCenter]: align === 'center',
        }),
      }),
      [align],
    );
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
    const changeHandler = useCallback(
      (event: ChangeEvent<HTMLInputElement>) =>
        onChangeProperty && onChangeProperty(name, event.target.value),
      [onChangeProperty],
    );
    return (
      <TableCell className={classNames(classes.cell, className)}{...props}>
        <Input
          name={name}
          className={classes.inputRoot}
          classes={inputClasses}
          fullWidth
          value={value === undefined ? '' : value}
          type={type || 'text'}
          disableUnderline
          endAdornment={endAdornment}
          inputProps={{
            min,
            max,
          }}
          onChange={changeHandler}
        />
      </TableCell>
    );
  };

export default compose<InnerProps, Props>(
  hot,
  withStyles(styles),
)(EditCell);
