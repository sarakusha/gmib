/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { LogLevel, LogLevelV } from '@nibus/core';
import Store, { Schema } from 'electron-store';
import { log } from './debug';

// type DeviceAddress = string;
// type DeviceAlias = string;

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
export type Screen = {
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
};

export type Config = {
  // aliases?: Record<DeviceAddress, DeviceAlias>;
  location?: Location;
  spline?: SplineItem[];
  // history?: Record<Altitude, HistoryItem>;
  autobrightness: boolean;
  brightness: number;
  test?: string;
  screen: Screen;
  logLevel: LogLevel;
  tests: Page[];
};

/**
 * domain.sub.device+X,Y:WxH
 */
const addressPattern =
  '^(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})(?:([+-]+\\d+)(?:,([+-]?\\d+)(?::(\\d+)(?:x(\\d+))?)?)?)?$';
export const reAddress = new RegExp(addressPattern);

export const configSchema: Schema<Config> = {
  // aliases: {
  //   type: 'object',
  //   additionalProperties: {
  //     type: 'string',
  //   },
  // },
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
  // history: {
  //   type: 'object',
  //   patternProperties: {
  //     '^\\d?\\d$': {
  //       type: 'array',
  //       items: [{ type: 'number' }, { type: 'number' }],
  //       additionalItems: false,
  //       minItems: 2,
  //     },
  //   },
  // },
  autobrightness: {
    type: 'boolean',
    default: false,
  },
  brightness: {
    type: 'integer',
    default: 30,
  },
  test: {
    type: 'string',
  },
  screen: {
    type: 'object',
    properties: {
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
    },
  },
  logLevel: {
    enum: Object.keys(LogLevelV.keys),
    default: 'none',
  },
  tests: {
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
};

const config = new Store<Config>({
  name: 'gmib',
  schema: configSchema,
  watch: true,
  migrations: {
    '>3.0.6': store => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const screen: any = store.get('screen');
      if (screen.address) {
        screen.addresses = [screen.address];
        delete screen.address;
        store.set('screen', screen);
      }
    },
  },
});

log.log(`Config: ${config.path}`);
// if (process && process.type === 'renderer') throw new Error('Should run in the main process');

export default config;
