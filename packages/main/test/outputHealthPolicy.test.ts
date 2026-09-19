import { describe, expect, it } from 'vitest';
import { isPlayerOutputHealth, type PlayerOutputHealth } from '../../common/outputHealth';
import { hasConfirmedOutput, OutputHealthPolicy } from '../src/outputHealthPolicy';

const health = (state: 'showing' | 'starting' | 'stalled' = 'showing'): PlayerOutputHealth => ({
  requestId: 1,
  playbackState: 'playing',
  playable: true,
  outputs: [{ id: 7, state, lastFrameAgeMs: state === 'showing' ? 10 : 31_000 }],
});

describe('independent output supervision', () => {
  it('requires recent presentation from every expected output', () => {
    expect(hasConfirmedOutput(health(), [7])).toBe(true);
    expect(hasConfirmedOutput(health(), [7, 8])).toBe(false);
    expect(hasConfirmedOutput(health(), [])).toBe(false);
    expect(hasConfirmedOutput(health('starting'), [7])).toBe(false);
    expect(hasConfirmedOutput({ ...health(), playbackState: 'paused' }, [7])).toBe(false);
  });
  it('recovers an unresponsive renderer and limits repeated reloads', () => {
    const policy = new OutputHealthPolicy(0);
    expect(policy.check([7], true, 29_999)).toBeUndefined();
    expect(policy.check([7], true, 30_000)).toContain('did not answer');
    expect(policy.check([7], true, 149_999)).toBeUndefined();
    expect(policy.check([7], true, 150_000)).toContain('did not answer');
  });
  it('allows renderer repair but bounds continually restarting output', () => {
    const policy = new OutputHealthPolicy(0);
    for (let now = 5_000; now < 90_000; now += 5_000) {
      policy.report(health('starting'), now);
      expect(policy.check([7], true, now)).toBeUndefined();
    }
    policy.report(health('stalled'), 90_000);
    expect(policy.check([7], true, 90_000)).toContain('did not recover');
  });
  it('leaves healthy playback alone for repeated checks', () => {
    const policy = new OutputHealthPolicy(0);
    for (let now = 5_000; now < 600_000; now += 5_000) {
      policy.report(health(), now);
      expect(policy.check([7], true, now)).toBeUndefined();
    }
  });
  it('does not recover deliberate stop/hide or unavailable monitors', () => {
    const policy = new OutputHealthPolicy(0);
    expect(policy.check([7], false, 600_000)).toBeUndefined();
    expect(policy.check([], true, 900_000)).toBeUndefined();
    expect(policy.check([7], true, 900_001)).toBeUndefined();
  });
  it('preserves quarantine while a responsive player has no playable items', () => {
    const policy = new OutputHealthPolicy(0);
    for (let now = 5_000; now < 600_000; now += 5_000) {
      policy.report({ ...health('starting'), playable: false }, now);
      expect(policy.check([7], true, now)).toBeUndefined();
    }
    expect(policy.check([7], true, 630_000)).toContain('did not answer');
  });
  it('rejects malformed, duplicate and unbounded health payloads', () => {
    expect(isPlayerOutputHealth(health())).toBe(true);
    expect(isPlayerOutputHealth({ ...health(), requestId: NaN })).toBe(false);
    expect(isPlayerOutputHealth({ ...health(), outputs: [null] })).toBe(false);
    expect(
      isPlayerOutputHealth({ ...health(), outputs: [...health().outputs, ...health().outputs] }),
    ).toBe(false);
    expect(
      isPlayerOutputHealth({
        ...health(),
        outputs: [{ id: 7, state: 'showing', lastFrameAgeMs: Infinity }],
      }),
    ).toBe(false);
  });
});
