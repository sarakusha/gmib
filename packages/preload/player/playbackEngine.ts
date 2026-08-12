import type { Player } from '/@common/video';

export const getLinuxDecoderConfig = (
  config: VideoDecoderConfig,
  platform: NodeJS.Platform,
  preferSoftwareDecoding: boolean,
): VideoDecoderConfig =>
  platform === 'linux' && preferSoftwareDecoding
    ? { ...config, hardwareAcceleration: 'prefer-software' }
    : config;

export const resolvePlaybackEngine = (
  configured: Player['playbackEngine'],
): NonNullable<Player['playbackEngine']> => {
  const engine = configured ?? 'decoder';
  return engine;
};

export const shouldFallbackAfterDecoderError = (
  platform: NodeJS.Platform = process.platform,
): boolean => platform === 'linux';
