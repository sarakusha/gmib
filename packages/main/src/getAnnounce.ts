import crypto from 'node:crypto';

import authRequest from './authRequest';

const getAnnounce = async (host?: string, port?: number) => {
  const res = await authRequest({ host, port, api: 'announce' });
  if (!res?.ok) return undefined;
  const { announce, iv, key, ...data } = await res.json();
  if (!announce || !iv || !key) return data;
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(key, 'hex'),
      Buffer.from(iv, 'base64'),
    );
    const jsn = [decipher.update(announce, 'base64', 'utf-8'), decipher.final('utf-8')].join('');
    return { ...JSON.parse(jsn), machineId: key, ...data };
  } catch (err) {
    console.error(`error while decode: ${(err as Error).message}`);
    return announce;
  }
};

export default getAnnounce;
