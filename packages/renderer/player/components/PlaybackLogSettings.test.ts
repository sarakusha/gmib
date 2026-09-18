import { describe, expect, it } from 'vitest';

import {
  isValidPlaybackLogRetentionDays,
  shouldSavePlaybackLogRetentionDays,
} from '../playback/playbackSettings';

describe('playback log retention validation', () => {
  it.each([1, 7, 365])('accepts %i days', value => {
    expect(isValidPlaybackLogRetentionDays(value)).toBe(true);
  });

  it.each([0, 1.5, 366, Number.NaN])('rejects %s days', value => {
    expect(isValidPlaybackLogRetentionDays(value)).toBe(false);
  });

  it('saves only a changed valid value after settings load', () => {
    expect(shouldSavePlaybackLogRetentionDays(14, undefined, false)).toBe(false);
    expect(shouldSavePlaybackLogRetentionDays(14, 7, true)).toBe(false);
    expect(shouldSavePlaybackLogRetentionDays(7, 7, false)).toBe(false);
    expect(shouldSavePlaybackLogRetentionDays(14, 7, false)).toBe(true);
  });
});
