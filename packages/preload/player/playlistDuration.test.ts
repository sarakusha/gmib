import { describe, expect, it } from 'vitest';
import type { MediaInfo } from '/@common/mediaInfo';
import type { Playlist } from '/@common/playlist';
import {
  calculatePlaylistDuration,
  formatPlaylistDuration,
  getPlaylistTimingSignature,
} from '/@common/playlistTiming';
const media = { a: { duration: 1.123 } as MediaInfo, b: { duration: 2.234 } as MediaInfo };
const playlist: Playlist = {
  id: 1,
  name: 'test',
  flags: 0,
  items: [
    { id: '1', md5: 'a' },
    { id: '2', md5: 'b' },
  ],
};

describe('playlist duration calculation', () => {
  it('adds only decoder fade-out on transitions including the last item', () => {
    expect(calculatePlaylistDuration(playlist, media, {})).toEqual({
      mediaMs: 3357,
      fadeMs: 1000,
      totalMs: 4357,
      unknownItems: 0,
    });
    expect(calculatePlaylistDuration(playlist, media, { disableFadeIn: true }).totalMs).toBe(4357);
    expect(calculatePlaylistDuration(playlist, media, { disableFadeOut: true }).totalMs).toBe(3357);
    expect(calculatePlaylistDuration(playlist, media, { playbackEngine: 'capture' }).totalMs).toBe(
      3357,
    );
  });
  it('counts every occurrence but omits fades for identical adjacent media and single items', () => {
    const repeated = { ...playlist, items: [...playlist.items, { id: '3', md5: 'b' }] };
    expect(calculatePlaylistDuration(repeated, media, {}).fadeMs).toBe(1000);
    expect(calculatePlaylistDuration(repeated, media, {}).mediaMs).toBe(5591);
    expect(
      calculatePlaylistDuration({ ...playlist, items: [playlist.items[0]] }, media, {}).fadeMs,
    ).toBe(0);
    expect(calculatePlaylistDuration({ ...playlist, items: [] }, media, {}).totalMs).toBe(0);
  });
  it('reports unavailable or invalid durations without fabricating a complete total', () => {
    for (const duration of [NaN, Infinity, -1, 0]) {
      expect(
        calculatePlaylistDuration(playlist, { a: { duration } as MediaInfo }, {}).unknownItems,
      ).toBe(2);
    }
    expect(calculatePlaylistDuration(playlist, { a: media.a }, {}).unknownItems).toBe(1);
  });
  it('uses whole-file duration like playback, ignoring unused legacy trimming fields', () => {
    const trimmed = {
      ...playlist,
      items: playlist.items.map(item => ({ ...item, start: 0.5, duration: 0.1 })),
    };
    expect(calculatePlaylistDuration(trimmed, media, {}).totalMs).toBe(4357);
  });
  it('rounds the aggregate to tenths with carry and never wraps hours', () => {
    expect(formatPlaylistDuration(5025600)).toBe('1:23:45.6');
    expect(formatPlaylistDuration(59950)).toBe('0:01:00.0');
    expect(formatPlaylistDuration(3599950)).toBe('1:00:00.0');
    expect(formatPlaylistDuration(90000000)).toBe('25:00:00.0');
    expect(formatPlaylistDuration(0)).toBe('0:00:00.0');
  });
  it('keys statistics by ordered contents and settings but not name/current item', () => {
    const signature = getPlaylistTimingSignature(playlist, {});
    expect(getPlaylistTimingSignature({ ...playlist, name: 'renamed' }, {})).toBe(signature);
    expect(
      getPlaylistTimingSignature({ ...playlist, items: [...playlist.items].reverse() }, {}),
    ).not.toBe(signature);
    expect(getPlaylistTimingSignature(playlist, { disableFadeOut: true })).not.toBe(signature);
    expect(getPlaylistTimingSignature(playlist, { playbackEngine: 'capture' })).not.toBe(signature);
  });
});
