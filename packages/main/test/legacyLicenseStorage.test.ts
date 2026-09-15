import { describe, expect, it, vi } from 'vitest';

import { applyLegacyLicenseUpdate, parseLegacyLicenseUpdate } from '../src/legacyLicenseStorage';

describe('legacy license storage', () => {
  it('selects only supported fields from a server response', () => {
    expect(
      parseLegacyLicenseUpdate({
        announce: 'payload',
        iv: 'vector',
        knock: null,
        autoUpdate: true,
        plan: 'enterprise',
        message: 'untrusted css',
      }),
    ).toEqual({ announce: 'payload', iv: 'vector', knock: null, autoUpdate: true });
  });

  it('applies values and deletes explicit nulls without replacing the store', () => {
    const set = vi.fn();
    const remove = vi.fn();
    applyLegacyLicenseUpdate(
      { set, delete: remove },
      { announce: null, knock: 'next', autoUpdate: false },
    );
    expect(remove).toHaveBeenCalledWith('announce');
    expect(set).toHaveBeenCalledWith('knock', 'next');
    expect(set).toHaveBeenCalledWith('autoUpdate', false);
  });

  it('rejects malformed recognized fields', () => {
    expect(() => parseLegacyLicenseUpdate({ knock: 10 })).toThrow('invalid response');
  });
});
