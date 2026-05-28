const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

function normalizeArch(arch) {
  const archByValue = {
    0: 'ia32',
    1: 'x64',
    2: 'armv7l',
    3: 'arm64',
    4: 'universal',
  };

  return archByValue[arch] ?? arch;
}

exports.default = async function verifySqlite3Arch(context) {
  const arch = normalizeArch(context.arch);
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

  const binaryPath = path.join(unpackedSqlite3Path, 'build', 'Release', 'node_sqlite3.node');
  await fs.access(binaryPath);

  if (context.electronPlatformName === 'darwin' || context.electronPlatformName === 'mas') {
    const { stdout } = await execFileAsync('lipo', ['-archs', binaryPath]);
    const archs = stdout.trim().split(/\s+/);
    const expectedArch = arch === 'x64' ? 'x86_64' : arch;

    if (!archs.includes(expectedArch)) {
      throw new Error(
        `sqlite3 binary has incompatible architecture: expected ${expectedArch}, got ${archs.join(', ')}`,
      );
    }

    return;
  }

  if (context.electronPlatformName !== 'linux') {
    return;
  }

  const { stdout } = await execFileAsync('file', [binaryPath]);
  const expectedText = arch === 'arm64' ? 'aarch64' : 'x86-64';

  if (!stdout.toLowerCase().includes(expectedText)) {
    throw new Error(
      `sqlite3 binary has incompatible architecture: expected ${expectedText}, got ${stdout.trim()}`,
    );
  }
};
