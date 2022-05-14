/* eslint-env node */

import {defineConfig} from 'vite';
import {fileURLToPath} from 'url';
import {join, dirname} from 'path';
import {builtinModules} from 'module';
// eslint-disable-next-line import/no-extraneous-dependencies
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import checker from 'vite-plugin-checker';
import {createRequire} from 'module'; // Bring in the ability to create the 'require' method

const require = createRequire(import.meta.url);
const {chrome} = require('../../.electron-vendors.cache.json');
const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url));
// const PACKAGE_ROOT = __dirname;

process.env.VITE_APP_NAME = process.env['npm_package_name'];
process.env.VITE_APP_VERSION = process.env['npm_package_version'];
process.env.VITE_DEBUG = `nibus:*,novastar:*,${process.env.VITE_APP_NAME}:*`;

/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
export default defineConfig({
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  resolve: {
    alias: {
      '/@common/': join(PACKAGE_ROOT, '../common') + '/',
    },
  },
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),
    mdx(),
    checker({typescript: true}),
  ],
  base: '',
  server: {
    fs: {
      strict: true,
    },
  },
  build: {
    sourcemap: false,
    target: `chrome${chrome}`,
    outDir: 'dist',
    assetsDir: '.',
    minify: process.env.MODE !== 'development',
    rollupOptions: {
      input: join(PACKAGE_ROOT, 'index.html'),
      external: ['electron', ...builtinModules.flatMap(p => [p, `node:${p}`])],
    },
    emptyOutDir: true,
    brotliSize: false,
  },
  test: {
    environment: 'happy-dom',
  },
  optimizeDeps: {
    include: ['react/jsx-runtime'],
  },
});
