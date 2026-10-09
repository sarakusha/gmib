import { describe, expect, it } from 'vitest';

import { supportsFeature } from '/@common/capabilities';

describe('SQLite playback statistics compatibility', () => {
  it.each([
    ['5.6.3', false],
    ['5.6.4', false],
    ['5.6.5', true],
    ['5.7.0', true],
    [undefined, true],
  ])('uses the remote version %s', (version, supported) => {
    expect(supportsFeature('playbackStatistics', version, true)).toBe(supported);
  });

  it('keeps local statistics available under the existing policy', () => {
    expect(supportsFeature('playbackStatistics', '5.6.4', false)).toBe(true);
  });

  it('preserves the original playback path support threshold', () => {
    expect(supportsFeature('playbackLogPath', '5.6.0', true)).toBe(false);
    expect(supportsFeature('playbackLogPath', '5.6.1', true)).toBe(true);
  });
});
