export type MasterElectionRole = 'candidate' | 'master';

export type MasterElectionPeer = {
  readonly role: MasterElectionRole;
  readonly rank: number;
  readonly identifier: string;
};

type ElectionTxt = Record<string, string | undefined>;

const parseRank = (value: string | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : -Infinity;
};

export const parseMasterElectionPeer = (txt: ElectionTxt): MasterElectionPeer => {
  const role: MasterElectionRole = txt.role === 'candidate' ? 'candidate' : 'master';
  return {
    role,
    rank: parseRank(role === 'candidate' ? txt.candidateRank : (txt.rank ?? txt.rang)),
    identifier: txt.identifier ?? '',
  };
};

export const compareMasterElectionPeers = (
  left: MasterElectionPeer,
  right: MasterElectionPeer,
): number => left.rank - right.rank || left.identifier.localeCompare(right.identifier);

export const shouldYieldMasterRole = (
  local: MasterElectionPeer,
  remote: MasterElectionPeer,
): boolean => {
  if (local.role !== remote.role) return remote.role === 'master';
  return compareMasterElectionPeers(remote, local) > 0;
};
