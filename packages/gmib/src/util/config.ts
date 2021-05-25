/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { LogLevel, LogLevelV } from '@nibus/core';
import Ajv from 'ajv';
import { Schema } from 'electron-store';

export type SplineItem = [lux: number, brightness: number];
export const SPLINE_COUNT = 4;
export type Page = {
  id: string;
  url?: string;
  title?: string;
  permanent?: true;
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

export type Screen = {
  id: string;
  name: string;
  width?: number;
  height?: number;
  moduleHres?: number;
  moduleVres?: number;
  x?: number;
  y?: number;
  display?: boolean | string;
  addresses?: string[];
  dirh?: boolean;
  dirv?: boolean;
  borderTop?: number;
  borderBottom?: number;
  borderLeft?: number;
  borderRight?: number;
  output?: string;
  brightnessFactor?: number;
};

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

export type Config = {
  location?: Location;
  spline?: SplineItem[];
  autobrightness: boolean;
  brightness: number;
  screens: Screen[];
  logLevel: LogLevel;
  pages: Page[];
  version?: string;
};

/**
 * domain.sub.device+X,Y:WxH
 */
const addressPattern =
  '^(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})(?:([+-]+\\d+)(?:,([+-]?\\d+)(?::(\\d+)(?:x(\\d+))?)?)?)?$';
export const reAddress = new RegExp(addressPattern);

export const configSchema: Schema<Config> = {
  location: {
    type: 'object',
    properties: {
      latitude: { type: 'number', minimum: -90, maximum: 90 },
      longitude: { type: 'number', minimum: -180, maximum: 180 },
    },
    // required: ['latitude', 'longitude'],
  },
  spline: {
    type: 'array',
    items: {
      type: 'array',
      items: [
        {
          type: 'number',
          minimum: 0,
          maximum: 65535,
        },
        {
          type: 'number',
          minimum: 0,
          maximum: 100,
        },
      ],
      additionalItems: false,
      minItems: 2,
    },
    maxItems: SPLINE_COUNT,
  },
  autobrightness: {
    type: 'boolean',
    default: false,
  },
  brightness: {
    type: 'integer',
    default: 30,
  },
  // test: {
  //   type: 'string',
  // },
  screens: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: {
          type: 'string',
          default: 'Экран',
        },
        width: {
          type: 'integer',
          minimum: 0,
          // default: 640,
        },
        height: {
          type: 'integer',
          minimum: 0,
          // default: 320,
        },
        moduleHres: {
          type: 'integer',
          minimum: 8,
          // default: 40,
        },
        moduleVres: {
          type: 'integer',
          minimum: 8,
          // default: 40,
        },
        x: {
          type: 'integer',
          // default: 0,
        },
        y: {
          type: 'integer',
          // default: 0,
        },
        display: {
          anyOf: [{ type: 'string' }, { type: 'boolean' }],
          default: true,
        },
        addresses: {
          type: 'array',
          uniqueItems: true,
          items: {
            type: 'string',
            pattern: addressPattern,
          },
          default: [],
        },
        dirh: {
          type: 'boolean',
          default: false,
        },
        dirv: {
          type: 'boolean',
          default: false,
        },
        borderTop: {
          type: 'integer',
          default: 0,
        },
        borderBottom: {
          type: 'integer',
          default: 0,
        },
        borderLeft: {
          type: 'integer',
          default: 0,
        },
        borderRight: {
          type: 'integer',
          default: 0,
        },
        output: { type: 'string' },
        brightnessFactor: { type: 'number', minimum: 0, maximum: 4, default: 1 },
      },
      required: ['id'],
      default: [],
    },
  },
  logLevel: {
    enum: Object.keys(LogLevelV.keys),
    default: 'none',
  },
  pages: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        url: { type: 'string' },
        title: { type: 'string' },
      },
      required: ['id', 'title'],
    },
    default: [],
  },
  version: { type: 'string' },
};

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
  return { pages: tests, screens: [scr], ...other };
};

export const convertCfgTo = (cfg: Config): ConfigV1 => {
  const {
    screens: [screen],
    pages,
    // eslint-disable-next-line no-shadow
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

const ajv = new Ajv({ removeAdditional: 'failing' });

export const validateConfig = ajv.compile({
  type: 'object',
  additionalProperties: false,
  properties: configSchema,
});
