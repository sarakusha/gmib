import { Address, createNmsWrite, NmsDatagram, NmsServiceType, NmsValueType } from '@nibus/core';
import type {
  PluginInformationReport,
  PluginPenaltiesState,
  PluginScoreboardState,
  PluginTeamsState,
  PluginTimerState,
} from '/@common/pluginNibus';

const uint = (value: number, maximum: number) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum)
    throw new Error('Значение NiBUS вне диапазона');
  return value;
};
const bcd = (value: number) => {
  uint(value, 99);
  return Math.floor(value / 10) * 16 + (value % 10);
};
const fromBcd = (value: number) => {
  if ((value & 15) > 9 || value >> 4 > 9) throw new Error('Некорректный BCD');
  return (value >> 4) * 10 + (value & 15);
};
export const informationReport = (target: string, id: number, payload: Buffer) =>
  new NmsDatagram({
    destination: new Address(target),
    source: Address.empty,
    id,
    service: NmsServiceType.InformationReport,
    notReply: true,
    nms: payload,
  });
const scalar = (type: NmsValueType, value: unknown) =>
  createNmsWrite(Address.empty, 0, type, value, true).nms;
export const encodePluginTimer = (state: PluginTimerState): Array<[number, Buffer]> => {
  uint(state.valueMs, 5999000);
  if (typeof state.running !== 'boolean' || !['game', 'rest', 'timeout'].includes(state.mode))
    throw new Error('Некорректный таймер NiBUS');
  const seconds = Math.ceil(state.valueMs / 1000);
  const data = Buffer.alloc(11);
  data[0] = 0x91;
  data[1] =
    (state.running ? 0x03 : 0) |
    (state.mode === 'rest' ? 0x04 : 0) |
    (state.mode === 'timeout' ? 0x40 : 0);
  data[2] = 1;
  data[3] = bcd(Math.floor(seconds / 60));
  data[4] = bcd(seconds % 60);
  data.writeUInt32LE(state.running ? 0xffff00 : 0xff0000, 6);
  return state.mode === 'game'
    ? [
        [5, data],
        [50, scalar(NmsValueType.UInt32, state.valueMs)],
      ]
    : [[5, data]];
};
export const encodePluginScoreboard = (state: PluginScoreboardState): Array<[number, Buffer]> => [
  [6, scalar(NmsValueType.UInt16, uint(state.home, 65535))],
  [7, scalar(NmsValueType.UInt16, uint(state.away, 65535))],
  [8, scalar(NmsValueType.UInt8, uint(state.period, 255))],
];
export const encodePluginPenalties = (state: PluginPenaltiesState): Array<[number, Buffer]> => {
  const data = Buffer.alloc(22);
  data[0] = 0x91;
  data[1] = 2;
  for (const [sideIndex, side] of (['home', 'away'] as const).entries()) {
    if (!Array.isArray(state[side]) || state[side].length > 2)
      throw new Error('Профиль NiBUS поддерживает два штрафа на команду');
    state[side].forEach((penalty, index) => {
      if (!/^\d{1,2}$/.test(penalty.number))
        throw new Error('NiBUS: номер штрафа должен быть от 0 до 99');
      const seconds = Math.ceil(uint(penalty.remainingMs, 5999000) / 1000);
      if (seconds === 0) return;
      const offset = 2 + (sideIndex * 2 + index) * 5;
      data[offset] = 0x03;
      data[offset + 1] = bcd(Number(penalty.number));
      data[offset + 2] = bcd(Math.floor(seconds / 60));
      data[offset + 3] = bcd(seconds % 60);
    });
  }
  return [[28, data]];
};
export const encodePluginTeams = (state: PluginTeamsState): Array<[number, Buffer]> =>
  (['home', 'away'] as const).map((side, index) => {
    if (typeof state[side] !== 'string' || state[side].length > 100)
      throw new Error('Некорректное название команды');
    const encoded = scalar(NmsValueType.String, state[side]).subarray(1);
    return [
      19 + index,
      Buffer.concat([
        Buffer.from([30]),
        encoded.subarray(
          0,
          Math.min(encoded.indexOf(0) < 0 ? encoded.length : encoded.indexOf(0), 61),
        ),
        Buffer.from([0]),
      ]),
    ];
  });
export const decodePluginReport = (
  connectionId: string,
  report: NmsDatagram,
): PluginInformationReport | undefined => {
  const meta = { connectionId, source: report.source.toString() };
  const data = report.nms;
  try {
    if (report.id === 50 && data.length === 5 && data[0] === 19)
      return { ...meta, kind: 'timer', value: { valueMs: data.readUInt32LE(1) } };
    if (report.id === 5 && data.length >= 6 && data[0] === 0x91)
      return {
        ...meta,
        kind: 'timer',
        value: {
          valueMs: (fromBcd(data[3]) * 60 + fromBcd(data[4])) * 1000,
          running: Boolean(data[1] & 1),
          mode: data[1] & 4 ? 'rest' : data[1] & 64 ? 'timeout' : 'game',
        },
      };
    if ((report.id === 6 || report.id === 7) && data.length === 3 && data[0] === 18)
      return {
        ...meta,
        kind: 'score',
        side: report.id === 6 ? 'home' : 'away',
        value: data.readUInt16LE(1),
      };
    if (report.id === 8 && data.length === 2 && data[0] === 17)
      return { ...meta, kind: 'period', value: data[1] };
    if (
      (report.id === 19 || report.id === 20) &&
      data[0] === 30 &&
      typeof report.value === 'string'
    )
      return {
        ...meta,
        kind: 'teamName',
        side: report.id === 19 ? 'home' : 'away',
        value: report.value,
      };
    if (report.id === 28 && data[0] === 0x91 && data[1] <= 6 && data.length === 2 + data[1] * 10) {
      const value: PluginPenaltiesState = { home: [], away: [] };
      for (const [sideIndex, side] of (['home', 'away'] as const).entries())
        for (let i = 0; i < data[1]; i += 1) {
          const offset = 2 + (sideIndex * data[1] + i) * 5;
          if (data[offset] & 1)
            value[side].push({
              number: String(fromBcd(data[offset + 1])),
              remainingMs: (fromBcd(data[offset + 2]) * 60 + fromBcd(data[offset + 3])) * 1000,
            });
        }
      return { ...meta, kind: 'penalties', value };
    }
  } catch {
    return undefined;
  }
  return undefined;
};
