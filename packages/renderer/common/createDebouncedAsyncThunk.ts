import type { AsyncThunk, AsyncThunkPayloadCreator, Dispatch } from '@reduxjs/toolkit';
import { createAsyncThunk } from '@reduxjs/toolkit';

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

export type AppThunkConfig<S = unknown, D extends Dispatch = Dispatch> = {
  dispatch: D;
  state: S;
  extra?: unknown;
  rejectValue?: unknown;
  serializedErrorType?: unknown;
  pendingMeta?: unknown;
  fulfilledMeta?: unknown;
  rejectedMeta?: unknown;
};

/**
 * A debounced analogue of the `createAsyncThunk` from `@reduxjs/toolkit`
 * @param typePrefix - a string action type value
 * @param payloadCreator - a callback function that should return a promise containing the result
 *   of some asynchronous logic
 * @param wait - the number of milliseconds to delay.
 * @param options - the options object
 */
const createDebouncedAsyncThunk = <
  Returned,
  ThunkArg = void,
  Config extends AppThunkConfig = AppThunkConfig,
>(
  typePrefix: string,
  payloadCreator: AsyncThunkPayloadCreator<Returned, ThunkArg, Config>,
  wait: number,
  options?: DebounceSettings<ThunkArg>,
): AsyncThunk<Returned, ThunkArg, AppThunkConfig> & { pending: (id: unknown) => boolean } => {
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
  return Object.assign(
    createAsyncThunk(typePrefix, payloadCreator, {
      condition(arg) {
        const id = selectId(arg);
        if (!states.has(id)) {
          states.set(id, {
            timer: 0,
            maxTimer: 0,
          });
        }
        const state = states.get(id);
        if (!state) return false;
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
    }),
    { pending: (id: unknown) => Boolean(states.get(id)?.resolve) },
  );
};

export default createDebouncedAsyncThunk;
