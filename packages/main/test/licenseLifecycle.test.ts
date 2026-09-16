import { describe, expect, it } from 'vitest';

import {
  getPayloadRuntimeState,
  sessionTermsChanged,
  shouldRefreshStoredLicense,
} from '../src/licenseLifecycle';

import type { LicensePayloadV2, LicenseRuntimeStatus } from '/@common/license';

const payload = (changes: Partial<LicensePayloadV2> = {}): LicensePayloadV2 => ({
  version: 2,
  issuer: 'app.nata-info.ru',
  audience: 'gmib',
  keyId: 'test',
  licenseId: 'license',
  deviceId: 'device',
  issuedAt: '2026-09-15T10:00:00.000Z',
  expiresAt: '2026-10-15T10:00:00.000Z',
  status: 'active',
  plan: 'plus',
  capabilities: ['plugins', 'taurus'],
  presentation: { version: 1, css: '' },
  ...changes,
});

describe('license lifecycle decisions', () => {
  it('expires an active document exactly at its local boundary', () => {
    const expiresAt = Date.parse(payload().expiresAt!);
    expect(getPayloadRuntimeState(payload(), expiresAt - 1).status).toBe('active');
    expect(getPayloadRuntimeState(payload(), expiresAt).status).toBe('expired');
  });

  it.each(['migration-required', 'expired', 'disabled', 'unlicensed'] as LicenseRuntimeStatus[])(
    'refreshes a verified %s document during startup',
    status => {
      expect(shouldRefreshStoredLicense({ status, capabilities: [] })).toBe(true);
    },
  );

  it('does not refresh a valid active session or an unverifiable document', () => {
    expect(shouldRefreshStoredLicense({ status: 'active', capabilities: [] })).toBe(false);
    expect(shouldRefreshStoredLicense({ status: 'invalid', capabilities: [] })).toBe(false);
  });

  it('ignores signature renewal and capability ordering', () => {
    expect(
      sessionTermsChanged(
        payload(),
        payload({ issuedAt: '2026-09-16T10:00:00.000Z', capabilities: ['taurus', 'plugins'] }),
      ),
    ).toBe(false);
  });

  it.each([
    payload({ status: 'disabled' }),
    payload({ plan: 'standard' }),
    payload({ expiresAt: '2026-09-20T10:00:00.000Z' }),
    payload({ capabilities: ['plugins'] }),
    payload({ presentation: { version: 1, css: 'signed-css' } }),
  ])('requires a restart when effective terms change', refreshed => {
    expect(sessionTermsChanged(payload(), refreshed)).toBe(true);
  });
});
