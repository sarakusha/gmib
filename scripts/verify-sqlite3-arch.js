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

function compareVersion(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart !== rightPart) return leftPart - rightPart;
  }

  return 0;
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

  const maxGlibcVersionByArch = {
    x64: '2.35',
  };
  const maxGlibcVersion = maxGlibcVersionByArch[arch];

  if (!maxGlibcVersion) {
    return;
  }

  const { stdout: symbols } = await execFileAsync('objdump', ['-T', binaryPath]);
  const requiredVersions = [...symbols.matchAll(/GLIBC_(\d+\.\d+)/g)].map(match => match[1]);
  const newestRequiredVersion = requiredVersions.sort(compareVersion).at(-1);

  if (newestRequiredVersion && compareVersion(newestRequiredVersion, maxGlibcVersion) > 0) {
    throw new Error(
      `sqlite3 binary requires GLIBC_${newestRequiredVersion}, expected GLIBC_${maxGlibcVersion} or older`,
    );
  }
};
