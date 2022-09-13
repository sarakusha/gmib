/* eslint-env node */

import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { builtinModules } from 'module';
// eslint-disable-next-line import/no-extraneous-dependencies
import react from '@vitejs/plugin-react';
import checker from 'vite-plugin-checker';
import { createRequire } from 'module'; // Bring in the ability to create the 'require' method
import helmet from 'helmet';
import preventLoadSourceMap from '../common/preventLoadSourceMap';

const require = createRequire(import.meta.url);
const { chrome } = require('../../.electron-vendors.cache.json');
const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url));
// const PACKAGE_ROOT = __dirname;

process.env.VITE_APP_NAME = process.env['npm_package_name'];
process.env.VITE_APP_VERSION = process.env['npm_package_version'];
process.env.VITE_DEBUG = `nibus:*,novastar:*,${process.env.VITE_APP_NAME}:*`;
// process.env.VITE_PLAYER = '1';
// process.env.VITE_EXPRESS = `http://localhost:${+(process.env['NIBUS_PORT'] ?? 9001) + 1}`;

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
    // mdx(),
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
      '^/(api|public|output)': {
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
    esbuildOptions: {
      target: `chrome${chrome}`,
    },
  },
  // https://github.com/vitejs/vite/issues/8644#issuecomment-1159308803
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
  },
});
