/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import Store, { Schema } from 'electron-store';

type DeviceAddress = string;
type DeviceAlias = string;
// export type Altitude = `${number}`;
// export type HistoryItem = [average: number, count: number];
export type SplineItem = [lux: number, brightness: number];
export const SPLINE_COUNT = 4;

type Config = {
  aliases?: Record<DeviceAddress, DeviceAlias>;
  location?: {
    latitude: number;
    longitude: number;
  };
  spline?: SplineItem[];
  // history?: Record<Altitude, HistoryItem>;
  autobrightness: boolean;
  brightness: number;
};

const schema: Schema<Config> = {
  aliases: {
    type: 'object',
    additionalProperties: {
      type: 'string',
    },
  },
  location: {
    type: 'object',
    properties: {
      latitude: { type: 'number', minimum: -90, maximum: 90 },
      longitude: { type: 'number', minimum: -180, maximum: 180 },
    },
    required: ['latitude', 'longitude'],
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
};

const config = new Store<Config>({
  name: 'gmib',
  schema,
});
export default config;
