import { builtinModules } from 'module';
import { join } from 'path';
import { nodeResolve } from '@rollup/plugin-node-resolve';

import { chrome } from '../../.electron-vendors.cache.json';

const PACKAGE_ROOT = __dirname;

process.env.VITE_APP_NAME = process.env['npm_package_name'];
process.env.VITE_APP_VERSION = process.env['npm_package_version'];
process.env.VITE_DEBUG = `nibus:*,novastar:*,${process.env.VITE_APP_NAME}:*`;

/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
const config = {
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  envDir: process.cwd(),
  resolve: {
    alias: {
      '/@main/': join(PACKAGE_ROOT, '../main/src') + '/',
      '/@renderer/': join(PACKAGE_ROOT, '../renderer/gmib') + '/',
      '/@player/': join(PACKAGE_ROOT, '../renderer/player') + '/',
      '/@common/': join(PACKAGE_ROOT, '../common') + '/',
    },
  },
  // optimizeDeps: {
  //   include: ['@novastar/codec'],
  // },
  build: {
    sourcemap: false,
    target: `chrome${chrome}`,
    outDir: 'dist',
    assetsDir: '.',
    minify: process.env.MODE !== 'development',
    lib: {
      entry: 'src/index.ts',
      formats: ['cjs'],
    },
    rollupOptions: {
      plugins: [
        nodeResolve(),
        /*
        {
          name: 'disable-treeshake',
          transform(code, id) {
            if (
              /@novastar[\\/]screen[\\/]lib[\\/]api[\\/]/.test(id) ||
              /@novastar[\\/]native[\\/]lib[\\/]generated[\\/]api[\\/]/.test(id)
            ) {
              // Disable tree shake for @novastar/{screen/lib,native/lib/generated}/api
              return {
                code,
                map: null,
                moduleSideEffects: 'no-treeshake',
              };
            }
            return null;
          },
        },
*/
      ],
      external: [
        'iconv-lite',
        'electron',
        'electron-store',
        '@nibus/detection',
        '@nibus/mibs',
        ...builtinModules.flatMap(p => [p, `node:${p}`]),
      ],
      output: {
        entryFileNames: '[name].cjs',
        manualChunks() {
          return 'index';
        },
      },
    },
    // commonjsOptions: {
    //   include: [], // Important!!! Error: 'default' is not exported by...
    // },
    emptyOutDir: false,
    brotliSize: false,
  },
};

export default config;
