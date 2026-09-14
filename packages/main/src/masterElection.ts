import semver from 'semver';

export type MasterElectionRole = 'candidate' | 'master';

export type MasterElectionPeer = {
  readonly role: MasterElectionRole;
  readonly rank: number;
  readonly identifier: string;
  readonly version?: string;
};

type ElectionTxt = Record<string, string | undefined>;

const parseRank = (value: string | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : -Infinity;
};

export const parseMasterElectionPeer = (txt: ElectionTxt): MasterElectionPeer => {
  const role: MasterElectionRole = txt.role === 'candidate' ? 'candidate' : 'master';
  const version = semver.valid(txt.version) ?? undefined;
  return {
    role,
    rank: parseRank(role === 'candidate' ? txt.candidateRank : (txt.rank ?? txt.rang)),
    identifier: txt.identifier ?? '',
    ...(version ? { version } : {}),
  };
};

const compareVersions = (left?: string, right?: string): number => {
  if (left && right) return semver.compare(left, right);
  if (left) return 1;
  if (right) return -1;
  return 0;
};

export const compareMasterElectionPeers = (
  left: MasterElectionPeer,
  right: MasterElectionPeer,
): number =>
  compareVersions(left.version, right.version) ||
  left.rank - right.rank ||
  left.identifier.localeCompare(right.identifier);

export const getLegacyCompatibleMasterRank = (version: string, rank: number): number => {
  const parsed = semver.parse(version);
  if (!parsed) return rank;
  const versionRank = parsed.major * 1_000_000 + parsed.minor * 1_000 + parsed.patch;
  const releaseRank = parsed.prerelease.length === 0 ? 0.5 : 0;
  return versionRank + releaseRank + rank / 2;
};

export const shouldYieldMasterRole = (
  local: MasterElectionPeer,
  remote: MasterElectionPeer,
): boolean => {
  const versionOrder = compareVersions(remote.version, local.version);
  if (versionOrder !== 0) return versionOrder > 0;
  if (local.role !== remote.role) return remote.role === 'master';
  return compareMasterElectionPeers(remote, local) > 0;
};
