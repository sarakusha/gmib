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
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import MaskedInput from 'react-input-mask';
import TableCell, { TableCellProps } from '@material-ui/core/TableCell';
import classNames from 'classnames';
import Input, { InputProps } from '@material-ui/core/Input';
import debounce from 'lodash/debounce';

const styles = (theme: Theme) => createStyles({
  cell: {
    paddingRight: theme.spacing.unit,
    paddingLeft: theme.spacing.unit,
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
});
type Props = {
  name: string,
  value: string,
  dirty?: boolean,
  onChangeProperty?: (name: string, value: any) => void,
} & TableCellProps;
const formatChars = {
  X: '[0-9a-fA-F]',
};
const isEmpty = (value: string) => value.replace(/0/g, '') === '';
type InnerProps = Props & WithStyles<typeof styles>;
const SerialNoCell: React.FC<InnerProps> =
  ({
    value: initValue, name, classes, className,
    onChangeProperty, dirty: initDirty, align, ...props
  }) => {
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
        (name: string, value: string) => {
          if (onChangeProperty && !isEmpty(value)) {
            onChangeProperty(name, value);
            setDirty(false);
          }
        },
        5000,
      ),
      [onChangeProperty],
    );
    useEffect(() => updateValue(name, value), [name, value]);
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
          {(inputProps: InputProps) => <Input
            className={classes.inputRoot}
            classes={inputClasses}
            {...inputProps}
            type="text"
            disableUnderline
          />}
        </MaskedInput>
      </TableCell>
    );
  };

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(SerialNoCell);
