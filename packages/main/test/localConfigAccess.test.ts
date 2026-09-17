import { describe, expect, it } from 'vitest';

import { isRendererConfigKey } from '../src/localConfigAccess';

describe('renderer local configuration access', () => {
  it.each(['health', 'hosts', 'linuxPreferSoftwareDecoding'])(
    'allows the renderer setting %s',
    key => {
      expect(isRendererConfigKey(key)).toBe(true);
    },
  );

  it.each([
    'signedLicense',
    'announce',
    'iv',
    'knock',
    'salt',
    'verifier',
    'remoteAuth',
    'identifier',
  ])('keeps the internal setting %s in the main process', key => {
    expect(isRendererConfigKey(key)).toBe(false);
  });
});
