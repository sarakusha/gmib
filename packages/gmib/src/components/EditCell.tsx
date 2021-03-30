/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { makeStyles } from '@material-ui/core/styles';
import { InputAdornment, InputBaseProps, Input } from '@material-ui/core';
import React, { ChangeEvent, useCallback, useMemo, useState } from 'react';
import classNames from 'classnames';
import TableCell, { TableCellProps } from './TableCell';

const safeParseNumber = (value: unknown): number => parseFloat(value as string);

const useStyles = makeStyles(theme => ({
  inputRoot: {
    width: '100%',
    fontSize: 'inherit',
  },
  inputRight: {
    textAlign: 'right',
  },
  inputCenter: {
    textAlign: 'center',
  },
  cell: {
    paddingRight: theme.spacing(1),
    paddingLeft: theme.spacing(1),
  },
  positionEnd: {
    marginLeft: 0,
    marginRight: -20,
  },
  inputDirty: {
    fontWeight: 'bold',
  },
}));

type Props = {
  name: string;
  value?: InputBaseProps['value'] | Error;
  type?: InputBaseProps['type'];
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  dirty?: boolean;
  onChangeProperty?: (name: string, value: unknown) => void;
} & TableCellProps;

const EditCell: React.FC<Props> = ({
  value,
  className,
  align,
  type,
  unit,
  min,
  max,
  step,
  name,
  onChangeProperty,
  dirty,
  ...props
}) => {
  const classes = useStyles();
  const [controlled, setControlled] = useState(value !== undefined);
  const inputClasses = {
    input: classNames({
      [classes.inputRight]: align === 'right',
      [classes.inputCenter]: align === 'center',
      [classes.inputDirty]: dirty || !controlled,
    }),
  };
  const endAdornment = useMemo(
    () =>
      unit ? (
        <InputAdornment position="end" classes={{ positionEnd: classes.positionEnd }}>
          {unit}
        </InputAdornment>
      ) : null,
    [classes.positionEnd, unit]
  );
  // let controlled = value !== undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [val, setVal] = useState<unknown>(
    value === undefined || value instanceof Error ? '' : value
  );
  const changeHandler = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const ctrl =
        (min === undefined || safeParseNumber(event.target.value) >= min) &&
        (max === undefined || safeParseNumber(event.target.value) <= max);
      setControlled(ctrl);
      ctrl && onChangeProperty && onChangeProperty(name, event.target.value);
      setVal(event.target.value);
    },
    [max, min, name, onChangeProperty]
  );
  const blurHandler = useCallback(() => {
    setControlled(true);
    setVal((v: unknown) => {
      onChangeProperty && onChangeProperty(name, v);
      return v;
    });
  }, [name, onChangeProperty]);
  const hasError = value instanceof Error ? value.message : undefined;
  const current = hasError || value === undefined ? '' : controlled ? value : val;
  return (
    <TableCell className={classNames(classes.cell, className)} {...props}>
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

// export default compose<Props, Props>(
//   hot,
//   React.memo,
// )(EditCell);

export default EditCell;
