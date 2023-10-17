/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config = {
  extends: ['./.electron-builder-light.config.js'],
  // directories: {
  //   output: 'dist',
  //   buildResources: 'resources',
  // },
  // productName: 'gmib',
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
};

module.exports = config;
