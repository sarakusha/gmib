import { afterEach, describe, expect, it, vi } from 'vitest';

import { watchPlaybackLogDay } from './watchPlaybackLogDay';

let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.useRealTimers();
});

describe('playback log path refresh', () => {
  it('refreshes after consecutive UTC midnights and stops when settings close', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T23:59:59Z'));
    const refresh = vi.fn();
    stop = watchPlaybackLogDay(refresh);
    vi.advanceTimersByTime(1999);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(refresh).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    window.dispatchEvent(new Event('focus'));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('refreshes and reschedules after returning from sleep', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T18:00:00Z'));
    const refresh = vi.fn();
    stop = watchPlaybackLogDay(refresh);
    vi.setSystemTime(new Date('2026-09-20T23:59:59Z'));
    window.dispatchEvent(new Event('focus'));
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
