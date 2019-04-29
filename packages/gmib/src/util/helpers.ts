/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { Dispatch, SetStateAction } from 'react';

export function tuplify<T extends any[]>(...args: T) {
  return args;
};

export const delay = (seconds: number) =>
  new Promise(resolve => setTimeout(resolve, seconds * 1000));

type SetterType<T> = Dispatch<SetStateAction<T>>;
type Callback<T> = (state: T) => void;

export const getState = <T>(setter: SetterType<T>) =>
  (cb: Callback<T>) => setter(state => (cb(state), state));
