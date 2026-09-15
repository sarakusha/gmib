import { describe, expect, it } from 'vitest';

import { getRuntimeAccessError } from './runtimeAccess';

import type { LicenseRuntimeState } from '/@common/license';

describe('getRuntimeAccessError', () => {
  it('allows an active runtime independently of its plan', () => {
    expect(
      getRuntimeAccessError({
        status: 'active',
        plan: 'basic',
        capabilities: [],
      }),
    ).toBeUndefined();
  });

  it.each<LicenseRuntimeState['status']>([
    'checking',
    'migration-required',
    'expired',
    'disabled',
    'invalid',
    'unlicensed',
  ])('blocks a %s runtime before opening a session', status => {
    expect(getRuntimeAccessError({ status, capabilities: [] })).toBe(
      'Требуется действующая лицензия',
    );
  });

  it('preserves the reason supplied by the trusted runtime', () => {
    expect(
      getRuntimeAccessError({
        status: 'disabled',
        capabilities: [],
        message: 'Лицензия отключена',
      }),
    ).toBe('Лицензия отключена');
  });

  it('leaves remote transport authorization to the serving GMIB', () => {
    expect(getRuntimeAccessError({ status: 'unlicensed', capabilities: [] }, true)).toBeUndefined();
  });
});
