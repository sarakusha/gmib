const fs = require('node:fs');

const minimumSystemVersion = '10.0.0';

const guardWindowsUpdateMetadata = source => {
  if (!/^version:\s*\S+/m.test(source) || !/^files:\s*$/m.test(source)) {
    throw new Error('Windows update metadata has an unexpected format');
  }
  const withoutExisting = source.replace(/^minimumSystemVersion:.*(?:\r?\n|$)/m, '');
  return withoutExisting.replace(
    /^(version:\s*\S+\s*)$/m,
    `$1\nminimumSystemVersion: ${minimumSystemVersion}`,
  );
};

if (require.main === module) {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: node guard-windows-update-metadata.cjs <latest.yml>');
  const source = fs.readFileSync(path, 'utf8');
  fs.writeFileSync(path, guardWindowsUpdateMetadata(source));
}

module.exports = { guardWindowsUpdateMetadata, minimumSystemVersion };
