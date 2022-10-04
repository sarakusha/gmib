import crypto from 'crypto';

const isEmpty = (obj: unknown) =>
  typeof obj === 'object' &&
  obj &&
  Object.keys(obj).length === 0 &&
  Object.getPrototypeOf(obj) === Object.prototype;

export default function generateSignature(
  apiSecret: Buffer,
  method: string,
  uri: string,
  timestamp: number,
  body?: unknown,
) {
  const url = new URL(uri, 'http://localhost');
  const path = url.pathname + url.search;

  const hmac = crypto.createHmac('SHA256', apiSecret);

  hmac.update(`${method.toUpperCase()}${path}${timestamp}`);

  if (body && !isEmpty(body)) {
    hmac.update(Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
  }

  return hmac.digest('hex');
}
