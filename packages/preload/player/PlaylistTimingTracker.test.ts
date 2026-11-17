import { describe, expect, it } from 'vitest';
import type { PlaybackEvent } from '/@common/playback';
import type { Playlist } from '/@common/playlist';
import { PlaylistTimingTracker } from './PlaylistTimingTracker';

const playlist: Playlist = {
  id: 1,
  name: 'Test',
  flags: 0,
  items: [
    { id: 'a', md5: 'a' },
    { id: 'b', md5: 'b' },
  ],
};
const event = (name: PlaybackEvent['event'], itemId = 'a', playbackId = itemId) => ({
  event: name,
  itemId,
  playbackId,
  mediaId: itemId,
  playlistId: 1,
  engine: 'decoder' as const,
});

describe('clean playlist timing', () => {
  it('includes the gap between clips, excludes loading before the first frame, and starts a fresh cycle', () => {
    let now = 100;
    const tracker = new PlaylistTimingTracker(() => now);
    expect(tracker.observe(event('started'), playlist, {})).toBeUndefined();
    now = 1100;
    tracker.observe(event('completed'), playlist, {});
    now = 1350;
    tracker.observe(event('started', 'b'), playlist, {});
    now = 2350;
    expect(tracker.observe(event('completed', 'b'), playlist, {})).toMatchObject({
      elapsedMs: 2250,
    });
    expect(tracker.observe(event('completed', 'b'), playlist, {})).toBeUndefined();
    tracker.observe(event('started'), playlist, {});
    now += 1000;
    tracker.observe(event('completed'), playlist, {});
    tracker.observe(event('started', 'b'), playlist, {});
    now += 1000;
    expect(tracker.observe(event('completed', 'b'), playlist, {})).toMatchObject({
      elapsedMs: 2000,
    });
  });

  it.each([
    'paused',
    'resumed',
    'seeked',
    'interrupted',
    'error',
    'skipped',
    'quarantined',
  ] as const)('rejects passes containing %s', name => {
    let now = 0;
    const tracker = new PlaylistTimingTracker(() => now);
    tracker.observe(event('started'), playlist, {});
    tracker.observe(event(name), playlist, {});
    now = 1000;
    tracker.observe(event('completed'), playlist, {});
    tracker.observe(event('started', 'b'), playlist, {});
    now = 2000;
    expect(tracker.observe(event('completed', 'b'), playlist, {})).toBeUndefined();
  });

  it('rejects changed composition, order, settings and mismatched attempts', () => {
    for (const change of ['composition', 'order', 'settings', 'attempt', 'engine', 'reset']) {
      let now = 0;
      const tracker = new PlaylistTimingTracker(() => now);
      tracker.observe(event('started'), playlist, {});
      tracker.observe(event('completed'), playlist, {});
      const updated =
        change === 'composition'
          ? { ...playlist, items: [playlist.items[1]] }
          : change === 'order'
            ? { ...playlist, items: [...playlist.items].reverse() }
            : playlist;
      const settings = change === 'settings' ? { disableFadeOut: true } : {};
      if (change === 'reset') tracker.reset();
      tracker.observe(event('started', 'b'), updated, settings);
      now = 2000;
      const end = event('completed', 'b', change === 'attempt' ? 'wrong' : 'b');
      expect(
        tracker.observe(change === 'engine' ? { ...end, engine: 'capture' } : end, playlist, {}),
      ).toBeUndefined();
    }
  });

  it('rejects seeking before the first frame of the first item', () => {
    let now = 0;
    const tracker = new PlaylistTimingTracker(() => now);
    tracker.observe(event('seeked'), playlist, {});
    tracker.observe(event('started'), playlist, {});
    now = 500;
    tracker.observe(event('completed'), playlist, {});
    tracker.observe(event('started', 'b'), playlist, {});
    now = 1500;
    expect(tracker.observe(event('completed', 'b'), playlist, {})).toBeUndefined();
    tracker.observe(event('started', 'a', 'new-a'), playlist, {});
    now += 1000;
    tracker.observe(event('completed', 'a', 'new-a'), playlist, {});
    tracker.observe(event('started', 'b', 'new-b'), playlist, {});
    now += 1000;
    expect(tracker.observe(event('completed', 'b', 'new-b'), playlist, {})).toMatchObject({
      elapsedMs: 2000,
    });
  });

  it('requires the first item and handles single-item playlists', () => {
    let now = 0;
    const tracker = new PlaylistTimingTracker(() => now);
    tracker.observe(event('started', 'b'), playlist, {});
    now = 1000;
    expect(tracker.observe(event('completed', 'b'), playlist, {})).toBeUndefined();
    const single = { ...playlist, items: [playlist.items[0]] };
    tracker.observe(event('started'), single, {});
    now = 1500;
    expect(tracker.observe(event('completed'), single, {})).toMatchObject({ elapsedMs: 500 });
  });
});
