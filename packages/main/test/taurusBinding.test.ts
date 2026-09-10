import { describe, expect, it } from 'vitest';

import { getMatchingTaurusSerials, matchesTaurusSerial } from '../../common/novastar';

describe('Taurus screen binding', () => {
  const serialNumber = '26721A000005306';

  it('matches a full serial number exactly', () => {
    expect(matchesTaurusSerial(`taurus:${serialNumber}`, serialNumber)).toBe(true);
    expect(matchesTaurusSerial('taurus:26721A000005307', serialNumber)).toBe(false);
  });

  it('matches the last four or more serial number characters', () => {
    expect(matchesTaurusSerial('taurus:5306', serialNumber)).toBe(true);
    expect(matchesTaurusSerial('taurus:005306', serialNumber)).toBe(true);
    expect(matchesTaurusSerial('taurus:a000005306', serialNumber)).toBe(true);
  });

  it('matches serial number letters without regard to case', () => {
    expect(matchesTaurusSerial('taurus:a000005306', serialNumber)).toBe(true);
  });

  it('rejects suffixes shorter than four characters and the all selector', () => {
    expect(matchesTaurusSerial('taurus:306', serialNumber)).toBe(false);
    expect(matchesTaurusSerial('taurus:*', serialNumber)).toBe(false);
  });

  it('does not match an internal fragment or a selector longer than the serial', () => {
    expect(matchesTaurusSerial('taurus:21A0', serialNumber)).toBe(false);
    expect(matchesTaurusSerial(`taurus:0${serialNumber}`, serialNumber)).toBe(false);
  });

  it('returns every suffix match so an ambiguous binding can be rejected', () => {
    expect(getMatchingTaurusSerials('taurus:5306', [serialNumber, '26721A999995306'])).toEqual([
      serialNumber,
      '26721A999995306',
    ]);
  });

  it('prefers a full serial number over a longer serial with the same suffix', () => {
    expect(
      getMatchingTaurusSerials(`taurus:${serialNumber}`, [serialNumber, `0${serialNumber}`]),
    ).toEqual([serialNumber]);
  });
});
