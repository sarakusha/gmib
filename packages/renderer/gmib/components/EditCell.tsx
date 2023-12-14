import type { InputBaseProps } from '@mui/material';
import { InputAdornment } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { ChangeEvent } from 'react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import StyledInput from './StyledInput';
import type { TableCellProps } from './TableCell';
import TableCell from './TableCell';

const safeParseNumber = (value: unknown): number => parseFloat(value as string);

type Props = {
  name: string;
  value?: InputBaseProps['value'] | Error;
  type?: InputBaseProps['type'];
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  dirty?: boolean;
  disabled?: boolean;
  onChangeProperty?: (name: string, value: unknown) => void;
} & TableCellProps;

const EndAdornment = styled(InputAdornment)({
  '&.MuiInputAdornment-positionEnd': {
    marginLeft: 0,
    marginRight: -20,
  },
});

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
  disabled,
  ...props
}) => {
  const [controlled, setControlled] = useState(value !== undefined);
  const endAdornment = useMemo(
    () => (unit ? <EndAdornment position="end">{unit}</EndAdornment> : null),
    [unit],
  );
  const [val, setVal] = useState<unknown>();
  useEffect(() => {
    setVal((v: unknown) => (value === undefined || value instanceof Error ? v : value));
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
    [max, min, name, onChangeProperty],
  );
  const blurHandler = () => {
    setControlled(true);
    if (val !== value) onChangeProperty?.(name, val !== '' ? val : value);
  };
  const errMsg = value instanceof Error ? value.message : undefined;
  const current = controlled && !errMsg ? value : val;
  return (
    <TableCell
      className={className}
      sx={{ px: 1, color: errMsg ? 'rgba(255,0,0,0.875) !important' : 'inherit' }}
      {...props}
    >
      {errMsg || (
        <StyledInput
          align={align}
          dirty={dirty || !controlled}
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
          disabled={disabled}
          onChange={changeHandler}
        />
      )}
    </TableCell>
  );
};

export default EditCell;
