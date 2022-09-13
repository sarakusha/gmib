
import { Checkbox, InputAdornment, TextField } from '@mui/material';
import React, { memo, useCallback, useEffect, useState } from 'react';

import { getStateAsync } from '/@common/helpers';

export type Props = {
  label: string;
  groupName: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
  className?: string;
};

const ALL = 0xff;

const Selector: React.FC<Props> = ({ label, groupName, value, onChange, max, className }) => {
  const [, setCached] = useState(value);
  const changeHandler = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    e => onChange(Number(e.target.value)),
    [onChange],
  );
  useEffect(() => {
    value !== ALL && setCached(value);
  }, [value]);
  const checkHandler = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    async e => {
      const { checked } = e.target;
      const current = await getStateAsync(setCached);
      onChange(checked ? ALL : current);
    },
    [onChange],
  );
  return (
    <div className={className}>
      <TextField
        variant="standard"
        fullWidth
        value={value === ALL ? groupName : value}
        label={label}
        type={value === ALL ? 'text' : 'number'}
        InputProps={{
          readOnly: value === 0xff,
          endAdornment: (
            <InputAdornment position="end">
              <Checkbox onChange={checkHandler} />
            </InputAdornment>
          ),
          inputProps: { max, min: 0 },
        }}
        onChange={changeHandler}
        className={className}
      />
    </div>
  );
};

export default memo(Selector);
