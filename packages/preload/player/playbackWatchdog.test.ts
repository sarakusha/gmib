import { describe, expect, it } from 'vitest';

import PlaybackWatchdog from './playbackWatchdog';

describe('PlaybackWatchdog', () => {
  it('reports a stall when an active player stops advancing', () => {
    const watchdog = new PlaybackWatchdog(30_000);

    expect(watchdog.observe(true, 10, 1_000)).toBe(false);
    expect(watchdog.observe(true, 10, 30_999)).toBe(false);
    expect(watchdog.observe(true, 10, 31_000)).toBe(true);
  });

  it('extends the deadline whenever playback advances', () => {
    const watchdog = new PlaybackWatchdog(30_000);

    expect(watchdog.observe(true, 10, 1_000)).toBe(false);
    expect(watchdog.observe(true, 11, 25_000)).toBe(false);
    expect(watchdog.observe(true, 11, 54_999)).toBe(false);
    expect(watchdog.observe(true, 11, 55_000)).toBe(true);
  });

  it('does not treat a deliberate pause as a stall', () => {
    const watchdog = new PlaybackWatchdog(30_000);

    expect(watchdog.observe(true, 10, 1_000)).toBe(false);
    expect(watchdog.observe(false, 10, 40_000)).toBe(false);
    expect(watchdog.observe(true, 10, 100_000)).toBe(false);
    expect(watchdog.observe(true, 10, 129_999)).toBe(false);
  });

  it('defers another recovery after a reported error', () => {
    const watchdog = new PlaybackWatchdog(30_000);

    expect(watchdog.observe(true, 10, 1_000)).toBe(false);
    watchdog.defer(20_000);
    expect(watchdog.observe(true, 10, 49_999)).toBe(false);
    expect(watchdog.observe(true, 10, 50_000)).toBe(true);
  });
});
