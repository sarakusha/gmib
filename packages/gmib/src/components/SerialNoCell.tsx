/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
// import MaskedInput from 'react-input-mask';
import classNames from 'classnames';
import Input from '@material-ui/core/Input';
import { IMaskMixin } from 'react-imask/dist/react-imask';
import debounce from 'lodash/debounce';
import TableCell, { TableCellProps } from './TableCell';
// import ErrorBoundary from './ErrorBoundary';

const useStyles = makeStyles(_theme => ({
  inputDirty: {
    fontWeight: 'bold',
  },
  inputRoot: {
    fontSize: 'inherit',
    width: '100%',
  },
  inputRight: {
    textAlign: 'right',
  },
  inputCenter: {
    textAlign: 'center',
  },
}));

type Props = {
  name: string;
  value: string;
  dirty?: boolean;
  onChangeProperty?: (name: string, value: unknown) => void;
} & TableCellProps;
const formatChars = {
  X: /[0-9a-fA-F]/,
  O: /0/,
};
const isEmpty = (value: string): boolean => !value || value.replace(/0/g, '') === '';

const MaskedInput = IMaskMixin(Input);

const toUpper = (str: string): string => str.toUpperCase();

const SerialNoCell: React.FC<Props> = ({
  value: initValue,
  name,
  className,
  onChangeProperty,
  dirty: initDirty,
  align,
  ...props
}) => {
  const classes = useStyles();
  const [value, setValue] = useState(initValue);
  const [dirty, setDirty] = useState(initDirty);
  const changeHandler = useCallback((_, { unmaskedValue }) => {
    setValue(unmaskedValue.padStart(16, '0'));
    setDirty(true);
  }, []);
  const updateValue = useMemo(
    () =>
      debounce((key: string, val: string) => {
        if (onChangeProperty && !isEmpty(val)) {
          onChangeProperty(key, val);
          setDirty(false);
        }
      }, 5000),
    [onChangeProperty]
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
    <TableCell className={className} align={align} {...props}>
      <MaskedInput
        onAccept={changeHandler}
        value={value.slice(-12).padStart(12, '0')}
        className={classes.inputRoot}
        classes={inputClasses}
        // type="text"
        disableUnderline
        mask="XX:XX:XX:XX:XX:XX"
        definitions={formatChars}
        overwrite
        lazy={false}
        autofix
        placeholderChar="0"
        prepare={toUpper}
      />
    </TableCell>
  );
};

export default SerialNoCell;
// export default compose<Props, Props>(hot, React.memo)(SerialNoCell);
