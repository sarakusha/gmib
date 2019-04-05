/*
 * @license
 * Copyright (c) 2019. OOO Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
/* tslint:disable:variable-name */
import * as t from 'io-ts';

export const FindKindV = t.keyof({
  sarp: null,
  version: null,
}, 'FindKind');
export type FindKind = t.TypeOf<typeof FindKindV>;

export const NibusBaudRateV = t.union(
  [t.literal(115200), t.literal(57600), t.literal(28800)],
  'NibusBaudRate',
);

export const NibusParityV = t.keyof(
  {
    none: null,
    even: null,
    mark: null,
  },
  'NibusParity',
);

export type NibusBaudRate = t.TypeOf<typeof NibusBaudRateV>;
export type NibusParity = t.TypeOf<typeof NibusParityV>;

export const MibDescriptionV = t.partial({
  type: t.number,
  mib: t.string,
  link: t.boolean,
  baudRate: NibusBaudRateV,
  parity: NibusParityV,
  category: t.string,
  find: FindKindV,
  disableBatchReading: t.boolean,
});

export interface IMibDescription extends t.TypeOf<typeof MibDescriptionV> {
  // baudRate?: NibusBaudRate;
  // parity?: NibusParity;
  // find?: FindKind;
}
