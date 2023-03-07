import { logLevels } from '@nibus/core/common';
import Ajv from 'ajv';
import type { Schema } from 'electron-store';

import type { Config } from './config';
import { DEFAULT_OVERHEAD_PROTECTION, SPLINE_COUNT } from './config';

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
    default: [
      [10, 10],
      [10000, 80],
    ],
    maxItems: SPLINE_COUNT,
  },
  autobrightness: {
    type: 'boolean',
    default: false,
  },
  brightness: {
    type: 'number',
    default: 30,
  },
  // test: {
  //   type: 'string',
  // },
  /*
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
          default: 0,
        },
        y: {
          type: 'integer',
          default: 0,
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
          default: ['255.255.1'],
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
*/
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
        userAgent: { type: 'string' },
      },
      required: ['id', 'title'],
    },
    default: [],
  },
  fixedPages: { type: 'boolean' },
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
};
const ajv = new Ajv({ removeAdditional: 'failing' });
export const validateConfig = ajv.compile<Config>({
  type: 'object',
  additionalProperties: false,
  properties: configSchema,
});
