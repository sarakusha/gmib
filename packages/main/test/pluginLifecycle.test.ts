import { describe, expect, it, vi } from 'vitest';

import type { PluginArchiveInspection, PluginCatalogEntry, PluginStatus } from '/@common/plugins';

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '/tmp') } }));
vi.mock('../src/pluginCatalog', () => ({
  downloadOfficialPluginArchive: vi.fn(),
  listOfficialPlugins: vi.fn(async () => []),
}));
vi.mock('../src/pluginHost', () => ({
  inspectPluginArchive: vi.fn(),
  installPluginFromArchive: vi.fn(),
  isPluginRunning: vi.fn(() => false),
  listPlugins: vi.fn(async () => []),
  setPluginEnabled: vi.fn(),
  uninstallPlugin: vi.fn(),
}));

import { createPluginLifecycleService } from '../src/pluginLifecycle';

const sha256 = 'a'.repeat(64);
const manifest = {
  id: 'sample',
  name: 'Sample',
  version: '1.0.0',
  gmibApi: '^1.0.0',
  main: 'main.cjs',
  permissions: ['storage' as const],
};
const status = (enabled = true): PluginStatus => ({
  manifest,
  enabled,
  loaded: false,
  runningEnabled: false,
  restartRequired: true,
  archiveSha256: sha256,
});
const inspection = (installed?: PluginStatus): PluginArchiveInspection => ({
  manifest,
  sha256,
  size: 100,
  ...(installed ? { installed } : {}),
});
const entry: PluginCatalogEntry = {
  manifest,
  publisher: { id: 'sarakusha', name: 'gmib', verified: true },
  repository: 'https://github.com/sarakusha/gmib-plugins',
  release: { url: 'https://example.invalid/sample', sha256, size: 100 },
};

const harness = (overrides: Record<string, unknown> = {}) => {
  const dependencies = {
    catalog: vi.fn(async () => [entry]),
    downloadOfficial: vi.fn(async () => Buffer.from('archive')),
    inspectArchive: vi.fn(async () => inspection()),
    installArchive: vi.fn(async () => ({ plugin: status(), updated: false })),
    isRunning: vi.fn(() => false),
    list: vi.fn(async () => [] as PluginStatus[]),
    setEnabled: vi.fn(async (_id: string, enabled: boolean) => status(enabled)),
    temporaryDirectory: vi.fn(async () => '/tmp/unused'),
    uninstall: vi.fn(async () => true),
    ...overrides,
  };
  return { dependencies, service: createPluginLifecycleService(dependencies) };
};

describe('plugin lifecycle service', () => {
  it('requires the exact permission and trusted-backend consent', async () => {
    const { dependencies, service } = harness();
    await expect(
      service.installArchive(
        '/tmp/plugin',
        sha256,
        { permissions: [], trustedBackend: true },
        true,
      ),
    ).rejects.toMatchObject({ code: 'permissions_not_accepted', status: 409 });
    await expect(
      service.installArchive(
        '/tmp/plugin',
        sha256,
        { permissions: ['storage'], trustedBackend: false },
        true,
      ),
    ).rejects.toMatchObject({ code: 'trusted_backend_not_accepted', status: 409 });
    expect(dependencies.installArchive).not.toHaveBeenCalled();
  });

  it('returns a no-op for the same archive, version, and enabled state', async () => {
    const installed = status(true);
    const { dependencies, service } = harness({
      inspectArchive: vi.fn(async () => inspection(installed)),
    });
    await expect(
      service.installArchive(
        '/tmp/plugin',
        sha256,
        { permissions: ['storage'], trustedBackend: true },
        true,
      ),
    ).resolves.toMatchObject({ changed: false, plugin: installed });
    expect(dependencies.installArchive).not.toHaveBeenCalled();
  });

  it('rejects an official version or hash absent from the current catalog', async () => {
    const { dependencies, service } = harness();
    await expect(
      service.inspectOfficial({ id: 'sample', version: '0.9.0', sha256 }),
    ).rejects.toMatchObject({ code: 'official_release_unavailable', status: 409 });
    expect(dependencies.downloadOfficial).not.toHaveBeenCalled();
  });

  it('treats uninstall of an absent plugin as a no-op', async () => {
    const { dependencies, service } = harness();
    await expect(service.uninstall('absent')).resolves.toEqual({
      changed: false,
      restartRequired: false,
    });
    expect(dependencies.uninstall).not.toHaveBeenCalled();
  });

  it('keeps restartRequired truthful when an already removed plugin is still running', async () => {
    const { dependencies, service } = harness({ isRunning: vi.fn(() => true) });
    await expect(service.uninstall('sample')).resolves.toEqual({
      changed: false,
      restartRequired: true,
    });
    expect(dependencies.uninstall).not.toHaveBeenCalled();
  });
});
