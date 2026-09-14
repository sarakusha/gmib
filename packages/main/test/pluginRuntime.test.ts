import { describe, expect, it } from 'vitest';
import { PluginServiceRegistry, resolvePluginOrder, listPluginSports } from '../src/pluginRuntime';
import { parsePluginManifest } from '../src/pluginManifest';
const manifest = (id: string, dependencies?: Record<string, string>) =>
  parsePluginManifest({ id, name: id, version: '1.0.0', gmibApi: '^1.1.0', dependencies });

describe('plugin dependencies and services', () => {
  it('loads dependencies first, independently of directory order', () => {
    expect(
      resolvePluginOrder([
        manifest('icehockey', { 'sports-roster': '^1.0.0' }),
        manifest('sports-roster'),
      ]).order.map(item => item.id),
    ).toEqual(['sports-roster', 'icehockey']);
  });
  it('isolates cycles and disabled/missing dependencies from unrelated plugins', () => {
    const result = resolvePluginOrder(
      [
        manifest('a', { b: '*' }),
        manifest('b', { a: '*' }),
        manifest('c'),
        manifest('d', { e: '*' }),
        manifest('e'),
      ],
      ['e'],
    );
    expect(result.order.map(item => item.id)).toEqual(['c']);
    expect([...result.errors.keys()].sort()).toEqual(['a', 'b', 'd']);
  });
  it('rejects an incompatible dependency version', () => {
    expect(resolvePluginOrder([manifest('a', { b: '^2' }), manifest('b')]).errors.has('a')).toBe(
      true,
    );
  });
  it('checks declared service dependencies, version and cleanup', () => {
    const services = new PluginServiceRegistry();
    services.provide('b', 'rosters', '1.0.0', { list: () => [] });
    expect(() => services.require(manifest('a'), 'b', 'rosters', '^1')).toThrow(/зависимость/);
    const consumer = manifest('a', { b: '^1' });
    expect(services.require(consumer, 'b', 'rosters', '^1')).toHaveProperty('list');
    expect(() => services.require(consumer, 'b', 'rosters', '^2')).toThrow(/Недоступен/);
    services.remove('b');
    expect(() => services.require(consumer, 'b', 'rosters', '^1')).toThrow(/Недоступен/);
  });
  it('discovers sports before activation and rejects duplicate providers', () => {
    const sport = {
      id: 'icehockey',
      name: 'Хоккей',
      rosterVersion: 1,
      positions: [{ id: 'goalie', name: 'Вратарь' }],
    };
    const a = { ...manifest('a'), contributes: { sports: [sport] } };
    const b = { ...manifest('b'), contributes: { sports: [sport] } };
    expect(resolvePluginOrder([a, b]).order).toEqual([]);
    expect(
      listPluginSports(
        [a],
        () => true,
        () => false,
        new Map(),
      )[0],
    ).toMatchObject({ installed: true, enabled: true, ready: false });
  });
  it('validates sport identifiers and dependency metadata', () => {
    expect(() =>
      parsePluginManifest({ ...manifest('a'), dependencies: { '../b': '*' } }),
    ).toThrow();
    expect(() =>
      parsePluginManifest({
        ...manifest('a'),
        contributes: {
          sports: [{ id: 'icehockey', name: 'Хоккей', rosterVersion: 0, positions: [] }],
        },
      }),
    ).toThrow();
  });
});

it('supports standalone hockey when optional roster is absent, disabled or incompatible', () => {
  const hockey = { ...manifest('icehockey'), optionalDependencies: { 'sports-roster': '^1' } };
  expect(resolvePluginOrder([hockey]).order).toEqual([hockey]);
  expect(resolvePluginOrder([hockey, manifest('sports-roster')], ['sports-roster']).order).toEqual([
    hockey,
  ]);
  expect(
    resolvePluginOrder([hockey, manifest('sports-roster')]).order.map(item => item.id),
  ).toEqual(['sports-roster', 'icehockey']);
  expect(
    resolvePluginOrder([
      { ...hockey, optionalDependencies: { 'sports-roster': '^2' } },
      manifest('sports-roster'),
    ]).errors.size,
  ).toBe(0);
});
