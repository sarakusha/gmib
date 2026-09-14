import { describe, expect, it } from 'vitest';

import {
  compareMasterElectionPeers,
  getLegacyCompatibleMasterRank,
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

  it('parses a valid advertised version', () => {
    expect(
      parseMasterElectionPeer({
        role: 'master',
        rank: '0.5',
        identifier: 'versioned',
        version: '5.5.0',
      }),
    ).toEqual({ role: 'master', rank: 0.5, identifier: 'versioned', version: '5.5.0' });
  });

  it('lets a newer candidate replace an older master', () => {
    const older = {
      role: 'master',
      rank: 0.9,
      identifier: 'old',
      version: '5.4.1',
    } as const;
    const newer = {
      role: 'candidate',
      rank: 0.1,
      identifier: 'new',
      version: '5.5.0',
    } as const;

    expect(shouldYieldMasterRole(newer, older)).toBe(false);
    expect(shouldYieldMasterRole(older, newer)).toBe(true);
  });

  it('keeps the existing master when versions are equal', () => {
    const master = {
      role: 'master',
      rank: 0.1,
      identifier: 'master',
      version: '5.5.0',
    } as const;
    const candidate = {
      role: 'candidate',
      rank: 0.9,
      identifier: 'candidate',
      version: '5.5.0',
    } as const;

    expect(shouldYieldMasterRole(candidate, master)).toBe(true);
  });

  it('exposes a version-weighted rank to older GMIB versions', () => {
    expect(getLegacyCompatibleMasterRank('5.5.0', 0)).toBeGreaterThan(
      getLegacyCompatibleMasterRank('5.4.1', 1),
    );
  });

  it('keeps an existing master when neither peer advertises a version', () => {
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
