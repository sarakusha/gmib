/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Action, AnyAction, Middleware, ThunkDispatch } from '@reduxjs/toolkit';

export type AsyncLoader<
  A extends Action = AnyAction,
  S = Record<string, unknown>,
  E = undefined
> = (dispatch: ThunkDispatch<S, E, A>, getState: () => S) => void;

export default function asyncLoader<A extends Action, S = Record<string, unknown>>(
  loader: AsyncLoader<A, S>
): Middleware {
  return ({ dispatch, getState }) => {
    setTimeout(() => loader(dispatch, getState), 0);
    return next => action => {
      next(action);
    };
  };
}
