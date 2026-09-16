const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { verifyProductionArtifacts } = require('./verify-production-artifacts.cjs');

const fixture = contents => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gmib-artifact-test-'));
  for (const [filename, value] of Object.entries(contents)) {
    const target = path.join(directory, filename);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
  }
  return directory;
};

test('accepts runtime strings that merely mention sourceMappingURL', t => {
  const directory = fixture({
    'bundle.js': 'const css = `/*# sourceMappingURL=data:application/json;base64,generated */`;',
  });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  assert.doesNotThrow(() => verifyProductionArtifacts([directory], directory));
});

test('rejects active source-map directives and external maps', t => {
  const directory = fixture({
    'bundle.js': 'const value = 1;\n//# sourceMappingURL=bundle.js.map',
    'bundle.js.map': '{"version":3,"sourcesContent":["secret source"]}',
  });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  assert.throws(
    () => verifyProductionArtifacts([directory], directory),
    error =>
      error instanceof Error &&
      error.message.includes('active sourceMappingURL directive') &&
      error.message.includes('external source map'),
  );
});

test('rejects project source and test files in a package', t => {
  const directory = fixture({ 'packages/main/src/secret.ts': 'export const secret = true;' });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  assert.throws(
    () => verifyProductionArtifacts([directory], directory),
    /project source, test, or service file/,
  );
});

test('allows runtime assets stored in an assets/tests directory', t => {
  const directory = fixture({
    'packages/renderer/assets/tests/output-pattern.html': '<p>Runtime diagnostic pattern</p>',
  });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  assert.doesNotThrow(() => verifyProductionArtifacts([directory], directory));
});

test('ignores source maps owned by packaged dependencies', t => {
  const directory = fixture({
    'node_modules/vendor/index.js': 'const value = 1;\n//# sourceMappingURL=index.js.map',
    'node_modules/vendor/index.js.map': '{"version":3}',
    '.yalc/vendor/index.js': 'const value = 1;\n//# sourceMappingURL=index.js.map',
    '.yalc/vendor/index.js.map': '{"version":3}',
  });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  assert.doesNotThrow(() => verifyProductionArtifacts([directory], directory));
});
