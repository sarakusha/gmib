const { version } = require('./package.json');

if (process.env.VITE_APP_VERSION === undefined) {
  // const now = new Date();
  // process.env.VITE_APP_VERSION = `${now.getUTCFullYear() - 2000}.${
  //   now.getUTCMonth() + 1
  // }.${now.getUTCDate()}-${now.getUTCHours() * 60 + now.getUTCMinutes()}`;
  process.env.VITE_APP_VERSION = version;
}

/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config = {
  buildDependenciesFromSource: true,
  nodeGypRebuild: false,
  npmRebuild: false,
  directories: {
    output: 'dist',
    buildResources: 'resources',
  },
  files: [
    'packages/**/dist/**',
    'packages/renderer/assets/**',
    'packages/main/assets/output/**',
    // '.yalc/@nibus/core/**',
    // '.yalc/@nibus/detection/**',
    // '.yalc/@nibus/mibs/**',
    // '.yalc/@nibus/service/**',
    // '.yalc/@novastar/codec/**',
    // '.yalc/@novastar/native/**',
    // '.yalc/@novastar/net/**',
    '.yalc/@novastar/screen/**',
    // '.yalc/@novastar/serial/**',
    // '.yalc/@sarakusha/lzma/**',
    // 'node_modules/@nibus/core/**',
    // 'node_modules/@nibus/detection/**',
    // 'node_modules/@nibus/mibs/**',
    // 'node_modules/@nibus/service/**',
    // 'node_modules/@novastar/codec/**',
    // 'node_modules/@novastar/native/**',
    // 'node_modules/@novastar/net/**',
    'node_modules/@novastar/screen/**',
    // 'node_modules/@novastar/serial/**',
    // 'node_modules/@sarakusha/lzma/**',
    // @nibus/core still uses conf@10, which expects dot-prop@6 CommonJS exports.
    {
      from: 'node_modules/.pnpm/dot-prop@6.0.1/node_modules/dot-prop',
      to: 'node_modules/@nibus/core/node_modules/dot-prop',
      filter: ['**/*'],
    },
    // 'node_modules/@babel/runtime/**',
    '!node_modules/{@colors,@commitlint}/**/*',
    // '!node_modules/@novastar/{codec,native,net,screen}/build/module/**',
    '!node_modules/@nibus/{cli,core,detection,mibs}/build/module/**',
    // '!node_modules/typescript',
    '!node_modules/rxjs/src',
    '!node_modules/rxjs/dist/{bundles,esm,esm5}',
    '!**/*.map',
    '!node_modules/sqlite3/deps',
    '!node_modules/ajv/lib',
    '!node_modules/object.assign/test.html',

    // '!node_modules/**/*',
    // 'node_modules/ajv/**/*.map',
    // ...(process.env.PLAYER !== '1'
    //   ? ['!(packages/{player,playerPreload}/**)']
    //   : ['packages/renderer/assets/**']),
  ],
  extraMetadata: {
    version: process.env.VITE_APP_VERSION,
  },
  afterPack: './scripts/verify-sqlite3-arch.js',
  // npmRebuild: true,
  appId: 'ru.nata-info.gmib',
  copyright: 'Copyright © Nata-Info, 2022',
  productName: 'gmib',
  publish: 'github',
  mac: {
    // executableName: 'gmiby',
    category: 'public.app-category.utilities',
    target: ['dmg', 'zip'],
    // extraResources: [
    //   {
    //     from: 'ffmpeg/darwin-${arch}/ffmpeg',
    //     to: 'ffmpeg',
    //   },
    //   {
    //     from: 'ffmpeg/darwin-${arch}/ffprobe',
    //     to: 'ffprobe',
    //   },
    // ],
  },
  linux: {
    category: 'Utility',
    target: 'AppImage',
    desktop: {
      entry: {
        Type: 'Application',
        Name: '${productName}',
        Version: '${version}',
        Terminal: 'false',
      },
    },
    // extraResources: [
    //   {
    //     from: 'ffmpeg/linux-${arch}/ffmpeg',
    //     to: 'ffmpeg',
    //   },
    //   {
    //     from: 'ffmpeg/linux-${arch}/ffprobe',
    //     to: 'ffprobe',
    //   },
    // ],
  },
  win: {
    target: 'nsis',
    // extraResources: [
    //   {
    //     from: 'ffmpeg/win32-${arch}/ffmpeg.exe',
    //     to: 'ffmpeg.exe',
    //   },
    //   {
    //     from: 'ffmpeg/win32-${arch}/ffprobe.exe',
    //     to: 'ffprobe.exe',
    //   },
    // ],
  },
  nsis: {
    artifactName: '${productName}-setup-${version}.${ext}',
  },
  appImage: {
    artifactName: '${productName}-${arch}.${ext}',
  },
};

module.exports = config;
