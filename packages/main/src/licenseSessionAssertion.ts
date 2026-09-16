import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import type { SignedLicense } from '/@common/license';

const PREFIX = 'GMIB-REMOTE-LICENSE-SESSION-V1\n';
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const DIGEST = /^[A-Za-z0-9_-]{43}$/;

export type LicenseSessionAssertion = {
  version: 1;
  documentHash: string;
  proof: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const documentHash = (document: SignedLicense): string =>
  createHash('sha256')
    .update(document.payload)
    .update('\0')
    .update(document.signature)
    .digest('base64url');

const proof = (challenge: string, hash: string, secret: Buffer): Buffer =>
  createHmac('sha256', secret).update(PREFIX).update(challenge).update('\n').update(hash).digest();

export const createLicenseSessionAssertion = (
  document: SignedLicense,
  challenge: string,
  secret: Buffer,
): LicenseSessionAssertion | undefined => {
  if (!CHALLENGE.test(challenge)) return undefined;
  const hash = documentHash(document);
  return {
    version: 1,
    documentHash: hash,
    proof: proof(challenge, hash, secret).toString('base64url'),
  };
};

export const verifyLicenseSessionAssertion = (
  value: unknown,
  document: SignedLicense,
  challenge: string,
  secret: Buffer,
): boolean => {
  if (
    !CHALLENGE.test(challenge) ||
    !isRecord(value) ||
    Object.keys(value).sort().join() !== 'documentHash,proof,version' ||
    value.version !== 1 ||
    typeof value.documentHash !== 'string' ||
    !DIGEST.test(value.documentHash) ||
    typeof value.proof !== 'string' ||
    !DIGEST.test(value.proof)
  )
    return false;
  const hash = documentHash(document);
  if (value.documentHash !== hash) return false;
  const received = Buffer.from(value.proof, 'base64url');
  const expected = proof(challenge, hash, secret);
  return received.length === expected.length && timingSafeEqual(received, expected);
};
