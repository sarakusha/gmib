/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { FlashKinds, Kind } from '@nibus/core';
import React, {
  Dispatch,
  Reducer,
  ReducerAction,
  SetStateAction,
  useCallback,
  useContext,
  useReducer,
} from 'react';
import { AtLeastOne, noop } from '../util/helpers';

type Setter<S> = Dispatch<SetStateAction<S>>;

export type FlashState = {
  row: number;
  column: number;
  file: string;
};

export type FlashSetters = {
  setColumn: Setter<number | string>;
  setRow: Setter<number | string>;
  setFile: Setter<string | number>;
};

type FlashGlobalState = Record<string, FlashState>;

type ActionType = keyof FlashState;
type Action = { type: ActionType; payload: SetStateAction<FlashState[ActionType]>; kind: Kind };
type FlashReducer = Reducer<FlashGlobalState, Action>;

const flashReducer: FlashReducer = (state, { type, payload, kind }) => {
  const updateState = (value: AtLeastOne<FlashState>): FlashGlobalState => ({
    ...state,
    [kind]: { ...state[kind], ...value },
  });
  const prev = state[kind][type];
  const value = typeof payload === 'function' ? payload(prev) : payload;
  if (value === prev) return state;
  switch (type) {
    case 'row':
      return updateState({ row: value as number });
    case 'column':
      return updateState({ column: value as number });
    case 'file':
      return updateState({ file: value as string });
    default:
      throw new TypeError(`Invalid action type ${type}`);
  }
};

const FlashGlobalStateContext = React.createContext<FlashGlobalState>({});
const FlashDispatchStateContext = React.createContext<Dispatch<ReducerAction<FlashReducer>>>(noop);

export const useGlobalFlashState = () =>
  [useContext(FlashGlobalStateContext), useContext(FlashDispatchStateContext)] as const;

export const useFlashState = (kind: Kind): FlashState & FlashSetters => {
  const [state, dispatch] = useGlobalFlashState();
  const setColumn = useCallback<Setter<number | string>>(
    payload => dispatch({ kind, payload, type: 'column' }),
    [kind, dispatch]
  );
  const setRow = useCallback<Setter<number | string>>(
    payload => dispatch({ kind, payload, type: 'row' }),
    [kind, dispatch]
  );
  const setFile = useCallback<Setter<string | number>>(
    payload => dispatch({ kind, payload, type: 'file' }),
    [kind, dispatch]
  );
  return { ...state[kind], setColumn, setRow, setFile };
};

export const FlashStateProvider: React.FC = ({ children }) => {
  const [state, dispatch] = useReducer<FlashReducer>(
    flashReducer,
    Object.fromEntries(
      FlashKinds.map<[Kind, FlashState]>(kind => [kind, { row: 0, column: 0, file: '' }])
    )
  );
  return (
    <FlashGlobalStateContext.Provider value={state}>
      <FlashDispatchStateContext.Provider value={dispatch}>
        {children}
      </FlashDispatchStateContext.Provider>
    </FlashGlobalStateContext.Provider>
  );
};

export default FlashStateProvider;
