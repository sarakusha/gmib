/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import React, { memo, useCallback, useEffect, useState } from 'react';
import { TextField, Checkbox, InputAdornment } from '@material-ui/core';
import { getStateAsync } from '../util/helpers';

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
    [onChange]
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
    [onChange]
  );
  return (
    <div className={className}>
      <TextField
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
