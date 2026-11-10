export type FeatureName =
  | 'gmibScheduler'
  | 'playerEngine'
  | 'playerConfiguration'
  | 'playerObjectFit'
  | 'playerScheduler'
  | 'playerSchedulerExpiry'
  | 'playerPlaylistRepeat'
  | 'playerSeek'
  | 'playerShaders'
  | 'playbackStatistics'
  | 'playbackStatisticsPeriodPreset'
  | 'playbackWallClockDuration'
  | 'playbackDiagnostics'
  | 'playbackLogPath'
  | 'remotePlayerOutputState'
  | 'remotePlayerOutputVisibility'
  | 'remotePlayerOutputClose'
  | 'schedulerSecondsAndPriority'
  | 'windowZIndex'
  | 'pluginPlayerControl'
  | 'remotePlugins'
  | 'safeImageImport'
  | 'mediaFileDownload';

const minimumVersions: Record<FeatureName, string> = {
  gmibScheduler: '5.0.1',
  playerEngine: '4.11.0',
  playerConfiguration: '5.6.10',
  playerObjectFit: '4.11.1',
  playerScheduler: '5.0.0',
  playerSchedulerExpiry: '5.7.7',
  playerPlaylistRepeat: '5.7.4',
  playerSeek: '4.12.0',
  playerShaders: '5.0.0',
  playbackStatistics: '5.6.5',
  playbackStatisticsPeriodPreset: '5.6.6',
  playbackWallClockDuration: '5.6.6',
  playbackDiagnostics: '5.6.0',
  playbackLogPath: '5.6.1',
  remotePlayerOutputState: '5.7.6',
  remotePlayerOutputVisibility: '5.4.1',
  remotePlayerOutputClose: '5.1.1',
  schedulerSecondsAndPriority: '5.3.0',
  windowZIndex: '5.0.1',
  pluginPlayerControl: '5.7.1',
  remotePlugins: '5.7.1',
  safeImageImport: '5.7.4',
  // Existing /public media route, verified in the first extracted GMIB release.
  mediaFileDownload: '3.6.5',
};

const parseVersion = (version?: string): number[] | undefined => {
  const match = version?.match(/\d+(?:\.\d+)*/);
  return match?.[0].split('.').map(Number);
};

export const compareVersions = (left?: string, right?: string): number | undefined => {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  if (!leftParts || !rightParts) return undefined;

  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart !== rightPart) return leftPart > rightPart ? 1 : -1;
  }
  return 0;
};

export const supportsFeature = (
  feature: FeatureName,
  version: string | undefined,
  isRemoteSession: boolean,
): boolean => {
  if (!isRemoteSession || !version) return true;
  const comparison = compareVersions(version, minimumVersions[feature]);
  return comparison === undefined || comparison >= 0;
};
