/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Middleware } from '@reduxjs/toolkit';
import type { AppDispatch, RootState } from './index';

export type AsyncInitializer = (dispatch: AppDispatch, getState: () => RootState) => void;

export default function asyncInitializer(
  initializer: AsyncInitializer
  // eslint-disable-next-line @typescript-eslint/ban-types
): Middleware {
  return ({ dispatch, getState }) => {
    setTimeout(() => initializer(dispatch as AppDispatch, getState), 0);
    return next => action => {
      next(action);
    };
  };
}
