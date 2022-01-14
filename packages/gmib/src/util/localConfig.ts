/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import Store, { Schema } from 'electron-store';

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
};

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
  name: 'gmib-local',
  schema: localConfigSchema,
  clearInvalidConfig: true,
  watch: true,
});

export default localConfig;
