/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { AsyncThunk, AsyncThunkPayloadCreator, createAsyncThunk } from '@reduxjs/toolkit';
import type { AppThunkConfig } from './index';

type DebounceSettings<ThunkArg> = {
  /**
   * The maximum time `payloadCreator` is allowed to be delayed before
   * it's invoked.
   * @defaultValue `0`
   */
  maxWait?: number;
  /**
   * Specify invoking on the leading edge of the timeout.
   * @defaultValue `false`
   */
  leading?: boolean;
  selectId?: (arg: ThunkArg) => unknown;
};

type State = {
  timer: number;
  maxTimer: number;
  resolve?: (value: boolean) => void;
};

/**
 * A debounced analogue of the `createAsyncThunk` from `@reduxjs/toolkit`
 * @param typePrefix - a string action type value
 * @param payloadCreator - a callback function that should return a promise containing the result
 *   of some asynchronous logic
 * @param wait - the number of milliseconds to delay.
 * @param options - the options object
 */
const createDebouncedAsyncThunk = <Returned, ThunkArg = void>(
  typePrefix: string,
  payloadCreator: AsyncThunkPayloadCreator<Returned, ThunkArg, AppThunkConfig>,
  wait: number,
  options?: DebounceSettings<ThunkArg>
  // eslint-disable-next-line @typescript-eslint/ban-types
): AsyncThunk<Returned, ThunkArg, AppThunkConfig> => {
  const { maxWait = 0, leading = false, selectId = () => null } = options ?? {};
  const states = new Map<unknown, State>();
  const invoke = (state: State): void => {
    if (!state) return;
    window.clearTimeout(state.maxTimer);
    state.maxTimer = 0;
    if (state.resolve) {
      state.resolve(true);
      state.resolve = undefined;
    }
  };
  const cancel = (state: State): void => {
    if (state.resolve) {
      state.resolve(false);
      state.resolve = undefined;
    }
  };
  return createAsyncThunk(typePrefix, payloadCreator, {
    condition(arg) {
      const id = selectId(arg);
      if (!states.has(id)) {
        states.set(id, {
          timer: 0,
          maxTimer: 0,
        });
      }
      const state = states.get(id)!;
      const immediate = leading && !state.timer;
      window.clearTimeout(state.timer);
      state.timer = window.setTimeout(() => {
        invoke(state);
        state.timer = 0;
      }, wait);
      if (immediate) return true;
      cancel(state);
      if (maxWait && !state.maxTimer)
        state.maxTimer = window.setTimeout(() => invoke(state), maxWait);
      return new Promise<boolean>(res => {
        state.resolve = res;
      });
    },
  });
};

export default createDebouncedAsyncThunk;
