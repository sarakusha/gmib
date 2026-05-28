const { rebuild } = require('@electron/rebuild');
const path = require('node:path');

exports.default = async function rebuildSqlite3(context) {
  const electronVersion = context.packager.config.electronVersion;

  if (!electronVersion) {
    throw new Error('Missing electronVersion for sqlite3 rebuild');
  }

  const unpackedSqlite3Path =
    context.electronPlatformName === 'darwin' || context.electronPlatformName === 'mas'
      ? path.join(
          context.appOutDir,
          `${context.packager.appInfo.productFilename}.app`,
          'Contents',
          'Resources',
          'app.asar.unpacked',
          'node_modules',
          'sqlite3',
        )
      : path.join(context.appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'sqlite3');

  await rebuild({
    buildPath: unpackedSqlite3Path,
    electronVersion,
    arch: context.arch,
    onlyModules: ['sqlite3'],
    force: true,
  });
};