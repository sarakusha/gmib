/* tslint:disable:variable-name */
import * as t from 'io-ts';
export const PATH = '/tmp/nibus.service.sock';

const LogLevelV = t.keyof({
  none: null,
  hex: null,
  nibus: null,
});

const MibTypeV = t.array(t.intersection([
  t.type({ mib: t.string }),
  t.partial({ minVersion: t.number }),
]));

export const ConfigV = t.partial({
  logLevel: LogLevelV,
  omit: t.union([t.array(t.string), t.null]),
  pick: t.union([t.array(t.string), t.null]),
  mibs: t.array(t.string),
  mibTypes: t.record(t.string, MibTypeV),
});

// type MibType = t.TypeOf<typeof MibTypeV>;
export type Config = t.TypeOf<typeof ConfigV>;

export type LogLevel = t.TypeOf<typeof LogLevelV>;
