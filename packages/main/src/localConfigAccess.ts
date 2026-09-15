import type { LocalConfig } from '/@common/helpers';

const rendererConfigKeys = new Set<keyof LocalConfig>([
  'health',
  'hosts',
  'linuxPreferSoftwareDecoding',
]);

export const isRendererConfigKey = (value: unknown): value is keyof LocalConfig =>
  typeof value === 'string' && rendererConfigKeys.has(value as keyof LocalConfig);
