import { describe, expect, it } from 'vitest';

import PlaybackProgress, { type PlaybackProgressSegment } from './playbackProgress';

const milliseconds = (value: string) => Date.parse(value);

describe('PlaybackProgress', () => {
  it('excludes pauses and seeks while preserving actual repeated playback', () => {
    const segments: PlaybackProgressSegment[] = [];
    const progress = new PlaybackProgress(segment => segments.push(segment));
    progress.observe(0, 0);
    progress.observe(2, 2000);
    progress.reset(undefined, 2000);
    progress.observe(2, 12000);
    progress.observe(3, 13000);
    progress.reset(undefined, 13000);
    progress.observe(50, 14000);
    progress.observe(51, 15000);
    progress.flush();
    expect(segments.map(segment => segment.playedMs)).toEqual([2000, 1000, 1000]);
    expect(segments.map(segment => milliseconds(segment.segmentStartedAt))).toEqual([
      0, 12000, 14000,
    ]);
  });

  it('splits a stalled interval and never credits its idle time', () => {
    const segments: PlaybackProgressSegment[] = [];
    const progress = new PlaybackProgress(segment => segments.push(segment));
    progress.observe(0, 0);
    progress.observe(1, 1000);
    progress.observe(2, 20000);
    progress.flush();
    expect(segments.map(segment => segment.playedMs)).toEqual([1000, 1000]);
    expect(milliseconds(segments[1].segmentStartedAt)).toBe(19000);
    expect(milliseconds(segments[0].timestamp)).toBe(1000);
  });

  it('flushes long plays incrementally without double counting a final flush', () => {
    const segments: PlaybackProgressSegment[] = [];
    const progress = new PlaybackProgress(segment => segments.push(segment));
    progress.observe(0, 0);
    for (let second = 1; second <= 31; second += 1) progress.observe(second, second * 1000);
    expect(segments).toHaveLength(2);
    progress.flush();
    progress.flush();
    expect(segments.map(segment => segment.playedMs)).toEqual([15000, 15000, 1000]);
  });
});

describe('frame delivery jitter', () => {
  it('caps the whole active segment without losing time on alternating frame delays', () => {
    const segments: PlaybackProgressSegment[] = [];
    const progress = new PlaybackProgress(segment => segments.push(segment));
    progress.observe(0, 0);
    progress.observe(0.04, 20);
    progress.observe(0.08, 80);
    progress.observe(0.12, 100);
    progress.observe(0.16, 160);
    progress.flush();
    expect(segments[0].playedMs).toBe(160);
  });
});

it('starts a new interval after a backwards wall clock correction', () => {
  const segments: PlaybackProgressSegment[] = [];
  const progress = new PlaybackProgress(segment => segments.push(segment));
  progress.observe(0, 10000);
  progress.observe(1, 11000);
  progress.observe(2, 5000);
  progress.observe(3, 6000);
  progress.flush();
  expect(segments.map(segment => segment.playedMs)).toEqual([1000, 1000]);
  expect(
    segments.every(
      segment => milliseconds(segment.timestamp) >= milliseconds(segment.segmentStartedAt),
    ),
  ).toBe(true);
});
