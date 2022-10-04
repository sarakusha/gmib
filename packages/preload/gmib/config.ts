import type { LocalConfig } from '/@common/helpers';
import localConfig from '/@main/localConfig';

export const get = <Key extends keyof LocalConfig>(key: Key): LocalConfig[Key] =>
  localConfig.get(key);
export const set = <Key extends keyof LocalConfig>(key: Key, value: LocalConfig[Key]): void =>
  localConfig.set(key, value);

// set('hosts', true);
