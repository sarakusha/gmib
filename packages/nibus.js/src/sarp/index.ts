import Address from '../Address';
import SarpDatagram, { ISarpOptions } from './SarpDatagram';
import SarpQueryType from './SarpQueryType';

export { SarpQueryType };
export { SarpDatagram, ISarpOptions };

export function createSarp(
  queryType: SarpQueryType, queryParam: Buffer | Uint8Array | number[] = Buffer.alloc(5)) {
  const param: Buffer = Buffer.isBuffer(queryParam) ? queryParam : Buffer.from(queryParam);
  return new SarpDatagram({
    queryType,
    destination: Address.broadcast,
    queryParam: param,
  });
}
