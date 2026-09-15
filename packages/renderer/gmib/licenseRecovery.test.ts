import { describe, expect, it } from 'vitest';

import { canRetryStoredLicense } from './licenseRecovery';

describe('canRetryStoredLicense', () => {
  it.each(['migration-required', 'expired', 'disabled', 'unlicensed'] as const)(
    'offers recovery for %s state',
    status => {
      expect(canRetryStoredLicense(status)).toBe(true);
    },
  );

  it.each(['checking', 'active', 'invalid'] as const)(
    'does not retry %s state without a replacement key',
    status => {
      expect(canRetryStoredLicense(status)).toBe(false);
    },
  );
});
