import log from 'electron-log';
import Store from 'electron-store';
import { config as nibusConfig } from '@nibus/core/lib/config';

import type { Config } from '/@common/config';
import { configSchema } from '/@common/schema';

// const version = app.getVersion();

const config = new Store<Config>({
  name: import.meta.env.VITE_APP_NAME,
  schema: configSchema,
  watch: true,
  clearInvalidConfig: true,
});

// export const prevVersion = config.get('version', version);

config.set('version', import.meta.env.VITE_APP_VERSION);

process.nextTick(() => log.log(`Config: ${config.path}`));

config.onDidChange('logLevel', logLevel => {
  nibusConfig().set('logLevel', logLevel);
});
nibusConfig().set('logLevel', config.get('logLevel'));

export default config;
