import { node } from '../../.electron-vendors.cache.json';
import path from 'path';
import { builtinModules } from 'module';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const PACKAGE_ROOT = __dirname;

process.env.VITE_APP_NAME = process.env['npm_package_name'];
process.env.VITE_APP_VERSION = process.env['npm_package_version'];
process.env.VITE_DEBUG = `nibus:*,novastar:*,${process.env.VITE_APP_NAME}:*`;
process.env.VITE_PLAYER = process.env['PLAYER'];

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
      '/@common/': path.join(PACKAGE_ROOT, '../common') + '/',
      'file-type': require.resolve('file-type'),
      'strtok3/core': require.resolve('strtok3/core'),
      strtok3: require.resolve('strtok3'),
      'iconv-lite': require.resolve('iconv-lite'),
      hexoid: require.resolve('hexoid'),
    },
    // conditions: ['node', 'require', 'default'],
  },
  build: {
    sourcemap: false,
    target: `node${node}`,
    outDir: 'dist',
    assetsDir: '.',
    minify: process.env.MODE !== 'development',
    lib: {
      entry: path.join(__dirname, 'src/index.ts'),
      formats: ['cjs'],
    },
    rollupOptions: {
      external: [
        'iconv-lite',
        'electron',
        'electron-devtools-installer',
        '@serialport/bindings-cpp',
        'usb-detection',
        'sqlite3',
        '@nibus/detection',
        '@nibus/mibs',
        'formidable',
        ...builtinModules.flatMap(p => [p, `node:${p}`]),
      ],
      output: {
        entryFileNames: '[name].cjs',
        manualChunks() {
          return 'index';
        },
      },
      plugins: [
        nodeResolve(),
        /*
                {
                  name: 'test',
                  transform(code, id) {
                    if (id.indexOf('parsers') !== -1) console.log(id);
                    return null;
                  },
                  resolveDynamicImport(specifier, importer) {
                    console.log({ specifier, importer });
                    return null;
                  },
                },
        */
      ],
    },
    emptyOutDir: true,
    brotliSize: false,
    esbuild: {
      legalComments: 'none',
    },
    // commonjsOptions: {
    //   dynamicRequireTargets:
    // }
  },
};

export default config;
