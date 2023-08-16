import { join } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import cleanup from 'rollup-plugin-cleanup';
import { builtinModules } from 'module';
// import { nodeResolve } from '@rollup/plugin-node-resolve';

import { chrome } from '../../.electron-vendors.cache.json';

import external from '../../external';
// import { dependencies as external } from '../../package.json';

const PACKAGE_ROOT = __dirname;
const APP_ROOT = join(PACKAGE_ROOT, '../..');

process.env.VITE_APP_NAME = process.env['npm_package_name'];
process.env.VITE_APP_VERSION = process.env['npm_package_version'];
process.env.VITE_DEBUG = `nibus:*,novastar:*,${process.env.VITE_APP_NAME}:*`;

const lib = {
  gmib: 'gmib/index.ts',
  player: 'player/index.ts',
  remote: 'remote/index.ts',
};

const currentLib = lib[process.env.LIB_NAME];
if (!currentLib) {
  throw new Error(`LIB_NAME:${process.env.LIB_NAME} is not defined or is not valid`);
}
/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
const config = {
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  envDir: APP_ROOT,
  resolve: {
    alias: {
      '/@renderer/': join(PACKAGE_ROOT, '../renderer/gmib') + '/',
      '/@player/': join(PACKAGE_ROOT, '../renderer/player') + '/',
      '/@common/': join(PACKAGE_ROOT, '../common') + '/',
    },
    conditions: ['node', 'require', 'default', 'browser'],
    mainFields: ['main'],
  },
  ssr: {
    format: 'cjs',
  },
  build: {
    ssr: true,
    sourcemap: false,
    target: `chrome${chrome}`,
    outDir: 'dist',
    assetsDir: '.',
    minify: process.env.MODE !== 'development',
    lib: {
      fileName: process.env.LIB_NAME, // '[name]',
      entry: currentLib,
      // entry: {
      //   gmib: 'gmib/index.ts',
      //   player: 'player/index.ts',
      //   remote: 'remote/index.ts',
      // },
      formats: ['cjs'],
    },
    rollupOptions: {
      output: {
        entryFileNames: `${process.env.LIB_NAME}.cjs`,
        interop: 'compat',
      },
      plugins: [cleanup({ comments: 'none' })],
      external,
      // external: [
      //   // 'debug',
      //   'electron',
      //   // 'electron-log',
      //   'electron-devtools-installer',
      //   '@serialport/bindings-cpp',
      //   // 'usb',
      //   // 'sqlite3',
      //   // '@nibus/detection',
      //   // '@nibus/core',
      //   // '@nibus/mibs',
      //   // '@nibus/service',
      //   ...Object.keys(dependencies),
      //   ...builtinModules.flatMap(p => [p, `node:${p}`]),
      // ],
    },
    // commonjsOptions: {
    //   include: [/ebml/], // Important!!! Error: 'default' is not exported by...
    // },
    emptyOutDir: false,
  },
};

export default config;
