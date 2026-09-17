import { describe, expect, it } from 'vitest';

import { srpSessionKeyToBuffer } from '/@common/srp';

describe('SRP session key codec', () => {
  it('preserves the legacy odd-length hexadecimal conversion', () => {
    expect(srpSessionKeyToBuffer(0xabcn)).toEqual(Buffer.from('abc', 'hex'));
  });
});
