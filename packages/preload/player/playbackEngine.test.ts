import { describe, expect, it } from 'vitest';

import {
  getLinuxDecoderConfig,
  resolvePlaybackEngine,
  shouldFallbackAfterDecoderError,
} from './playbackEngine';

describe('player playback engine', () => {
  it('prefers software WebCodecs decoding on Linux when toggle is enabled', () => {
    expect(getLinuxDecoderConfig({ codec: 'avc1.64001f' }, 'linux', true)).toEqual({
      codec: 'avc1.64001f',
      hardwareAcceleration: 'prefer-software',
    });
  });

  it('preserves the decoder configuration when toggle is disabled', () => {
    const config = { codec: 'avc1.64001f' };
    expect(getLinuxDecoderConfig(config, 'linux', false)).toBe(config);
  });

  it('preserves the decoder configuration on other systems', () => {
    const config = { codec: 'avc1.64001f' };
    expect(getLinuxDecoderConfig(config, 'win32', true)).toBe(config);
  });

  it('uses configured playback engine with decoder default', () => {
    expect(resolvePlaybackEngine('decoder')).toBe('decoder');
    expect(resolvePlaybackEngine('capture')).toBe('capture');
    expect(resolvePlaybackEngine(undefined)).toBe('decoder');
  });

  it('uses immediate decoder fallback only on Linux', () => {
    expect(shouldFallbackAfterDecoderError('linux')).toBe(true);
    expect(shouldFallbackAfterDecoderError('darwin')).toBe(false);
    expect(shouldFallbackAfterDecoderError('win32')).toBe(false);
  });
});
