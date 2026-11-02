const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Exercise the installed NiBUS matcher without starting USB discovery or opening ports.
const service = fs.readFileSync(require.resolve('@nibus/service'), 'utf8');
const matcher = service.match(/const matchCategory = \(port\) => \{[\s\S]*?\n\};/);
assert.ok(matcher, 'NiBUS matcher changed: update this integration harness');
const cases = [
  [
    'macOS USB descriptor with NUL padding',
    { device: 'Ke-USB24R\0\0', manufacturer: 'K' },
    'relay',
  ],
  ['Windows serial without USB product', { serialNumber: 'K_Ke-USB24R' }, 'relay'],
  ['Windows serial suffix', { serialNumber: 'K_Ke-USB24R_001' }, 'relay'],
  ['both identifiers', { device: 'Ke-USB24R', serialNumber: 'K_Ke-USB24R' }, 'relay'],
  ['unidentified Microchip device', {}, undefined],
  ['different product', { device: 'Other', serialNumber: 'Other' }, undefined],
  ['wrong vendor', { device: 'Ke-USB24R', serialNumber: 'K_Ke-USB24R', vendorId: 1 }, undefined],
  [
    'wrong product ID',
    { device: 'Ke-USB24R', serialNumber: 'K_Ke-USB24R', productId: 1 },
    undefined,
  ],
];

for (const format of ['cjs', 'mjs']) {
  test(`patched NiBUS ${format}: platform detection and negative cases`, async () => {
    const filename = path.join(
      path.dirname(require.resolve('@nibus/detection')),
      `index.${format}`,
    );
    const { loadDetection } = await import(require('node:url').pathToFileURL(filename));
    const detection = loadDetection();
    const context = {
      detection,
      // Only logging, lookup and category decoding are stubbed; the matcher is production code.
      debug$2() {},
      lodash_find_js: { default: (items, predicate) => items.find(predicate) },
      core: { CategoryV: { decode: value => value } },
      safeGet: value => value,
    };
    // The CommonJS build refers to the imported CategoryV through its generated namespace.
    const categoryRef = matcher[0].match(/([\w$]+)\.CategoryV\.decode/);
    if (categoryRef) context[categoryRef[1]] = context.core;
    const match = vm.runInNewContext(`${matcher[0]}\nmatchCategory`, context);
    for (const [name, fields, expected] of cases) {
      assert.equal(match({ vendorId: 1240, productId: 10, ...fields }), expected, name);
    }
    assert.equal(match({ vendorId: 1027, productId: 24577 }), 'ftdi');
  });
}
