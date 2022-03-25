/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { debounce } from '@material-ui/core';
import { AnyAction } from '@reduxjs/toolkit';
import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import type { AppThunk } from '../store';

const toString = (value: unknown): string => `${value ?? ''}`;

type ChangeHandler = React.ChangeEventHandler<HTMLInputElement>;

const useDelayUpdate = (
  value: unknown,
  action: (payload: string) => AppThunk | AnyAction,
  delay = 1000
): [string, ChangeHandler] => {
  const [current, setCurrent] = useState(toString(value));
  useEffect(() => setCurrent(toString(value)), [value]);
  const dispatch = useDispatch();
  const changeHandler = useMemo<ChangeHandler>(() => {
    const update = debounce((val: string): void => {
      dispatch(action(val));
    }, delay);
    return e => {
      setCurrent(e.target.value);
      update(e.target.value);
    };
  }, [dispatch, action, delay]);
  return [current, changeHandler];
};

export default useDelayUpdate;
