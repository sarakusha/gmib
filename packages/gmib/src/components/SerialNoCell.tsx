/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import MaskedInput from 'react-input-mask';
import TableCell, { TableCellProps } from '@material-ui/core/TableCell';
import classNames from 'classnames';
import Input, { InputProps } from '@material-ui/core/Input';
import debounce from 'lodash/debounce';

const useStyles = makeStyles(theme => ({
  cell: {
    paddingRight: theme.spacing(1),
    paddingLeft: theme.spacing(1),
  },
  inputDirty: {
    fontWeight: 'bold',
  },
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
  cellRoot: {
    '&:last-child': {
      paddingRight: 38,
    },
    color: theme.palette.text.disabled,
  },
}));

type Props = {
  name: string;
  value: string;
  dirty?: boolean;
  onChangeProperty?: (name: string, value: unknown) => void;
} & TableCellProps;
const formatChars = {
  X: '[0-9a-fA-F]',
};
const isEmpty = (value: string): boolean => value.replace(/0/g, '') === '';
const SerialNoCell: React.FC<Props> = ({
  value: initValue, name, className,
  onChangeProperty, dirty: initDirty, align, ...props
}) => {
  const classes = useStyles();
  const [value, setValue] = useState(initValue);
  const [dirty, setDirty] = useState(initDirty);
  const changeHandler = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setValue(event.target.value);
      setDirty(true);
    },
    [setValue, setDirty],
  );
  const updateValue = useCallback(
    debounce(
      (key: string, val: string) => {
        if (onChangeProperty && !isEmpty(val)) {
          onChangeProperty(key, val);
          setDirty(false);
        }
      },
      5000,
    ),
    [onChangeProperty],
  );
  useEffect(() => updateValue(name, value), [name, updateValue, value]);
  const inputClasses = {
    input: classNames({
      [classes.inputRight]: align === 'right',
      [classes.inputCenter]: align === 'center',
      [classes.inputDirty]: dirty,
    }),
  };
  return (
      <TableCell
        className={classNames(classes.cell, className)}
        align={align}
        classes={{ root: classes.cellRoot }}
        {...props}
      >
        <MaskedInput
          name={name}
          mask="0000XXXXXXXXXXXX"
          formatChars={formatChars}
          maskChar="0"
          value={value}
          onChange={changeHandler}
        >
          {(inputProps: InputProps) => (
<Input
  className={classes.inputRoot}
  classes={inputClasses}
  {...inputProps}
  type="text"
  disableUnderline
/>
          )}
        </MaskedInput>
      </TableCell>
  );
};

export default compose<Props, Props>(
  hot,
  React.memo,
)(SerialNoCell);
