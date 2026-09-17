import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  showMessageBox: vi.fn(),
  showOpenDialog: vi.fn(),
  catalog: vi.fn(),
  inspectArchive: vi.fn(),
  inspectOfficial: vi.fn(),
  installArchive: vi.fn(),
  installOfficial: vi.fn(),
  list: vi.fn(),
  uninstall: vi.fn(),
}));

vi.mock('electron', () => ({
  dialog: { showMessageBox: mocks.showMessageBox, showOpenDialog: mocks.showOpenDialog },
}));
vi.mock('../src/pluginLifecycle', () => ({
  pluginLifecycle: {
    catalog: mocks.catalog,
    inspectArchive: mocks.inspectArchive,
    inspectOfficial: mocks.inspectOfficial,
    installArchive: mocks.installArchive,
    installOfficial: mocks.installOfficial,
    list: mocks.list,
    uninstall: mocks.uninstall,
  },
}));

import { installPluginFromDialog } from '../src/pluginLifecycleUi';

describe('plugin lifecycle UI wrapper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps file selection and consent in the UI before calling the shared service', async () => {
    const manifest = {
      id: 'sample',
      name: 'Sample',
      version: '1.0.0',
      gmibApi: '^1.0.0',
      main: 'main.cjs',
      permissions: ['storage' as const],
    };
    const inspection = { manifest, sha256: 'a'.repeat(64), size: 10 };
    const plugin = {
      manifest,
      enabled: true,
      loaded: false,
      runningEnabled: false,
      restartRequired: true,
      archiveSha256: inspection.sha256,
    };
    mocks.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/sample.zip'] });
    mocks.inspectArchive.mockResolvedValue(inspection);
    mocks.showMessageBox.mockResolvedValue({ response: 0 });
    mocks.installArchive.mockResolvedValue({
      changed: true,
      updated: false,
      plugin,
      restartRequired: true,
    });

    await expect(installPluginFromDialog()).resolves.toMatchObject({
      status: 'installed',
      changed: true,
    });
    expect(mocks.installArchive).toHaveBeenCalledWith(
      '/tmp/sample.zip',
      inspection.sha256,
      { permissions: ['storage'], trustedBackend: true },
      true,
    );
  });
});
