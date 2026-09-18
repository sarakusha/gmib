const assert = require('node:assert/strict');
const test = require('node:test');

const {
  guardWindowsUpdateMetadata,
  minimumSystemVersion,
} = require('./guard-windows-update-metadata.cjs');

test('adds the Windows 10 minimum system version once', () => {
  const source = [
    'version: 5.6.0',
    'files:',
    '  - url: gmib-setup-5.6.0.exe',
    'path: gmib-setup-5.6.0.exe',
    '',
  ].join('\n');

  const guarded = guardWindowsUpdateMetadata(source);
  assert.match(guarded, new RegExp(`^minimumSystemVersion: ${minimumSystemVersion}$`, 'm'));
  assert.equal(guardWindowsUpdateMetadata(guarded), guarded);
});

test('rejects an unexpected metadata file', () => {
  assert.throws(() => guardWindowsUpdateMetadata('version: 5.6.0\n'), /unexpected format/);
});
