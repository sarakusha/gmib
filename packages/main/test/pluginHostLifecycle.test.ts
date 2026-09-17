import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import AdmZip from 'adm-zip';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ root: '/tmp/gmib-plugin-host-not-initialized' }));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mocks.root),
    on: vi.fn(),
    quit: vi.fn(),
  },
  powerMonitor: { on: vi.fn(), off: vi.fn() },
  shell: { openExternal: vi.fn() },
}));
vi.mock('../src/licenseState', () => ({
  hasLicenseCapability: vi.fn(() => true),
  requireLicenseCapability: vi.fn(),
}));
vi.mock('../src/config', () => ({
  port: 9002,
  testsDeferred: { promise: Promise.resolve() },
}));
vi.mock('../src/db', () => ({ dbReady: Promise.resolve() }));
vi.mock('../src/page', () => ({
  deletePage: vi.fn(),
  getPages: vi.fn(async () => []),
  uniquePageTitle: vi.fn(async (value: unknown) => value),
  upsertPermanentPage: vi.fn(),
}));
vi.mock('../src/screen', () => ({ getScreens: vi.fn(async () => []) }));
vi.mock('../src/screenOutput', () => ({ updateTest: vi.fn() }));
vi.mock('../src/server', () => ({ broadcast: vi.fn() }));
vi.mock('../src/pluginOutput', () => ({ createPluginOutput: vi.fn() }));
vi.mock('../src/pluginNibus', () => ({ createPluginNibus: vi.fn() }));
vi.mock('../src/pluginDatabase', () => ({ openPluginDatabase: vi.fn() }));
vi.mock('../src/pluginRuntime', () => ({
  PluginServiceRegistry: class {
    remove = vi.fn();
  },
  listPluginSports: vi.fn(() => []),
  resolvePluginOrder: vi.fn(() => ({ order: [], errors: new Map() })),
}));

import { installPluginFromArchive, listPlugins, setPluginEnabled } from '../src/pluginHost';

const archive = async (directory: string, version: string, description: string) => {
  const filename = path.join(directory, `sample-${version}.gmib-plugin`);
  const zip = new AdmZip();
  zip.addFile(
    'manifest.json',
    Buffer.from(
      JSON.stringify({
        id: 'sample',
        name: 'Sample',
        version,
        gmibApi: '^1.0.0',
        description,
      }),
    ),
  );
  zip.writeZip(filename);
  const contents = await fs.promises.readFile(filename);
  return { filename, sha256: createHash('sha256').update(contents).digest('hex') };
};

beforeAll(async () => {
  mocks.root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gmib-plugin-host-'));
});

afterAll(async () => {
  await fs.promises.rm(mocks.root, { recursive: true, force: true });
});

describe('plugin host lifecycle persistence', () => {
  it('reads back installed status and restores the old plugin when registry persistence fails', async () => {
    const first = await archive(mocks.root, '1.0.0', 'old');
    await installPluginFromArchive(first.filename, {
      enabled: false,
      expectedSha256: first.sha256,
    });
    await expect(listPlugins()).resolves.toEqual([
      expect.objectContaining({
        enabled: false,
        loaded: false,
        restartRequired: false,
        archiveSha256: first.sha256,
        manifest: expect.objectContaining({ version: '1.0.0', description: 'old' }),
      }),
    ]);

    const second = await archive(mocks.root, '2.0.0', 'new');
    const originalRename = fs.promises.rename.bind(fs.promises);
    const rename = vi.spyOn(fs.promises, 'rename').mockImplementation(async (source, target) => {
      if (String(target).endsWith('.registry.json')) throw new Error('registry failed');
      return originalRename(source, target);
    });
    await expect(
      installPluginFromArchive(second.filename, {
        enabled: true,
        expectedSha256: second.sha256,
      }),
    ).rejects.toThrow('registry failed');
    rename.mockRestore();

    await expect(listPlugins()).resolves.toEqual([
      expect.objectContaining({
        enabled: false,
        archiveSha256: first.sha256,
        manifest: expect.objectContaining({ version: '1.0.0', description: 'old' }),
      }),
    ]);

    const enableRename = vi
      .spyOn(fs.promises, 'rename')
      .mockImplementation(async (source, target) => {
        if (String(target).endsWith('.registry.json')) throw new Error('registry failed');
        return originalRename(source, target);
      });
    await expect(setPluginEnabled('sample', true)).rejects.toThrow('registry failed');
    enableRename.mockRestore();
    await expect(listPlugins()).resolves.toEqual([
      expect.objectContaining({ enabled: false, archiveSha256: first.sha256 }),
    ]);
  });
});
