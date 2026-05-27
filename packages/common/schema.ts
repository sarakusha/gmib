import { logLevels } from '@nibus/core/common';
import Ajv from 'ajv/dist/2020';
import type { Schema } from 'electron-store';

import type { Config } from './config';
import { DEFAULT_OVERHEAD_PROTECTION, SPLINE_COUNT, SUN_SPLINE_COUNT } from './config';

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
      prefixItems: [
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
      items: false,
      minItems: 2,
      maxItems: 2,
    },
    minItems: 2,
    default: [
      [10, 10],
      [10000, 80],
    ],
    maxItems: SPLINE_COUNT,
  },
  sunSpline: {
    type: 'array',
    items: {
      type: 'array',
      prefixItems: [
        {
          type: 'string',
          pattern:
            '^(event:(dawn|sunrise|sunriseEnd|goldenHourEnd|solarNoon|goldenHour|sunsetStart|sunset|dusk|nadir)|time:([01]\\d|2[0-3]):[0-5]\\d)$',
        },
        {
          type: 'number',
          minimum: 0,
          maximum: 100,
        },
      ],
      items: false,
      minItems: 2,
      maxItems: 2,
    },
    minItems: 0,
    default: [
      ['event:dawn', 10],
      ['event:solarNoon', 80],
      ['event:dusk', 10],
    ],
    maxItems: SUN_SPLINE_COUNT,
  },
  nightMode: {
    type: 'object',
    properties: {
      start: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
      end: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
      brightness: { type: 'number', minimum: 0, maximum: 100 },
    },
  },
  autobrightness: {
    type: 'boolean',
    default: false,
  },
  brightness: {
    type: 'number',
    default: 30,
  },
  logLevel: {
    enum: Object.keys(logLevels),
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
        permanent: { type: 'boolean' },
        preload: { type: 'string' },
      },
      required: ['id', 'title'],
    },
  },
  version: { type: 'string' },
  overheatProtection: {
    type: 'object',
    properties: {
      interval: {
        type: 'integer',
        minimum: 0,
        maximum: 60,
        default: DEFAULT_OVERHEAD_PROTECTION.interval,
      },
      bottomBound: {
        type: 'integer',
        minimum: 0,
        maximum: 200,
        default: DEFAULT_OVERHEAD_PROTECTION.bottomBound,
      },
      upperBound: {
        type: 'integer',
        minimum: 0,
        maximum: 200,
        default: DEFAULT_OVERHEAD_PROTECTION.upperBound,
      },
      step: { type: 'integer', minimum: 1, maximum: 25, default: DEFAULT_OVERHEAD_PROTECTION.step },
      aggregation: { enum: [0, 1, 2], default: DEFAULT_OVERHEAD_PROTECTION.aggregation },
      enabled: { type: 'boolean', default: DEFAULT_OVERHEAD_PROTECTION.enabled },
    },
    default: DEFAULT_OVERHEAD_PROTECTION,
    // required: ['interval', 'bottomBound', 'upperBound'],
  },
  disableNet: { type: 'boolean' },
  hid: {
    type: 'object',
    properties: {
      VID: { type: 'integer' },
      PID: { type: 'integer' },
      mute: { type: 'integer', default: 1 },
      volumeDown: { type: 'integer', default: 2 },
      volumeUp: { type: 'integer', default: 4 },
      brightness: { type: 'integer', default: 60, minimum: 0, maximum: 100 },
      minBrightness: { type: 'integer', default: 15, minimum: 0, maximum: 100 },
    },
    default: {},
  },
};
const ajv = new Ajv({ removeAdditional: 'failing' });
export const validateConfig = ajv.compile<Config>({
  type: 'object',
  additionalProperties: false,
  properties: configSchema,
});
