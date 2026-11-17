import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MediaInfo } from '/@common/mediaInfo';
import type { Playlist } from '/@common/playlist';
import { getPlaylistTimingSignature } from '/@common/playlistTiming';
import type { PlaylistTimingStatistics } from '/@common/playlistTimingStatistics';
import PlaylistDuration, { getPlaylistDurationDisplay } from './PlaylistDuration';

const playlist: Playlist = {
  id: 1,
  name: 'Программа',
  flags: 0,
  items: [
    { id: 'a', md5: 'a' },
    { id: 'b', md5: 'b' },
  ],
};
const media = {
  a: { md5: 'a', duration: 60 } as MediaInfo,
  b: { md5: 'b', duration: 30 } as MediaInfo,
};
const player = { disableFadeOut: true };
const stats = (sampleCount = 3, medianElapsedMs = 92_300): PlaylistTimingStatistics => ({
  playerId: 1,
  samples: [
    {
      playlistId: 1,
      signature: getPlaylistTimingSignature(playlist, player),
      medianElapsedMs,
      sampleCount,
    },
  ],
});

describe('playlist duration display', () => {
  it('shows nominal duration without inventing a correction', () => {
    const value = getPlaylistDurationDisplay(playlist, media, player);
    expect(value.duration).toBe('0:01:30.0');
    expect(value.correction).toBeUndefined();
    const html = renderToStaticMarkup(<PlaylistDuration value={value} />);
    expect(html).toContain('0:01:30.0');
    expect(html).toContain('Длительность плейлиста:');
  });

  it('shows a correction only after three matching complete observations', () => {
    expect(
      getPlaylistDurationDisplay(playlist, media, player, stats(2)).correction,
    ).toBeUndefined();
    const value = getPlaylistDurationDisplay(playlist, media, player, stats());
    expect(value.correction).toBe('+2.3 с');
    expect(renderToStaticMarkup(<PlaylistDuration value={value} />)).toContain('+2.3 с');
  });

  it('shows fading separately from the sum of clip durations', () => {
    expect(getPlaylistDurationDisplay(playlist, media, {})).toEqual({
      duration: '0:01:30.0',
      correction: '+1.0 с',
    });
  });

  it('replaces estimated fading with the full observed correction without counting it twice', () => {
    const observations = stats();
    observations.samples[0].signature = getPlaylistTimingSignature(playlist, {});
    expect(getPlaylistDurationDisplay(playlist, media, {}, observations)).toEqual({
      duration: '0:01:30.0',
      correction: '+2.3 с',
    });
    observations.samples[0].sampleCount = 2;
    expect(getPlaylistDurationDisplay(playlist, media, {}, observations).correction).toBe('+1.0 с');
  });

  it('does not reuse observations after changing order or settings', () => {
    expect(
      getPlaylistDurationDisplay(
        { ...playlist, items: [...playlist.items].reverse() },
        media,
        player,
        stats(),
      ).correction,
    ).toBeUndefined();
    expect(
      getPlaylistDurationDisplay(playlist, media, { disableFadeOut: false }, stats()).correction,
    ).toBe('+1.0 с');
    expect(
      getPlaylistDurationDisplay({ ...playlist, id: 2 }, media, player, stats()).correction,
    ).toBeUndefined();
  });

  it('supports negative corrections and rounds before choosing the sign', () => {
    expect(getPlaylistDurationDisplay(playlist, media, player, stats(3, 89_300)).correction).toBe(
      '−0.7 с',
    );
    for (const elapsedMs of [89_951, 89_999, 90_000, 90_001, 90_049]) {
      expect(
        getPlaylistDurationDisplay(playlist, media, player, stats(3, elapsedMs)).correction,
      ).toBeUndefined();
    }
  });

  it('marks incomplete metadata instead of reporting a precise total', () => {
    const value = getPlaylistDurationDisplay(playlist, { a: media.a }, player, stats());
    expect(value.duration).toBe('≥ 0:01:00.0');
    expect(value.correction).toBeUndefined();
    expect(getPlaylistDurationDisplay(playlist, {}, player).duration).toBe('—');
  });
});
