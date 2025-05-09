/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LogLevel } from '@nibus/core/common';

export type SplineItem = [lux: number, brightness: number];
export const SPLINE_COUNT = 4;
export type Page = {
  id: string;
  url?: string;
  title: string;
  permanent?: true;
  preload?: string;
  userAgent?: string;
  hidden?: boolean;
};
export type Location = {
  latitude?: number;
  longitude?: number;
};
export type ScreenV1 = {
  width?: number;
  height?: number;
  moduleHres?: number;
  moduleVres?: number;
  x?: number;
  y?: number;
  display?: boolean | string;
  address?: string;
  addresses?: string[];
  dirh?: boolean;
  dirv?: boolean;
  borderTop?: number;
  borderBottom?: number;
  borderLeft?: number;
  borderRight?: number;
};

/*
export const defaultScreen: Required<Omit<Screen, 'output' | 'id'>> = {
  name: 'Экран',
  width: 640,
  height: 320,
  moduleHres: 40,
  moduleVres: 40,
  x: 0,
  y: 0,
  display: true,
  addresses: [],
  dirh: false,
  dirv: false,
  borderTop: 0,
  borderBottom: 0,
  borderLeft: 0,
  borderRight: 0,
  brightnessFactor: 1,
};
*/

export type ConfigV1 = {
  location?: Location;
  spline?: SplineItem[];
  autobrightness: boolean;
  brightness: number;
  test?: string;
  screen: ScreenV1;
  logLevel: LogLevel;
  tests: Page[];
};

export const enum AggregationType {
  Maximum,
  Average,
  Median,
}

export type OverheatProtection = {
  interval: number;
  bottomBound: number;
  upperBound: number;
  step: number;
  aggregation: AggregationType;
  enabled: boolean;
};

export const DEFAULT_OVERHEAD_PROTECTION: OverheatProtection = {
  interval: 15,
  bottomBound: 65,
  upperBound: 85,
  step: 5,
  aggregation: 0,
  enabled: false,
};

export type HidOptions = {
  VID?: number;
  PID?: number;
  mute?: number;
  volumeUp?: number;
  volumeDown?: number;
  brightness?: number;
  minBrightness?: number;
};

export type Config = {
  location?: Location;
  spline?: SplineItem[];
  autobrightness: boolean;
  brightness: number;
  logLevel: LogLevel;
  /**
   * @deprecated Left for compatibility with version 4.2
   */
  pages?: Page[];
  version?: string;
  overheatProtection: OverheatProtection;
  disableNet?: boolean;
  hid?: HidOptions;
};

/**
 * domain.sub.device+X,Y:WxH
 */
export const addressPattern =
  '^(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})(?:([+-]+\\d+)(?:,([+-]?\\d+)(?::(\\d+)(?:x(\\d+))?)?)?)?$';
export const reAddress = new RegExp(addressPattern);

/*
export const convertCfgFrom = (cfg: unknown): Config => {
  const { test, tests, screen, ...other } = cfg as ConfigV1;
  const { address, addresses, ...props } = screen ?? {};
  const scr: Screen = {
    addresses: addresses ?? (address ? [address] : []),
    output: test,
    id: 'main',
    name: 'Экран',
    brightnessFactor: 1,
    ...props,
  };
  return {
    pages: tests,
    // screens: [scr],
    overheatProtection: DEFAULT_OVERHEAD_PROTECTION,
    ...other,
  };
};
*/

/*
export const convertCfgTo = (cfg: Config): ConfigV1 => {
  const {
    // screens: [screen],
    pages,
    version,
    ...other
  } = cfg;
  const { addresses, output, id, name, brightnessFactor, ...screenProps } = screen;
  return {
    tests: pages,
    screen: {
      address: addresses && addresses[0],
      ...screenProps,
    },
    test: output,
    ...other,
  };
};
*/
