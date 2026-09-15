import crypto, { type KeyObject } from 'node:crypto';

import {
  type LicensePayloadV2,
  type LicensePlan,
  licensePlans,
  licenseStatuses,
  type SignedLicense,
} from '/@common/license';

const PREFIX = Buffer.from('GMIB-LICENSE-V2\n', 'utf8');
const MAX_PAYLOAD_BYTES = 16 * 1024;
const MAX_PAYLOAD_CHARACTERS = Math.ceil((MAX_PAYLOAD_BYTES * 4) / 3) + 4;
const BASE64_URL = /^[A-Za-z0-9_-]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVICE_ID = /^[0-9a-f]{64}$/i;
const exactKeys = [
  'audience',
  'capabilities',
  'deviceId',
  'expiresAt',
  'issuedAt',
  'issuer',
  'keyId',
  'licenseId',
  'plan',
  'status',
  'version',
].sort();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

const includes = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && values.includes(value as T);

const parsePayload = (value: unknown): LicensePayloadV2 => {
  if (!isRecord(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(exactKeys))
    throw new Error('Invalid license payload');
  const {
    version,
    issuer,
    audience,
    keyId,
    licenseId,
    deviceId,
    issuedAt,
    expiresAt,
    status,
    plan,
    capabilities,
  } = value;
  if (
    version !== 2 ||
    issuer !== 'app.nata-info.ru' ||
    audience !== 'gmib' ||
    typeof keyId !== 'string' ||
    keyId.length < 1 ||
    keyId.length > 100 ||
    typeof licenseId !== 'string' ||
    !UUID.test(licenseId) ||
    typeof deviceId !== 'string' ||
    !DEVICE_ID.test(deviceId) ||
    !isIsoDate(issuedAt) ||
    (expiresAt !== null && !isIsoDate(expiresAt)) ||
    !includes(licenseStatuses, status) ||
    !includes(licensePlans, plan) ||
    !Array.isArray(capabilities) ||
    capabilities.length > 100 ||
    !capabilities.every(item => typeof item === 'string' && item.length > 0 && item.length <= 100)
  )
    throw new Error('Invalid license payload');
  return value as LicensePayloadV2;
};

const parseDocument = (value: unknown): SignedLicense => {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 2 ||
    typeof value.payload !== 'string' ||
    typeof value.signature !== 'string' ||
    value.payload.length > MAX_PAYLOAD_CHARACTERS ||
    value.signature.length > 512 ||
    !BASE64_URL.test(value.payload) ||
    !BASE64_URL.test(value.signature)
  )
    throw new Error('Invalid license document');
  return value as SignedLicense;
};

export const parsePublicKeys = (encoded: string | undefined): Map<string, KeyObject> => {
  if (!encoded) throw new Error('License verification keys are not configured');
  const values: unknown = JSON.parse(encoded);
  if (!isRecord(values)) throw new Error('Invalid license verification keys');
  return new Map(
    Object.entries(values).map(([keyId, value]) => {
      if (!keyId || typeof value !== 'string') throw new Error('Invalid license verification key');
      return [
        keyId,
        crypto.createPublicKey({ key: Buffer.from(value, 'base64'), format: 'der', type: 'spki' }),
      ];
    }),
  );
};

export const verifyLicense = (
  document: unknown,
  deviceId: string,
  publicKeys: ReadonlyMap<string, KeyObject>,
): LicensePayloadV2 => {
  const signed = parseDocument(document);
  const payloadBytes = Buffer.from(signed.payload, 'base64url');
  if (payloadBytes.length > MAX_PAYLOAD_BYTES) throw new Error('License payload is too large');
  const payload = parsePayload(JSON.parse(payloadBytes.toString('utf8')));
  if (payload.deviceId !== deviceId) throw new Error('License belongs to another device');
  const key = publicKeys.get(payload.keyId);
  if (!key) throw new Error('Unknown license signing key');
  const signature = Buffer.from(signed.signature, 'base64url');
  if (signature.length !== 64) throw new Error('Invalid license signature');
  if (!crypto.verify(null, Buffer.concat([PREFIX, payloadBytes]), key, signature))
    throw new Error('Invalid license signature');
  return payload;
};

const PLUS_PLANS: ReadonlySet<LicensePlan> = new Set(['plus', 'premium', 'enterprise']);

export const allowsCapability = (payload: LicensePayloadV2, capability: string): boolean => {
  if (payload.status !== 'active' || !payload.capabilities.includes(capability)) return false;
  if (capability === 'plugins') return PLUS_PLANS.has(payload.plan);
  if (capability === 'taurus')
    return PLUS_PLANS.has(payload.plan) && payload.capabilities.includes('novastar');
  return true;
};
