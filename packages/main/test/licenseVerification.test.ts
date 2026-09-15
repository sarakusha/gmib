import crypto from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { LicensePayloadV2, SignedLicense } from '/@common/license';
import { allowsCapability, verifyLicense } from '../src/licenseVerification';

const prefix = Buffer.from('GMIB-LICENSE-V2\n');
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');

const payload = (changes: Partial<LicensePayloadV2> = {}): LicensePayloadV2 => ({
  version: 2,
  issuer: 'app.nata-info.ru',
  audience: 'gmib',
  keyId: 'test',
  licenseId: '7e4b72c0-5d55-4a79-98e4-d432afdc2021',
  deviceId: 'a'.repeat(64),
  issuedAt: '2026-09-15T10:00:00.000Z',
  expiresAt: '2026-10-15T10:00:00.000Z',
  status: 'active',
  plan: 'plus',
  capabilities: ['novastar', 'plugins', 'taurus'],
  ...changes,
});

const sign = (value: LicensePayloadV2): SignedLicense => {
  const bytes = Buffer.from(JSON.stringify(value));
  return {
    payload: bytes.toString('base64url'),
    signature: crypto.sign(null, Buffer.concat([prefix, bytes]), privateKey).toString('base64url'),
  };
};

describe('license verification', () => {
  it('verifies exact signed bytes for the current device', () => {
    expect(verifyLicense(sign(payload()), 'a'.repeat(64), new Map([['test', publicKey]]))).toEqual(
      payload(),
    );
  });

  it('rejects payload changes and another device', () => {
    const document = sign(payload());
    const changed = JSON.parse(Buffer.from(document.payload, 'base64url').toString()) as Record<
      string,
      unknown
    >;
    changed.plan = 'enterprise';
    expect(() =>
      verifyLicense(
        { ...document, payload: Buffer.from(JSON.stringify(changed)).toString('base64url') },
        'a'.repeat(64),
        new Map([['test', publicKey]]),
      ),
    ).toThrow('Invalid license signature');
    expect(() => verifyLicense(document, 'b'.repeat(64), new Map([['test', publicKey]]))).toThrow(
      'another device',
    );
  });

  it('requires both Plus and explicit capabilities', () => {
    for (const plan of ['plus', 'premium', 'enterprise'] as const) {
      expect(allowsCapability(payload({ plan }), 'plugins')).toBe(true);
      expect(allowsCapability(payload({ plan }), 'taurus')).toBe(true);
    }
    for (const plan of ['basic', 'standard'] as const) {
      expect(allowsCapability(payload({ plan }), 'plugins')).toBe(false);
      expect(allowsCapability(payload({ plan }), 'taurus')).toBe(false);
    }
    expect(allowsCapability(payload({ capabilities: ['plugins', 'taurus'] }), 'taurus')).toBe(
      false,
    );
    expect(allowsCapability(payload({ status: 'expired' }), 'plugins')).toBe(false);
  });

  it('rejects oversized documents before verification', () => {
    expect(() =>
      verifyLicense(
        { payload: 'A'.repeat(30_000), signature: 'A'.repeat(86) },
        'a'.repeat(64),
        new Map([['test', publicKey]]),
      ),
    ).toThrow('Invalid license document');
  });
});
