import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readStatisticsPeriod,
  saveStatisticsPeriod,
  statisticsPeriodKey,
} from './statisticsPeriodPreference';

describe('saved statistics period', () => {
  const key = statisticsPeriodKey('host-a', 9001, 1);
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it.each([
    null,
    '{',
    'null',
    '[]',
    '{"preset":"unknown"}',
    '{"preset":"custom","range":{"from":"2026-01-01","to":"2026-01-02"}}',
  ])('defaults to today for absent or unusable storage: %s', value => {
    if (value !== null) window.localStorage.setItem(key, value);
    expect(readStatisticsPeriod(key)).toEqual({ preset: 'today' });
  });

  it('isolates selections by host, port and player', () => {
    saveStatisticsPeriod(key, { preset: 'week' });
    expect(readStatisticsPeriod(key)).toEqual({ preset: 'week' });
    for (const other of [
      statisticsPeriodKey('host-b', 9001, 1),
      statisticsPeriodKey('host-a', 9002, 1),
      statisticsPeriodKey('host-a', 9001, 2),
    ])
      expect(readStatisticsPeriod(other)).toEqual({ preset: 'today' });
  });

  it('never persists custom dates', () => {
    saveStatisticsPeriod(key, {
      preset: 'custom',
      range: { from: '2026-01-01', to: '2026-01-02' },
    });
    expect(window.localStorage.getItem(key)).toBe('{"preset":"today"}');
  });

  it('tolerates unavailable storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('unavailable');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('unavailable');
    });
    expect(readStatisticsPeriod(key)).toEqual({ preset: 'today' });
    expect(() => saveStatisticsPeriod(key, { preset: 'week' })).not.toThrow();
  });
});
