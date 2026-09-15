export const licensePlans = ['basic', 'standard', 'plus', 'premium', 'enterprise'] as const;
export type LicensePlan = (typeof licensePlans)[number];

export const licenseStatuses = ['active', 'disabled', 'expired', 'unbound'] as const;
export type LicenseStatus = (typeof licenseStatuses)[number];

export type LicensePayloadV2 = {
  version: 2;
  issuer: 'app.nata-info.ru';
  audience: 'gmib';
  keyId: string;
  licenseId: string;
  deviceId: string;
  issuedAt: string;
  expiresAt: string | null;
  status: LicenseStatus;
  plan: LicensePlan;
  capabilities: string[];
};

export type SignedLicense = {
  payload: string;
  signature: string;
};

export type LicenseRuntimeStatus =
  | 'checking'
  | 'migration-required'
  | 'active'
  | 'expired'
  | 'disabled'
  | 'invalid'
  | 'unlicensed';

export type LicenseRuntimeState = {
  status: LicenseRuntimeStatus;
  plan?: LicensePlan;
  expiresAt?: string | null;
  capabilities: string[];
  message?: string;
};

