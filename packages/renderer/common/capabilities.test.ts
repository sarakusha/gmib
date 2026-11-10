import { describe, expect, it } from 'vitest';

import { supportsFeature } from '/@common/capabilities';

describe('safe image import compatibility', () => {
  it.each([
    ['5.7.3', false],
    ['5.7.4', true],
    ['5.8.0', true],
    [undefined, true],
  ])('uses the remote version %s', (version, supported) => {
    expect(supportsFeature('safeImageImport', version, true)).toBe(supported);
  });

  it('keeps local protection enabled regardless of the connection version', () => {
    expect(supportsFeature('safeImageImport', '5.7.3', false)).toBe(true);
  });
});

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

describe('wall-clock playback duration compatibility', () => {
  it.each([
    ['5.6.5', false],
    ['5.6.6', true],
    ['5.6.6-test.20261010.1', true],
    ['5.7.0', true],
    [undefined, true],
  ])('uses the remote version %s', (version, supported) => {
    expect(supportsFeature('playbackWallClockDuration', version, true)).toBe(supported);
  });

  it('keeps the local feature available under the existing policy', () => {
    expect(supportsFeature('playbackWallClockDuration', '5.6.5', false)).toBe(true);
  });
});

describe('playback statistics period presets compatibility', () => {
  it.each([
    ['5.6.5', false],
    ['5.6.6', true],
    ['5.7.0', true],
    [undefined, true],
  ])('uses the remote version %s', (version, supported) => {
    expect(supportsFeature('playbackStatisticsPeriodPreset', version, true)).toBe(supported);
  });

  it('keeps local presets available under the existing policy', () => {
    expect(supportsFeature('playbackStatisticsPeriodPreset', '5.6.5', false)).toBe(true);
  });
});

describe('plugin player control compatibility', () => {
  it.each([
    ['5.7.0', false],
    ['5.7.1', true],
    ['5.8.0', true],
    [undefined, true],
  ])('uses the remote version %s', (version, supported) => {
    expect(supportsFeature('pluginPlayerControl', version, true)).toBe(supported);
  });

  it('keeps local plugin player control available under the existing policy', () => {
    expect(supportsFeature('pluginPlayerControl', '5.7.0', false)).toBe(true);
  });
});

describe('remote plugins compatibility', () => {
  it.each([
    ['5.7.0', false],
    ['5.7.1', true],
    ['5.8.0', true],
    [undefined, true],
  ])('uses the remote version %s', (version, supported) => {
    expect(supportsFeature('remotePlugins', version, true)).toBe(supported);
  });

  it('keeps local plugins available under the existing policy', () => {
    expect(supportsFeature('remotePlugins', '5.7.0', false)).toBe(true);
  });
});

describe('finite playlist scheduler compatibility', () => {
  it.each([
    ['5.7.3', false],
    ['5.7.4', true],
    ['5.8.0', true],
    [undefined, true],
  ])('uses remote host %s', (version, expected) => {
    expect(supportsFeature('playerPlaylistRepeat', version as string | undefined, true)).toBe(
      expected,
    );
  });
  it('keeps local operations available', () => {
    expect(supportsFeature('playerPlaylistRepeat', '5.7.3', false)).toBe(true);
  });
});

describe('remote player output state compatibility', () => {
  it.each([
    ['5.7.5', false],
    ['5.7.6', true],
    ['5.8.0', true],
    [undefined, true],
  ])('uses remote host %s', (version, supported) => {
    expect(supportsFeature('remotePlayerOutputState', version, true)).toBe(supported);
  });

  it('keeps local output state available', () => {
    expect(supportsFeature('remotePlayerOutputState', '5.7.5', false)).toBe(true);
  });
});

describe('player scheduler expiry compatibility', () => {
  it.each([
    ['5.7.6', false],
    ['5.7.7', true],
    ['5.8.0', true],
    [undefined, true],
  ])('uses remote host %s', (version, supported) => {
    expect(supportsFeature('playerSchedulerExpiry', version, true)).toBe(supported);
  });
  it('keeps local expiry available', () => {
    expect(supportsFeature('playerSchedulerExpiry', '5.7.6', false)).toBe(true);
  });
});
