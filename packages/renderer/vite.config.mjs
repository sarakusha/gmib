/* eslint-env node */

import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';
import { builtinModules } from 'module';
// eslint-disable-next-line import/no-extraneous-dependencies
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import checker from 'vite-plugin-checker';
import { createRequire } from 'module'; // Bring in the ability to create the 'require' method
import { visualizer } from 'rollup-plugin-visualizer';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import helmet from 'helmet';
import preventLoadSourceMap from '../common/preventLoadSourceMap';

const require = createRequire(import.meta.url);
const { chrome } = require('../../.electron-vendors.cache.json');
const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
// const PACKAGE_ROOT = __dirname;

const playerInput = path.resolve(PACKAGE_ROOT, '../player/index.html');
console.log({ playerInput });

process.env.VITE_APP_NAME = process.env['npm_package_name'];
process.env.VITE_APP_VERSION = process.env['npm_package_version'];
process.env.VITE_DEBUG = `nibus:*,novastar:*,${process.env.VITE_APP_NAME}:*`;

const isDev = process.env.MODE === 'development';

/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
export default defineConfig({
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  resolve: {
    alias: {
      '/@common/': path.join(PACKAGE_ROOT, '../common') + '/',
      // '/@player/': path.join(PACKAGE_ROOT, '../player/src') + '/',
    },
  },
  plugins: [
    visualizer(),
    nodeResolve(),
    react({
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),
    mdx({ remarkPlugins: [] }),
    checker({ typescript: true }),
    {
      name: 'configure-response-headers',
      configureServer: server => {
        server.middlewares.use(helmet.crossOriginEmbedderPolicy());
        server.middlewares.use(helmet.crossOriginOpenerPolicy());
        server.middlewares.use(helmet.originAgentCluster());
        server.middlewares.use(preventLoadSourceMap);
      },
    },
  ],
  base: '',
  server: {
    fs: {
      strict: true,
    },
    proxy: {
      '^/(api|public|player)': {
        target: `http://localhost:${+(process.env['NIBUS_PORT'] ?? 9001) + 1}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false,
    target: `chrome${chrome}`,
    outDir: 'dist',
    assetsDir: '.',
    // assetsInlineLimit: 12*1024,
    minify: false, //process.env.MODE !== 'development',
    rollupOptions: {
      input: {
        renderer: path.join(PACKAGE_ROOT, 'index.html'),
        // player: playerInput, // path.resolve(PACKAGE_ROOT, '../player/index.html'),
      },
      external: ['electron', ...builtinModules.flatMap(p => [p, `node:${p}`])],
    },
    // commonjsOptions: {
    //   include: [], // Important!!! Error: 'default' is not exported by...
    // },
    emptyOutDir: true,
    brotliSize: false,
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'happy-dom',
  },
  optimizeDeps: {
    include: ['react/jsx-runtime'],
  },
  // https://github.com/vitejs/vite/issues/8644#issuecomment-1159308803
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
  },
});
