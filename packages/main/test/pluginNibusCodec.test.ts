import { describe, expect, it } from 'vitest';
import {
  encodePluginPenalties,
  encodePluginScoreboard,
  encodePluginTeams,
  encodePluginTimer,
  decodePluginReport,
  informationReport,
} from '../src/pluginNibusCodec';

describe('Matchpad compatible sports reports', () => {
  it('matches the Report 5/50 payload from Matchpad period-start fixture', () => {
    const reports = encodePluginTimer({ valueMs: 1200000, running: true, mode: 'game' });
    // 02_period_1_start.hex: timer at 20:00, active/dots bits use typed-struct MSB ordering.
    expect(reports[0][1].toString('hex')).toBe('91030120000000ffff0000');
    expect(reports[1][1].toString('hex')).toBe('13804f1200');
    expect(encodePluginTimer({ valueMs: 30000, running: true, mode: 'timeout' })).toHaveLength(1);
  });
  it('uses UI1 for period and UI2 for scores', () => {
    expect(
      encodePluginScoreboard({ home: 12, away: 3, period: 2 }).map(([id, data]) => [
        id,
        data.toString('hex'),
      ]),
    ).toEqual([
      [6, '120c00'],
      [7, '120300'],
      [8, '1102'],
    ]);
  });
  it('encodes penalty slots and clears them at zero', () => {
    const data = encodePluginPenalties({
      home: [{ number: '17', remainingMs: 120000 }],
      away: [],
    })[0][1];
    expect(data.subarray(0, 7).toString('hex')).toBe('91020317020000');
    const report = decodePluginReport('test', informationReport('FF:FF:FF:FF:FF:FF', 28, data));
    expect(report).toMatchObject({
      kind: 'penalties',
      value: { home: [{ number: '17', remainingMs: 120000 }], away: [] },
    });
    expect(
      encodePluginPenalties({ home: [{ number: '17', remainingMs: 0 }], away: [] })[0][1]
        .subarray(2)
        .equals(Buffer.alloc(20)),
    ).toBe(true);
    expect(() =>
      encodePluginPenalties({ home: [{ number: '101', remainingMs: 120000 }], away: [] }),
    ).toThrow();
  });
  it('roundtrips Cyrillic names without exposing raw data', () => {
    const [id, data] = encodePluginTeams({ home: 'Лада', away: 'Гости' })[0];
    expect(
      decodePluginReport('test', informationReport('FF:FF:FF:FF:FF:FF', id, data)),
    ).toMatchObject({ kind: 'teamName', side: 'home', value: 'Лада' });
    expect(
      decodePluginReport('test', informationReport('FF:FF:FF:FF:FF:FF', 999, Buffer.from([17, 1]))),
    ).toBeUndefined();
  });
});
