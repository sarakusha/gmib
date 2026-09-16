import crypto from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LicensePayloadV2, SignedLicense } from '/@common/license';
import { hashCode } from '/@common/helpers';

const mocks = vi.hoisted(() => ({
  authRequest: vi.fn(),
  getRemoteCredentials: vi.fn(),
  publicKeys: new Map(),
}));

vi.mock('../src/authRequest', () => ({ default: mocks.authRequest }));
vi.mock('../src/legacyLicense', () => ({ decodeLegacyLicense: vi.fn() }));
vi.mock('../src/secret', () => ({ getRemoteCredentials: mocks.getRemoteCredentials }));
vi.mock('../src/licenseVerification', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/licenseVerification')>();
  return { ...actual, parsePublicKeys: () => mocks.publicKeys };
});

import getAnnounce from '../src/getAnnounce';
import {
  createLicenseSessionAssertion,
  verifyLicenseSessionAssertion,
} from '../src/licenseSessionAssertion';

const prefix = Buffer.from('GMIB-LICENSE-V2\n');
const deviceId = 'a'.repeat(64);
const secret = Buffer.alloc(32, 7);
let document: SignedLicense;

const sign = (payload: LicensePayloadV2, privateKey: crypto.KeyObject): SignedLicense => {
  const bytes = Buffer.from(JSON.stringify(payload));
  return {
    payload: bytes.toString('base64url'),
    signature: crypto.sign(null, Buffer.concat([prefix, bytes]), privateKey).toString('base64url'),
  };
};

describe('authenticated remote license session', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T00:00:01.000Z'));
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    mocks.publicKeys = new Map([['test', publicKey]]);
    const root = `.gmib-${hashCode(deviceId).toString(16)}`;
    const css = `${root} .opaque.feature { display: inherit; margin: inherit; overflow: inherit; position: inherit; color: inherit; background: inherit; }\n${root} .opaque.feature.block { display: block }\n${root} .opaque.feature.flex { display: flex }`;
    document = sign(
      {
        version: 2,
        issuer: 'app.nata-info.ru',
        audience: 'gmib',
        keyId: 'test',
        licenseId: '7e4b72c0-5d55-4a79-98e4-d432afdc2021',
        deviceId,
        issuedAt: '2026-09-15T00:00:00.000Z',
        expiresAt: '2026-09-16T00:00:00.000Z',
        status: 'active',
        plan: 'plus',
        capabilities: ['novastar', 'plugins', 'taurus'],
        presentation: { version: 1, css },
      },
      privateKey,
    );
    mocks.getRemoteCredentials.mockReset().mockResolvedValue({ apiSecret: secret });
    mocks.authRequest.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it('keeps the host session presentation after expiry with a real signature and fresh proof', async () => {
    mocks.authRequest.mockImplementation(({ headers }: { headers: Record<string, string> }) => {
      const challenge = headers['x-ni-license-session-challenge'];
      return Promise.resolve(
        new Response(
          JSON.stringify({
            key: deviceId,
            licenseProtocol: 2,
            license: document,
            licenseSession: createLicenseSessionAssertion(document, challenge, secret),
          }),
        ),
      );
    });

    const result = await getAnnounce('remote', 9002);
    expect(result?.licenseState).toMatchObject({ status: 'active', plan: 'plus' });
    expect(result?.message).toContain(`.gmib-${hashCode(deviceId).toString(16)}`);
    expect(result?.useProxy).toBe(true);
  });

  it('does not restore the presentation after the expired host has restarted', async () => {
    mocks.authRequest.mockResolvedValue(
      new Response(JSON.stringify({ key: deviceId, licenseProtocol: 2, license: document })),
    );

    const result = await getAnnounce('remote', 9002);
    expect(result?.licenseState).toMatchObject({ status: 'expired', capabilities: [] });
    expect(result).not.toHaveProperty('message');
    expect(result).not.toHaveProperty('plan');
  });

  it('rejects a replayed session proof for another challenge', async () => {
    const stale = createLicenseSessionAssertion(
      document,
      Buffer.alloc(32, 1).toString('base64url'),
      secret,
    );
    mocks.authRequest.mockResolvedValue(
      new Response(
        JSON.stringify({
          key: deviceId,
          licenseProtocol: 2,
          license: document,
          licenseSession: stale,
        }),
      ),
    );

    const result = await getAnnounce('remote', 9002);
    expect(result?.licenseState).toMatchObject({ status: 'expired', capabilities: [] });
    expect(result).not.toHaveProperty('message');
  });

  it('does not let a slow controller reactivate a restarted host', async () => {
    vi.setSystemTime(new Date('2026-09-15T23:59:59.000Z'));
    mocks.authRequest.mockResolvedValue(
      new Response(JSON.stringify({ key: deviceId, licenseProtocol: 2, license: document })),
    );

    const result = await getAnnounce('remote', 9002);
    expect(result?.licenseState).toMatchObject({ status: 'invalid', capabilities: [] });
    expect(result).not.toHaveProperty('message');
  });

  it('binds the session proof to the exact signed document', () => {
    const challenge = Buffer.alloc(32, 2).toString('base64url');
    const assertion = createLicenseSessionAssertion(document, challenge, secret);
    expect(verifyLicenseSessionAssertion(assertion, document, challenge, secret)).toBe(true);
    expect(
      verifyLicenseSessionAssertion(
        assertion,
        { ...document, signature: `tampered-${document.signature}` },
        challenge,
        secret,
      ),
    ).toBe(false);
  });
});
