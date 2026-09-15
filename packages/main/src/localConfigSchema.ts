import { nanoid } from 'nanoid';
import type { Schema } from 'electron-store';

import type { LocalConfig } from '/@common/helpers';

export const localConfigSchema: Schema<LocalConfig> = {
  hosts: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        port: { type: 'number' },
        address: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['port', 'address'],
    },
    default: [],
  },
  autostart: { type: 'boolean', default: false },
  exactWindowPlacement: { type: 'boolean', default: false },
  linuxPreferSoftwareDecoding: { type: 'boolean', default: false },
  localGmibHidden: { type: 'boolean', default: false },
  localPlayerTabs: {
    type: 'array',
    items: { type: 'integer' },
  },
  health: {
    type: 'object',
    properties: {
      screens: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            aggregations: {
              type: 'array',
              items: { type: 'integer' },
              maxItems: 3,
              minItems: 3,
            },
            maxBrightness: { type: 'integer' },
          },
        },
        default: {},
      },
      timestamp: { type: 'integer' },
    },
    default: {},
  },
  salt: { type: 'string' },
  verifier: { type: 'string' },
  identifier: { type: 'string', default: nanoid(), readOnly: true },
  announce: { type: 'string' },
  iv: { type: 'string' },
  pritunlUserId: { type: 'string' },
  knock: { type: 'string' },
  autoUpdate: { type: 'boolean', default: false },
  taurusPasswords: {
    type: 'object',
    additionalProperties: { type: 'string' },
    default: {},
  },
  taurusConfigurationBackups: {
    type: 'object',
    default: {},
  },
};
