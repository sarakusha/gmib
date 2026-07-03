export type FeatureName =
  | 'gmibScheduler'
  | 'playerEngine'
  | 'playerObjectFit'
  | 'playerScheduler'
  | 'playerSeek'
  | 'playerShaders'
  | 'remotePlayerOutputClose'
  | 'windowZIndex';

const minimumVersions: Record<FeatureName, string> = {
  gmibScheduler: '5.0.1',
  playerEngine: '4.11.0',
  playerObjectFit: '4.11.1',
  playerScheduler: '5.0.0',
  playerSeek: '4.12.0',
  playerShaders: '5.0.0',
  remotePlayerOutputClose: '5.1.1',
  windowZIndex: '5.0.1',
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
