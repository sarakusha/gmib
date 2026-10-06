import type { PlaylistItem } from '/@common/playlist';
import { describe, expect, it } from 'vitest';
import PlaybackRecovery from './playbackRecovery';

const item = (id: string, md5 = id) => ({ id, md5 }) as PlaylistItem;

describe('PlaybackRecovery', () => {
  it('quarantines unknown media for five minutes after three distinct failed attempts', () => {
    let time = 1_000;
    const recovery = new PlaybackRecovery(3, () => time);
    const bad = item('bad');
    const good = item('good');

    for (let number = 1; number <= 3; number += 1) {
      const attempt = recovery.begin(bad);
      expect(attempt.attempt).toBe(number);
      expect(recovery.fail(attempt)).toBe(true);
      expect(recovery.fail(attempt)).toBe(false);
      expect(recovery.blocked('bad')).toBe(number === 3);
    }
    expect(recovery.select([bad, good], 'bad')).toBe(good);
    expect(recovery.nextRetryAt()).toBe(time + 300_000);
    time += 300_000;
    expect(recovery.blocked('bad')).toBe(false);
    expect(recovery.releaseExpired()).toEqual(['bad']);
    expect(recovery.releaseExpired()).toEqual([]);
    expect(recovery.select([bad, good], 'bad')).toBe(bad);

    // Selection remains stable while the single probe is playing.
    const probe = recovery.begin(bad);
    expect(probe.attempt).toBe(4);
    expect(recovery.select([bad, good], 'bad')).toBe(bad);
    expect(recovery.fail(probe)).toBe(true);
    expect(recovery.blocked('bad')).toBe(true);
    expect(recovery.nextRetryAt()).toBe(time + 600_000);
  });

  it('uses six failures and a shorter bounded cooldown after the first rendered frame', () => {
    let time = 0;
    const recovery = new PlaybackRecovery(3, () => time);
    const playable = item('playable');

    for (let number = 1; number <= 2; number += 1) {
      expect(recovery.fail(recovery.begin(playable))).toBe(true);
    }
    recovery.markPlayable('playable');
    expect(recovery.hasPlayed('playable')).toBe(true);
    // Rendering a frame does not clear the two earlier failures.
    for (let number = 3; number <= 6; number += 1) {
      const attempt = recovery.begin(playable);
      expect(attempt.attempt).toBe(number);
      expect(recovery.fail(attempt)).toBe(true);
      expect(recovery.blocked('playable')).toBe(number === 6);
    }
    expect(recovery.nextRetryAt()).toBe(30_000);

    for (const delay of [30_000, 60_000, 120_000, 240_000, 300_000]) {
      time += delay;
      expect(recovery.releaseExpired()).toEqual(['playable']);
      expect(recovery.fail(recovery.begin(playable))).toBe(true);
      expect(recovery.nextRetryAt()).toBe(time + Math.min(delay * 2, 300_000));
    }
  });

  it('resets failure and backoff after completion while retaining playable history', () => {
    let time = 0;
    const recovery = new PlaybackRecovery(3, () => time);
    const playable = item('playable');
    recovery.markPlayable('playable');
    for (let number = 0; number < 6; number += 1) recovery.fail(recovery.begin(playable));
    expect(recovery.blocked('playable')).toBe(true);
    recovery.succeeded('playable');
    expect(recovery.hasPlayed('playable')).toBe(true);
    expect(recovery.blocked('playable')).toBe(false);
    expect(recovery.begin(playable).attempt).toBe(1);
    for (let number = 0; number < 6; number += 1) recovery.fail(recovery.begin(playable));
    expect(recovery.nextRetryAt()).toBe(30_000);
    time = 30_000;
    recovery.releaseExpired();
    recovery.fail(recovery.begin(playable));
    expect(recovery.nextRetryAt()).toBe(90_000);
    recovery.reset('playable');
    expect(recovery.hasPlayed('playable')).toBe(true);
    expect(recovery.begin(playable).attempt).toBe(1);
    expect(recovery.blocked('playable')).toBe(false);
    expect(recovery.nextRetryAt()).toBeUndefined();
  });

  it('retries after every item was quarantined and ignores stale attempts after reset', () => {
    let time = 0;
    const recovery = new PlaybackRecovery(3, () => time);
    const first = item('first', 'same');
    const duplicate = item('duplicate', 'same');
    const other = item('other');
    const stale = recovery.begin(first);
    for (let number = 0; number < 3; number += 1) {
      recovery.fail(recovery.begin(first));
      recovery.fail(recovery.begin(other));
    }
    expect(recovery.select([first, duplicate, other])).toBeUndefined();
    expect(recovery.nextRetryAt()).toBe(300_000);
    time = 300_000;
    expect(recovery.releaseExpired()).toEqual(['same', 'other']);
    expect(recovery.select([first, duplicate, other])).toBe(first);
    recovery.reset('same');
    expect(recovery.fail(stale)).toBe(false);
    expect(recovery.begin(duplicate).attempt).toBe(1);
  });
});
