/*
 * @license
 * Copyright (c) 2019. OOO Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import Address from '../Address';
import SarpDatagram, { ISarpOptions } from './SarpDatagram';
import SarpQueryType from './SarpQueryType';

export { SarpQueryType };
export { SarpDatagram, ISarpOptions };

export function createSarp(
  queryType: SarpQueryType, queryParam: Buffer | Uint8Array | number[] = Buffer.alloc(5)) {
  const param: Buffer = Buffer.isBuffer(queryParam)
    ? queryParam
    : Buffer.from(<number[]>(queryParam));
  return new SarpDatagram({
    queryType,
    destination: Address.broadcast,
    queryParam: param,
  });
}
