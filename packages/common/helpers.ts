import type { PayloadAction } from '@reduxjs/toolkit';
import type React from 'react';

import type { DeviceId } from '@nibus/core';
import type { HWStatus } from '@novastar/screen/HWStatus';
import type { CabinetPosition } from '@novastar/screen/getCabinetPosition';
import type { BaseService } from 'bonjour-hap';

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

export function tuplify<T extends unknown[]>(...args: T): T {
  return args;
}

export const delay = (seconds: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, seconds * 1000);
  });

export function notEmpty<TValue>(value: TValue | null | undefined | void): value is TValue {
  return value !== null && value !== undefined;
}

export type AtLeastOne<T> = { [K in keyof T]: Pick<Required<T>, K> }[keyof T];

type Setter<S> = React.Dispatch<React.SetStateAction<S>>;
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
  setter10: Setter<S10>,
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
  setter9: Setter<S9>,
): Promise<[S1, S2, S3, S4, S5, S6, S7, S8, S9]>;
export function getStatesAsync<S1, S2, S3, S4, S5, S6, S7, S8>(
  setter1: Setter<S1>,
  setter2: Setter<S2>,
  setter3: Setter<S3>,
  setter4: Setter<S4>,
  setter5: Setter<S5>,
  setter6: Setter<S6>,
  setter7: Setter<S7>,
  setter8: Setter<S8>,
): Promise<[S1, S2, S3, S4, S5, S6, S7, S8]>;
export function getStatesAsync<S1, S2, S3, S4, S5, S6, S7>(
  setter1: Setter<S1>,
  setter2: Setter<S2>,
  setter3: Setter<S3>,
  setter4: Setter<S4>,
  setter5: Setter<S5>,
  setter6: Setter<S6>,
  setter7: Setter<S7>,
): Promise<[S1, S2, S3, S4, S5, S6, S7]>;
export function getStatesAsync<S1, S2, S3, S4, S5, S6>(
  setter1: Setter<S1>,
  setter2: Setter<S2>,
  setter3: Setter<S3>,
  setter4: Setter<S4>,
  setter5: Setter<S5>,
  setter6: Setter<S6>,
): Promise<[S1, S2, S3, S4, S5, S6]>;
export function getStatesAsync<S1, S2, S3, S4, S5>(
  setter1: Setter<S1>,
  setter2: Setter<S2>,
  setter3: Setter<S3>,
  setter4: Setter<S4>,
  setter5: Setter<S5>,
): Promise<[S1, S2, S3, S4, S5]>;
export function getStatesAsync<S1, S2, S3, S4>(
  setter1: Setter<S1>,
  setter2: Setter<S2>,
  setter3: Setter<S3>,
  setter4: Setter<S4>,
): Promise<[S1, S2, S3, S4]>;
export function getStatesAsync<S1, S2, S3>(
  setter1: Setter<S1>,
  setter2: Setter<S2>,
  setter3: Setter<S3>,
): Promise<[S1, S2, S3]>;
export function getStatesAsync<S1, S2>(setter1: Setter<S1>, setter2: Setter<S2>): Promise<[S1, S2]>;
export function getStatesAsync<S>(setter1: Setter<S>): Promise<[S]>;
export function getStatesAsync(...setters: Setter<unknown>[]): Promise<unknown[]> {
  return Promise.all(setters.map(setter => getStateAsync(setter)));
}

export const toNumber = (value: string | number): number | undefined =>
  typeof value === 'string' && value.trim().length === 0 ? undefined : Number(value);

export type PropPayload<T, K extends keyof T = keyof T> = readonly [K, T[K]];
// export type PropertiesReducer<T> = React.Reducer<T, PropPayload<T> | [undefined, T]>;
export type PropertiesReducer<T> = React.Reducer<T, PropPayload<T>>;
export type PropPayloadAction<T, K extends keyof T = keyof T> = PayloadAction<PropPayload<T, K>>;

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

export const getRemoteLabel = (port?: number, host?: string): string =>
  `${host ?? 'localhost'}:${port ?? 9001}`;

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NullableOptional<T = any> = PickRequired<T> & Nullable<PickOptional<T>>;

export type WithRequiredProp<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export const findById = <T extends { id: string | number }>(
  items: T[] | undefined,
  id: T['id'],
): T | undefined => items?.find(item => item.id === id);

const nameCountRegexp = /(?:(?:-([\d]+))?)?$/;
const nameCountFunc = (s: string, index: string): string => `-${(parseInt(index, 10) || 0) + 1}`;

