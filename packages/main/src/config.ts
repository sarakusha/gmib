import fs from 'fs';
import path from 'path';

import { config as nibusConfig } from '@nibus/core/config';
import { notEmpty } from '@novastar/codec';
import debugFactory from 'debug';
import log from 'electron-log';
import Store from 'electron-store';
import { ipcMain } from 'electron';

import type { Config, Page } from '/@common/config';
import { configSchema } from '/@common/schema';
import { asyncSerial } from '/@common/helpers';
import Deferred from '/@common/Deferred';

import { uniquePageTitle, upsertPermanentPage } from './page';
import relaunch from './relaunch';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:config`);
// const version = app.getVersion();

export const port = +(process.env['NIBUS_PORT'] ?? 9001) + 1;

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

const reTitle = /<\s*title[^>]*>(.+)<\s*\/\s*title>/i;
const reId = /<\s*meta\s*data-id=['"](.+?)['"]>/i;

export const testsDeferred = new Deferred();

async function updateTestsImpl(): Promise<void> {
  const testDir = path.resolve(__dirname, '../../renderer/assets/tests');
  const filenames = (await fs.promises.readdir(testDir))
    .map(filename => path.join(testDir, filename))
    .filter(filename => !fs.lstatSync(filename).isDirectory());
  const tests = await Promise.all<Page | undefined>(
    filenames.map(async filename => {
      const html = await fs.promises.readFile(filename, 'utf-8');
      const titleMatches = html.match(reTitle);
      const idMatches = html.match(reId);
      if (!titleMatches || !idMatches) {
        debug(`Отсутствует заголовок или id: ${filename}`);
        return undefined;
      }
      return {
        id: idMatches[1],
        title: titleMatches[1],
        url: `file://${filename}`,
        permanent: true,
      };
    }),
  );
  // const preload = path.resolve(__dirname, '../../playerPreload/dist/index.cjs');
  // tests.push({
  //   id: 'player',
  //   title: 'Video Player',
  //   url: `http://localhost:${9002}/player/index.html`,
  //   preload,
  //   permanent: true,
  // });
  // TODO: Update tests
  // const prev = config.get('pages');
  // const items = uniqBy(tests.concat(prev), 'id');
  // if (!isEqual(prev, items)) config.set('pages', items);
  await asyncSerial(tests.filter(notEmpty), async test =>
    upsertPermanentPage(await uniquePageTitle(test)),
  ).finally(() => {
    testsDeferred.resolve();
  });
}

const migratePages = async (): Promise<void> => {
  const pages = config.get('pages');
  if (Array.isArray(pages)) {
    await asyncSerial(
      pages.filter(({ permanent }) => !permanent),
      async page => upsertPermanentPage(await uniquePageTitle(page)),
    );
    config.delete('pages');
    relaunch();
  }
};

const updateTests = (): void => {
  updateTestsImpl()
    .catch(err => debug(`error while update tests ${err.message}`))
    .then(migratePages);
};

updateTests();

// config.onDidChange('pages', newValue => {
//   if (newValue?.some(({ permanent }) => permanent)) return;
//   process.nextTick(() => updateTests());
// });

ipcMain.handle('getConfig', () => config.store);
ipcMain.on('saveConfig', (e, store) => {
  config.store = store;
});

export default config;
