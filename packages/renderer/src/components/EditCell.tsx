/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { InputAdornment, InputBaseProps } from '@mui/material';
import { styled } from '@mui/material/styles';
import React, { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import StyledInput from './StyledInput';
import TableCell, { TableCellProps } from './TableCell';

const safeParseNumber = (value: unknown): number => parseFloat(value as string);

// const useStyles = makeStyles(theme => ({
//   inputRoot: {
//     width: '100%',
//     fontSize: 'inherit',
//   },
//   inputRight: {
//     textAlign: 'right',
//   },
//   inputCenter: {
//     textAlign: 'center',
//   },
//   positionEnd: {
//     marginLeft: 0,
//     marginRight: -20,
//   },
//   inputDirty: {
//     fontWeight: 'bold',
//   },
// }));

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

const EndAdornment = styled(InputAdornment)({
  '&.MuiInputAdornment-positionEnd': {
    marginLeft: 0,
    marginRight: -20,
  },
});

// type InputExProps = InputBaseProps &
//   Pick<TableCellProps, 'align'> & {
//     dirty?: boolean;
//     controlled?: boolean;
//   };
//
// const InputEx = extendStyled(Input, {
//   align: 'left',
//   dirty: false,
//   controlled: false,
// })(({ align, dirty, controlled }: InputExProps) => ({
//   textAlign: align && ['right', 'center'].includes(align) ? align : 'inherit',
//   fontWeight: dirty || !controlled ? 'bold' : 'normal',
//   fontSize: 'inherit',
//   width: '100%',
// }));

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
  // const classes = useStyles();
  const [controlled, setControlled] = useState(value !== undefined);
  // const inputClasses = {
  //   input: classNames({
  //     [classes.inputRight]: align === 'right',
  //     [classes.inputCenter]: align === 'center',
  //     [classes.inputDirty]: dirty || !controlled,
  //   }),
  // };
  const endAdornment = useMemo(
    () => (unit ? <EndAdornment position="end">{unit}</EndAdornment> : null),
    [unit]
  );
  // let controlled = value !== undefined;
  const [val, setVal] = useState<unknown>();
  useEffect(() => {
    setVal(value === undefined || value instanceof Error ? '' : value);
  }, [value]);
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
    <TableCell className={className} sx={{ px: 1 }} {...props}>
      <StyledInput
        align={align}
        dirty={dirty || !controlled}
        error={!!hasError}
        name={name}
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

export default EditCell;