export const incrementCounterString = (s: string): string =>
  s.replace(nameCountRegexp, nameCountFunc);

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noop = (): void => {};

export type Writable<T> = { -readonly [P in keyof T]: T[P] };

export const toErrorMessage = (e: unknown): string =>
  // eslint-disable-next-line no-nested-ternary
  e == null ? 'Unknown error' : e instanceof Error ? e.message : `${e}`;

export function minmax(max: number, value: number): number;
export function minmax(min: number, max: number, value: number): number;
export function minmax(...args: number[]): number {
  const [min, max, value] = args.length === 2 ? [0, ...args] : args;
  return Math.max(min, Math.min(max, value));
}

export const getEnumValues = (numEnums: Record<string, number | string>): number[] =>
  Object.values(numEnums)
    .filter(value => Number.isInteger(value))
    .sort() as number[];

export const getEnumEntries = <Enum extends Record<string, number | string>>(
  numEnum: Enum,
): [keyof Enum, number][] =>
  getEnumValues(numEnum).map<[keyof Enum, number]>(value => [numEnum[value].toString(), value]);

export type VertexType = { x: number; y: number };

// eslint-disable-next-line no-shadow
export enum Minihost3Selector {
  Temperature,
  Voltage1,
  Voltage2,
  Version,
  RedVertex,
  GreenVertex,
  BlueVertex,
}

export type Minihost3Info = {
  t?: number;
  v1?: number;
  v2?: number;
  MCU?: string;
  PLD?: string;
  redVertex?: VertexType;
  greenVertex?: VertexType;
  blueVertex?: VertexType;
};
export type Minihost2Info = {
  t?: number;
  ver?: string;
};

export const XMAX = 24;

export const YMAX = 32;

export type ValueStatus = 'succeeded' | 'failed' | 'pending';
export type ValueType = string | number | boolean | null;
export type ValueState<T extends ValueType = ValueType> = {
  status: ValueStatus;
  value: T;
  raw: T;
  error?: string;
};
export const isPositiveNumber = (state?: ValueState): state is ValueState<number> =>
  typeof state?.value === 'number' && state.value > 0;

export const calcMaxValue = (screen: ValueState, module: ValueState, max: number): number => {
  if (!isPositiveNumber(screen) || !isPositiveNumber(module)) return max;
  return Math.min(Math.ceil(screen.value / module.value), max);
};
export type IModuleInfo<T> = {
  x: number;
  y: number;
  info?: T;
  error?: string;
};

export type FinderOptions = {
  address?: string;
  type?: number;
  owners: DeviceId[];
};
export type CustomHost = {
  port: number;
  address: string;
  name?: string;
};
export type Aggregations = [maximum: number, average: number, median: number];
export type ScreenHealth = {
  aggregations: Aggregations;
  maxBrightness?: number;
};
export type Health = {
  screens: Record<string, ScreenHealth>;
  timestamp?: number;
};
export type LocalConfig = {
  hosts: CustomHost[];
  autostart: boolean;
  health: Health;
  salt?: string;
  verifier?: string;
  readonly identifier: string;
};

export type Modules = IModuleInfo<Minihost2Info | Minihost3Info>[];

export type Telemetry<Options, Info> = {
  start(options: Options, cb?: React.Dispatch<React.SetStateAction<Info>>): Promise<Info>;
  cancel(): Promise<void>;
};

export type LoaderOptions = {
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  selectors?: number[];
};
export type NibusTelemetry = Telemetry<LoaderOptions, Modules>;
export type Status = ReturnType<HWStatus['toJSON']>;
export type CabinetInfo = CabinetPosition & {
  screen: number;
  status?: Status | null;
  mcuVersion?: string | null;
  fpgaVersion?: string | null;
};

export enum NovastarSelector {
  Temperature,
  Voltage,
  MCU_Version,
  FPGA_Version,
}

export type NovastarOptions = {
  // screenIndex: number;
  selectors: Set<NovastarSelector>;
};

export type NovastarTelemetry = Telemetry<NovastarOptions, CabinetInfo[]>;
export type TelemetryOpts = {
  timestamp: number;
  address: string;
  x: number;
  y: number;
  temperature: number;
};

export const toHexId = (id: number): string => id.toString(16).toUpperCase().padStart(8, '0');

export const asyncSerial = <T>(
  input: T[],
  action: (item: T, index: number) => Promise<void>,
): Promise<void> =>
  input.reduce((acc, item, index) => acc.then(() => action(item, index)), Promise.resolve());
