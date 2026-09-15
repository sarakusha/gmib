import crypto from 'node:crypto';

type LegacyLicenseStorage = {
  announce?: unknown;
  iv?: unknown;
};

export const decodeLegacyLicense = (
  storage: LegacyLicenseStorage,
  deviceId: string,
): Record<string, unknown> | undefined => {
  const { announce, iv } = storage;
  if (typeof announce !== 'string' || typeof iv !== 'string') return undefined;
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(deviceId, 'hex'),
      Buffer.from(iv, 'base64'),
    );
    const json = [decipher.update(announce, 'base64', 'utf8'), decipher.final('utf8')].join('');
    const value: unknown = JSON.parse(json);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};
