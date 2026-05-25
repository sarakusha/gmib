import crypto from 'node:crypto';

import authRequest from './authRequest';

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
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(key, 'hex'),
      Buffer.from(iv, 'base64'),
    );
    const jsn = [decipher.update(announce, 'base64', 'utf-8'), decipher.final('utf-8')].join('');
    const parsed = JSON.parse(jsn) as AnnounceResponse;
    return { ...parsed, ...result };
  } catch (err) {
    console.error(`error while decode: ${(err as Error).message}`);
    return result;
  }
};

export default getAnnounce;
