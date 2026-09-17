import type { PluginManifest, PluginStatus } from '/@common/plugins';

export const buildPluginStatus = (
  manifest: PluginManifest,
  options: {
    archiveSha256?: string;
    desiredEnabled: boolean;
    error?: string;
    runtimeDirty?: boolean;
    runningArchiveSha256?: string;
    runningManifest?: PluginManifest;
  },
): PluginStatus => {
  const {
    archiveSha256,
    desiredEnabled,
    error,
    runtimeDirty,
    runningArchiveSha256,
    runningManifest,
  } = options;
  const runningEnabled = Boolean(runningManifest);
  const artifactMatches = !archiveSha256 || runningArchiveSha256 === archiveSha256;
  const loaded = !runtimeDirty && runningManifest?.version === manifest.version && artifactMatches;
  return {
    manifest,
    enabled: desiredEnabled,
    loaded,
    runningEnabled,
    ...(runningManifest ? { runningVersion: runningManifest.version } : {}),
    restartRequired: desiredEnabled ? !loaded : runningEnabled,
    ...(archiveSha256 ? { archiveSha256 } : {}),
    ...(error ? { error } : {}),
  };
};
