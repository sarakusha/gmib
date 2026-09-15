import authRequest from './authRequest';
import { decodeLegacyLicense } from './legacyLicense';

type AnnounceResponse = {
  announce?: string;
  iv?: string;
  key?: string;
  machineId?: string;
  [k: string]: unknown;
};

const getAnnounce = async (host?: string, port?: number): Promise<AnnounceResponse | undefined> => {
  const res = await authRequest({ host, port, api: 'announce' });
  if (!res?.ok) return undefined;
  const { announce, iv, key, ...data } = (await res.json()) as AnnounceResponse;
  const result: AnnounceResponse = { machineId: key, ...data };
  if (!announce || !iv || !key) return result;
  const parsed = decodeLegacyLicense({ announce, iv }, key);
  return parsed ? { ...parsed, ...result } : result;
};

export default getAnnounce;
