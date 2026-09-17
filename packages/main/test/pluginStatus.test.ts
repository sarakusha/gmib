import { describe, expect, it } from 'vitest';

import type { PluginManifest } from '/@common/plugins';

import { buildPluginStatus } from '../src/pluginStatus';

const manifest = (version = '1.0.0'): PluginManifest => ({
  id: 'sample',
  name: 'Sample',
  version,
  gmibApi: '^1.0.0',
});

describe('plugin status', () => {
  it('does not require restart for a disabled and unloaded plugin', () => {
    expect(buildPluginStatus(manifest(), { desiredEnabled: false })).toMatchObject({
      loaded: false,
      runningEnabled: false,
      restartRequired: false,
    });
  });

  it('requires restart when the same version was replaced by another archive', () => {
    expect(
      buildPluginStatus(manifest(), {
        archiveSha256: 'b'.repeat(64),
        desiredEnabled: true,
        runningArchiveSha256: 'a'.repeat(64),
        runningManifest: manifest(),
      }),
    ).toMatchObject({ loaded: false, runningEnabled: true, restartRequired: true });
  });

  it('keeps restart required after uninstall and reinstall while the old runtime remains', () => {
    expect(
      buildPluginStatus(manifest(), {
        archiveSha256: 'a'.repeat(64),
        desiredEnabled: true,
        runningArchiveSha256: 'a'.repeat(64),
        runningManifest: manifest(),
        runtimeDirty: true,
      }),
    ).toMatchObject({ loaded: false, runningEnabled: true, restartRequired: true });
  });
});
