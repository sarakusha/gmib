import { describe, expect, it } from 'vitest';

import {
  compareMasterElectionPeers,
  parseMasterElectionPeer,
  shouldYieldMasterRole,
} from '../src/masterElection';

describe('master election', () => {
  it('treats a legacy service as an existing master', () => {
    expect(parseMasterElectionPeer({ rank: '0.1', identifier: 'legacy' })).toEqual({
      role: 'master',
      rank: 0.1,
      identifier: 'legacy',
    });
  });

  it('uses candidateRank while exposing a legacy-safe rank', () => {
    expect(
      parseMasterElectionPeer({
        role: 'candidate',
        rank: '-1',
        candidateRank: '0.75',
        identifier: 'candidate',
      }),
    ).toEqual({ role: 'candidate', rank: 0.75, identifier: 'candidate' });
  });

  it('always keeps an existing master over a new candidate', () => {
    const master = { role: 'master', rank: 0.1, identifier: 'old' } as const;
    const candidate = { role: 'candidate', rank: 0.9, identifier: 'new' } as const;

    expect(shouldYieldMasterRole(candidate, master)).toBe(true);
    expect(shouldYieldMasterRole(master, candidate)).toBe(false);
  });

  it('uses rank for candidates started at the same time', () => {
    const weaker = { role: 'candidate', rank: 0.1, identifier: 'a' } as const;
    const stronger = { role: 'candidate', rank: 0.9, identifier: 'b' } as const;

    expect(shouldYieldMasterRole(weaker, stronger)).toBe(true);
    expect(shouldYieldMasterRole(stronger, weaker)).toBe(false);
  });

  it('uses rank to converge after two masters meet', () => {
    const weaker = { role: 'master', rank: 0.1, identifier: 'a' } as const;
    const stronger = { role: 'master', rank: 0.9, identifier: 'b' } as const;

    expect(shouldYieldMasterRole(weaker, stronger)).toBe(true);
    expect(shouldYieldMasterRole(stronger, weaker)).toBe(false);
  });

  it('uses identifier as a deterministic rank tie-breaker', () => {
    const left = { role: 'candidate', rank: 0.5, identifier: 'a' } as const;
    const right = { role: 'candidate', rank: 0.5, identifier: 'b' } as const;

    expect(compareMasterElectionPeers(right, left)).toBeGreaterThan(0);
  });
});
