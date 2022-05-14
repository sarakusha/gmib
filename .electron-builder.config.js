if (process.env.VITE_APP_VERSION === undefined) {
  // const now = new Date();
  // process.env.VITE_APP_VERSION = `${now.getUTCFullYear() - 2000}.${
  //   now.getUTCMonth() + 1
  // }.${now.getUTCDate()}-${now.getUTCHours() * 60 + now.getUTCMinutes()}`;
  process.env.VITE_APP_VERSION = process.env['npm_package_version'];
}

/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config = {
  directories: {
    output: 'dist',
    buildResources: 'resources',
  },
  files: ['packages/**/dist/**'],
  extraMetadata: {
    version: process.env.VITE_APP_VERSION,
  },
  npmRebuild: true,
  appId: 'ru.nata-info.gmib',
  copyright: 'Copyright © Nata-Info, 2022',
  productName: 'gmib',
  publish: 'github',
  mac: {
    category: 'public.app-category.utilities',
    target: ['dmg', 'zip'],
    extraResources: [
      {
        from: 'ffmpeg/darwin-${arch}/ffmpeg',
        to: 'ffmpeg',
      },
      {
        from: 'ffmpeg/darwin-${arch}/ffprobe',
        to: 'ffprobe',
      },
    ],
  },
  linux: {
    category: 'Utility',
    target: 'AppImage',
    desktop: {
      Name: '${productName}',
      Terminal: 'false',
    },
    extraResources: [
      {
        from: 'ffmpeg/linux-${arch}/ffmpeg',
        to: 'ffmpeg',
      },
      {
        from: 'ffmpeg/linux-${arch}/ffprobe',
        to: 'ffprobe',
      },
    ],
  },
  win: {
    target: 'nsis',
    extraResources: [
      {
        from: 'ffmpeg/win32-${arch}/ffmpeg.exe',
        to: 'ffmpeg.exe',
      },
      {
        from: 'ffmpeg/win32-${arch}/ffprobe.exe',
        to: 'ffprobe.exe',
      },
    ],
  },
  nsis: {
    artifactName: '${productName}-setup-${version}.${ext}',
  },
  appImage: {
    artifactName: '${productName}.${ext}',
  },
};

module.exports = config;
