/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { getNibusSession, INibusSession } from '@nibus/core';
import { PayloadAction } from '@reduxjs/toolkit';
import type { BaseService } from 'bonjour-hap';
import React, { Dispatch, SetStateAction } from 'react';
import type { SessionId } from '../store/sessionsSlice';

// eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
export const { version } = require('../../package.json');

export function tuplify<T extends unknown[]>(...args: T): T {
  return args;
}

export const delay = (seconds: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, seconds * 1000));

export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}

export type AtLeastOne<T> = { [K in keyof T]: Pick<Required<T>, K> }[keyof T];

type Setter<S> = Dispatch<SetStateAction<S>>;
export const getStateAsync = <S>(setter: Setter<S>): Promise<S> =>
  new Promise<S>(resolve => {
    setter(prevState => {
      resolve(prevState);
      return prevState;
    });
  });
// export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];
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

export const getSession = (id?: SessionId): INibusSession => {
  const [host, port = process.env.NIBUS_PORT ?? '9001'] = id?.split(':') ?? [];
  return getNibusSession(+port, host || undefined);
};

export const getSessionId = ({ host, port }: Pick<INibusSession, 'host' | 'port'>): SessionId =>
  `${host ?? ''}:${port}` as SessionId;
// export type Altitude = `${number}`;
// export type HistoryItem = [average: number, count: number];

export const toNumber = (value: string): number | undefined =>
  value.trim().length === 0 ? undefined : Number(value);

export type PropPayload<T, K extends keyof T = keyof T> = readonly [K, T[K]];
// export type PropertiesReducer<T> = React.Reducer<T, PropPayload<T> | [undefined, T]>;
export type PropertiesReducer<T> = React.Reducer<T, PropPayload<T>>;
export type PropPayloadAction<T> = PayloadAction<PropPayload<T>>;
export function createPropsReducer<T extends Record<string, unknown>>(): PropertiesReducer<T> {
  return (state, [prop, value]) => ({
    ...state,
    [prop]: value,
  });
}

export type RemoteHost = Pick<BaseService, 'port' | 'name' | 'host'> & {
  address: string;
  version: string;
};

/*
export const getParameterByName = (name: string): string | undefined => {
  const safeName = name.replace(/[[]/, '\\[').replace(/[\]]/, '\\]');
  const regex = new RegExp(`[?&]${name}=([^&#]*)`);
  const results = regex.exec(window.location.search);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};
*/

export const getTitle = (port: number, host?: string): string =>
  `gmib - ${host || 'localhost'}:${port}`;

export const getRemoteLabel = (port?: number, host?: string): string =>
  `${host ?? 'localhost'}:${port ?? process.env.NIBUS_PORT ?? 9001}`;

type FilterFlags<Base, Condition> = {
  [Key in keyof Base]: Base[Key] extends Condition ? Key : never;
};

export type FilterNames<Base, Condition> = FilterFlags<Base, Condition>[keyof Base];
export type SubType<Base, Condition> = Pick<Base, FilterNames<Base, Condition>>;
export type OmitType<Base, Condition> = Omit<Base, FilterNames<Base, Condition>>;

export type RequiredKeys<T> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [K in keyof T]-?: {} extends { [P in K]: T[K] } ? never : K;
}[keyof T];
export type OptionalKeys<T> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [K in keyof T]-?: {} extends { [P in K]: T[K] } ? K : never;
}[keyof T];
export type PickRequired<T> = Pick<T, RequiredKeys<T>>;
export type PickOptional<T> = Pick<T, OptionalKeys<T>>;
export type Nullable<T> = { [P in keyof T]: T[P] | null };
export type NullableOptional<T> = PickRequired<T> & Nullable<PickOptional<T>>;

export const findById = <T extends { id: string }>(
  items: T[] | undefined,
  id: string
): T | undefined => items?.find(item => item.id === id);

const nameCountRegexp = /(?:(?:-([\d]+))?)?$/;
const nameCountFunc = (s: string, index: string): string => `-${(parseInt(index, 10) || 0) + 1}`;

export const incrementCounterString = (s: string): string =>
  s.replace(nameCountRegexp, nameCountFunc);

export const noop = (): void => {};

export type Writeable<T> = { -readonly [P in keyof T]: T[P] };
