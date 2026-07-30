import { describe, expect, it } from 'vitest';

import { parsePluginManifest } from '../src/pluginManifest';

describe('parsePluginManifest', () => {
  it('accepts a compatible content plugin', () => {
    expect(
      parsePluginManifest({
        id: 'parking-counter',
        name: 'Parking counter',
        version: '1.0.0',
        gmibApi: '^1.0.0',
        public: 'public',
        permissions: ['output.pages'],
        pages: [{ id: 'screen', title: 'Parking', path: 'screen.html' }],
      }),
    ).toMatchObject({ id: 'parking-counter', public: 'public' });
  });

  it.each(['../outside.cjs', '/tmp/outside.cjs', 'C:\\outside.cjs'])(
    'rejects unsafe entry path %s',
    main => {
      expect(() =>
        parsePluginManifest({
          id: 'unsafe',
          name: 'Unsafe',
          version: '1.0.0',
          gmibApi: '1.x',
          main,
        }),
      ).toThrow(/путь/);
    },
  );

  it('rejects an incompatible API range', () => {
    expect(() =>
      parsePluginManifest({
        id: 'future',
        name: 'Future',
        version: '1.0.0',
        gmibApi: '^2.0.0',
      }),
    ).toThrow(/Plugin API/);
  });
});
