import crypto from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { decodeLegacyLicense } from '../src/legacyLicense';

describe('legacy license decoding', () => {
  it('recovers the stored activation key without trusting presentation fields', () => {
    const deviceId = 'a'.repeat(64);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(deviceId, 'hex'), iv);
    const payload = { key: 'ABCD-EFGH-IJKL', plan: 'standard', message: 'legacy css' };
    const announce = [
      cipher.update(JSON.stringify(payload), 'utf8', 'base64'),
      cipher.final('base64'),
    ].join('');

    expect(decodeLegacyLicense({ announce, iv: iv.toString('base64') }, deviceId)).toEqual(payload);
  });

  it('rejects malformed storage', () => {
    expect(decodeLegacyLicense({ announce: 'bad', iv: 'bad' }, 'a'.repeat(64))).toBeUndefined();
  });
});
