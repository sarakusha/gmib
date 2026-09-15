import type { TaurusPlayerInfo } from '@novastar/taurus';

type DiscoverTaurus = (dest?: string) => Promise<TaurusPlayerInfo[]>;

export const discoverLicensedTaurus = (
  allowed: boolean,
  dest: string | undefined,
  discover: DiscoverTaurus,
): Promise<TaurusPlayerInfo[]> => (allowed ? discover(dest) : Promise.resolve([]));
