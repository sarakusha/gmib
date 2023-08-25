import { node } from '../../.electron-vendors.cache.json';
import path from 'path';
import cleanup from 'rollup-plugin-cleanup';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const PACKAGE_ROOT = __dirname;
const APP_ROOT = path.resolve(PACKAGE_ROOT, '../..');

process.env.VITE_APP_NAME = process.env['npm_package_name'];
process.env.VITE_APP_VERSION = process.env['npm_package_version'];
process.env.VITE_DEBUG = `nibus:*,novastar:*,${process.env.VITE_APP_NAME}:*`;
process.env.VITE_PLAYER = process.env['PLAYER'];

// console.log('CWD', process.cwd(), path.resolve(PACKAGE_ROOT, '../..'));

/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
const config = {
  mode: process.env['MODE'],
  root: PACKAGE_ROOT,
  envDir: APP_ROOT,
  resolve: {
    alias: {
      '/@common/': path.join(PACKAGE_ROOT, '../common') + '/',
    },
    conditions: ['node', 'require'],
    mainFields: ['main'],
  },
  // ssr: {
  //   format: 'cjs',
  // },
  build: {
    ssr: true,
    sourcemap: 'inline',
    target: `node${node}`,
    outDir: 'dist',
    assetsDir: '.',
    minify: process.env.MODE !== 'development',
    lib: {
      entry: path.join(PACKAGE_ROOT, 'src/index.ts'),
      formats: ['cjs'],
    },
    rollupOptions: {
      external: [
        // 'electron',
        // 'electron-devtools-installer',
        '@serialport/bindings-cpp',
        'usb',
        'sqlite3',
        '@nibus/detection',
      ],
      output: {
        entryFileNames: 'index.cjs',
        interop: 'compat',
      },
      plugins: [nodeResolve(['require', 'node', 'main']), cleanup({ comments: 'none' })],
    },
    emptyOutDir: true,
  },
};

export default config;
