import type { Schema } from 'electron-store';
import Store from 'electron-store';

import type { LocalConfig } from '/@common/helpers';

const localConfigSchema: Schema<LocalConfig> = {
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
};

const localConfig = new Store<LocalConfig>({
  name: `${import.meta.env.VITE_APP_NAME}-local`,
  schema: localConfigSchema,
  clearInvalidConfig: true,
  watch: true,
});

export default localConfig;
