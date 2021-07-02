/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import Store from 'electron-store';
import { Config, configSchema, convertCfgFrom } from '../util/config';
import { log } from '../util/debug';
import { version } from '../util/helpers';

const config = new Store<Config>({
  name: 'gmib',
  schema: configSchema,
  watch: true,
  clearInvalidConfig: true,
  migrations: {
    '>3.0.6': store => {
      store.set(convertCfgFrom(store.store));
    },
  },
});

export const prevVersion = config.get('version', version);

config.set('version', version);

process.nextTick(() => log.log(`Config: ${config.path}`));

export default config;
