/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { Dispatch, SetStateAction } from 'react';

export function tuplify<T extends unknown[]>(...args: T): T {
  return args;
}

export const delay = (seconds: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, seconds * 1000));

export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}

type Setter<S> = Dispatch<SetStateAction<S>>;

export const getStateAsync = <S>(setter: Setter<S>): Promise<S> =>
  new Promise<S>(resolve => {
    setter(prevState => {
      resolve(prevState);
      return prevState;
    });
  });

export function getStatesAsync<S1, S2, S3, S4, S5, S6, S7, S8, S9, S10>(
  setter1: Setter<S1>,
  setter2: Setter<S2>,
  setter3: Setter<S3>,
  setter4: Setter<S4>,
  setter5: Setter<S5>,
  setter6: Setter<S6>,
  setter7: Setter<S7>,
  setter8: Setter<S8>,
  setter9: Setter<S9>,
  setter10: Setter<S10>
): Promise<[S1, S2, S3, S4, S5, S6, S7, S8, S9, S10]>;
export function getStatesAsync<S1, S2, S3, S4, S5, S6, S7, S8, S9>(
  setter1: Setter<S1>,
  setter2: Setter<S2>,
  setter3: Setter<S3>,
  setter4: Setter<S4>,
  setter5: Setter<S5>,
  setter6: Setter<S6>,
  setter7: Setter<S7>,
  setter8: Setter<S8>,
  setter9: Setter<S9>
): Promise<[S1, S2, S3, S4, S5, S6, S7, S8, S9]>;
export function getStatesAsync<S1, S2, S3, S4, S5, S6, S7, S8>(
  setter1: Setter<S1>,
  setter2: Setter<S2>,
  setter3: Setter<S3>,
  setter4: Setter<S4>,
  setter5: Setter<S5>,
  setter6: Setter<S6>,
  setter7: Setter<S7>,
  setter8: Setter<S8>
): Promise<[S1, S2, S3, S4, S5, S6, S7, S8]>;
export function getStatesAsync<S1, S2, S3, S4, S5, S6, S7>(
  setter1: Setter<S1>,
  setter2: Setter<S2>,
  setter3: Setter<S3>,
  setter4: Setter<S4>,
  setter5: Setter<S5>,
  setter6: Setter<S6>,
  setter7: Setter<S7>
): Promise<[S1, S2, S3, S4, S5, S6, S7]>;
export function getStatesAsync<S1, S2, S3, S4, S5, S6>(
  setter1: Setter<S1>,
  setter2: Setter<S2>,
  setter3: Setter<S3>,
  setter4: Setter<S4>,
  setter5: Setter<S5>,
  setter6: Setter<S6>
): Promise<[S1, S2, S3, S4, S5, S6]>;
export function getStatesAsync<S1, S2, S3, S4, S5>(
  setter1: Setter<S1>,
  setter2: Setter<S2>,
  setter3: Setter<S3>,
  setter4: Setter<S4>,
  setter5: Setter<S5>
): Promise<[S1, S2, S3, S4, S5]>;
export function getStatesAsync<S1, S2, S3, S4>(
  setter1: Setter<S1>,
  setter2: Setter<S2>,
  setter3: Setter<S3>,
  setter4: Setter<S4>
): Promise<[S1, S2, S3, S4]>;
export function getStatesAsync<S1, S2, S3>(
  setter1: Setter<S1>,
  setter2: Setter<S2>,
  setter3: Setter<S3>
): Promise<[S1, S2, S3]>;
export function getStatesAsync<S1, S2>(setter1: Setter<S1>, setter2: Setter<S2>): Promise<[S1, S2]>;
export function getStatesAsync<S>(setter1: Setter<S>): Promise<[S]>;
export function getStatesAsync(...setters: Setter<unknown>[]): Promise<unknown[]> {
  return Promise.all(setters.map(setter => getStateAsync(setter)));
}
