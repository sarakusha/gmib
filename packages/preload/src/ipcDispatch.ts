import type { AnyAction } from '@reduxjs/toolkit';

type Dispatch = <T extends AnyAction>(action: T) => T;

const deferredAction: AnyAction[] = [];

let dispatch: Dispatch = action => {
  deferredAction.push(action);
  return action;
};

export const setDispatch = (newDispatch: Dispatch): void => {
  dispatch = newDispatch;
  deferredAction.forEach(dispatch);
  deferredAction.length = 0;
};

const ipcDispatch: Dispatch = action => dispatch(action);

export default ipcDispatch;
