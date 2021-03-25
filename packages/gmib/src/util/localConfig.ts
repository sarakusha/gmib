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
// import type { Display, Rectangle } from 'electron';

export type CustomHost = {
  port: number;
  address: string;
};

// type DisplayType = Pick<Display, 'id' | 'bounds' | 'workArea' | 'displayFrequency' | 'internal'>;

export type LocalConfig = {
  hosts: CustomHost[];
  autostart: boolean;
  // displays: DisplayType[];
};

const localConfigSchema: Schema<LocalConfig> = {
  hosts: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        port: { type: 'number' },
        address: { type: 'string' },
      },
      required: ['port', 'address'],
    },
    default: [],
  },
  autostart: { type: 'boolean', default: false },
  /*
  displays: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        displayFrequency: { type: 'number' },
        internal: { type: 'boolean' },
        bounds: {
          type: 'object',
          properties: {
            x: { type: 'integer' },
            y: { type: 'integer' },
            width: { type: 'integer' },
            height: { type: 'integer' },
          },
          required: ['x', 'y', 'width', 'height'],
        },
        workArea: {
          type: 'object',
          properties: {
            x: { type: 'integer' },
            y: { type: 'integer' },
            width: { type: 'integer' },
            height: { type: 'integer' },
          },
          required: ['x', 'y', 'width', 'height'],
        },
      },
      required: ['id', 'displayFrequency', 'internal', 'bounds', 'workArea']
    },
  },
*/
};

const localConfig = new Store<LocalConfig>({
  name: 'gmib-local',
  schema: localConfigSchema,
  watch: true,
});

export default localConfig;
