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

export type CustomHost = {
  port: number;
  address: string;
  name?: string;
};

export type LocalConfig = {
  hosts: CustomHost[];
  autostart: boolean;
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
};

const localConfig = new Store<LocalConfig>({
  name: 'gmib-local',
  schema: localConfigSchema,
  watch: true,
});

export default localConfig;
