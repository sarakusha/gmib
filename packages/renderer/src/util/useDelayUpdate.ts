import type { AnyAction } from '@reduxjs/toolkit';
import debounce from 'lodash/debounce';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';

import type { AppThunk } from '../store';

const toString = (value: unknown): string => `${value ?? ''}`;

type ChangeHandler = React.ChangeEventHandler<HTMLInputElement>;

const useDelayUpdate = (
  value: unknown,
  action: (payload: string) => AppThunk | AnyAction,
  delay = 1000,
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
