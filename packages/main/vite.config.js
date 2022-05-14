import { node } from '../../.electron-vendors.cache.json';
import { join } from 'path';
import { builtinModules } from 'module';

const PACKAGE_ROOT = __dirname;

process.env.VITE_APP_NAME = process.env['npm_package_name'];
process.env.VITE_APP_VERSION = process.env['npm_package_version'];
process.env.VITE_DEBUG = `nibus:*,novastar:*,${process.env.VITE_APP_NAME}:*`;

/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
const config = {
  mode: process.env['MODE'],
  root: PACKAGE_ROOT,
  envDir: process.cwd(),
  resolve: {
    alias: {
      '/@common/': join(PACKAGE_ROOT, '../common') + '/',
    },
  },
  build: {
    sourcemap: false,
    target: `node${node}`,
    outDir: 'dist',
    assetsDir: '.',
    minify: process.env.MODE !== 'development',
    lib: {
      entry: join(__dirname, 'src/index.ts'),
      formats: ['cjs'],
    },
    rollupOptions: {
      external: [
        'electron',
        'electron-devtools-installer',
        '@serialport/bindings-cpp',
        'usb-detection',
        'sqlite3',
        '@nibus/detection',
        '@nibus/mibs',
        ...builtinModules.flatMap(p => [p, `node:${p}`]),
      ],
      output: {
        entryFileNames: '[name].cjs',
        manualChunks() {
          return 'index';
        }
      },
    },
    // commonjsOptions: {
    //   dynamicRequireTargets: [
    //   ],
    // },
    emptyOutDir: true,
    brotliSize: false,
    esbuild: {
      legalComments: 'none',
    },
  },
};

export default config;
