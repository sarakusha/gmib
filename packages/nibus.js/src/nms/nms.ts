import { decode, encode } from 'iconv-lite';
import { MibError } from '../errors';
import { NMS_MAX_DATA_LENGTH } from '../nbconst';
import { chunkArray } from '../nibus/helper';
import NmsValueType from './NmsValueType';

const packByte = (b: number) => (((b % 100) / 10) * 16) + (b % 10);
const unpackByte = (byte: number) => (byte & 0x0f) + (((byte >> 4) & 0x0f) * 10);

function getDateTime(buffer: Buffer, offset: number = 0) {
  const day = unpackByte(buffer.readUInt8(offset));
  const month = unpackByte(buffer.readUInt8(1 + offset));
  const year = unpackByte(buffer.readUInt8(3 + offset))
    + (100 * unpackByte(buffer.readUInt8(2 + offset)));
  const hour = unpackByte(buffer.readUInt8(4 + offset));
  const minute = unpackByte(buffer.readUInt8(5 + offset));
  const second = unpackByte(buffer.readUInt8(6 + offset));
  const ms = unpackByte(buffer.readUInt8(8 + offset))
    + (100 * (buffer.readUInt8(7 + offset) & 0x0f));
  return new Date(year, month, day, hour, minute, second, ms);
}

export function getSizeOf(valueType?: NmsValueType, value?: string): number {
  switch (valueType) {
    case undefined:
      return 0;
    case NmsValueType.Boolean:
    case NmsValueType.Int8:
    case NmsValueType.UInt8:
      return 1;
    case NmsValueType.Int16:
    case NmsValueType.UInt16:
      return 2;
    case NmsValueType.Int32:
    case NmsValueType.UInt32:
    case NmsValueType.Real32:
      return 4;
    case NmsValueType.Int64:
    case NmsValueType.UInt64:
    case NmsValueType.Real64:
      return 8;
    case NmsValueType.DateTime:
      return 10;
    case NmsValueType.String:
      return value ? (value.length + 1) : 0;
  }

  if ((valueType & NmsValueType.Array) === 0) {
    throw new MibError('Invalid ValueType');
  }

  const arrayType = valueType & (NmsValueType.Array - 1);
  const itemSize = getSizeOf(arrayType) || 0;

  return value ? value.length * itemSize : itemSize;
}

export function decodeValue(valueType: NmsValueType, buffer: Buffer, offset = 0): any {
  console.assert(
    buffer.length >= offset + getSizeOf(valueType),
    `Buffer is too small ${buffer.length} < ${offset} + ${getSizeOf(valueType)}`,
  );
  switch (valueType) {
    case NmsValueType.Boolean:
      return !!buffer[offset];
    case NmsValueType.Int8:
      return buffer.readInt8(offset);
    case NmsValueType.Int16:
      return buffer.readInt16LE(offset);
    case NmsValueType.Int32:
      return buffer.readInt32LE(offset);
    case NmsValueType.Int64:
    case NmsValueType.UInt64:
      return buffer
        .toString('hex', offset, offset + 8)
        .match(/.{2}/g)!
        .reverse().join('')
        .toUpperCase();
    case NmsValueType.UInt8:
      return buffer.readUInt8(offset);
    case NmsValueType.UInt16:
      return buffer.readUInt16LE(offset);
    case NmsValueType.UInt32:
      return buffer.readUInt32LE(offset);
    case NmsValueType.Real32:
      return buffer.readFloatLE(offset);
    case NmsValueType.Real64:
      return buffer.readDoubleLE(offset);
    case NmsValueType.String: {
      const nil = buffer.indexOf(0, offset);
      return decode(buffer.slice(offset, nil !== -1 ? nil : undefined), 'win1251');
    }
    case NmsValueType.DateTime:
      return getDateTime(buffer, offset);
    default:
      break;
  }

  if ((valueType & NmsValueType.Array) === 0) {
    throw new MibError(`Invalid ValueType ${NmsValueType[valueType]}`);
  }

  const arrayType = valueType & (NmsValueType.Array - 1);
  const arraySize = buffer.length - offset;
  const itemSize = getSizeOf(arrayType);
  const arrayLength = arraySize / itemSize;
  const array = [];

  for (let i = 0; i < arrayLength; i += 1) {
    const value = decodeValue(arrayType, buffer, offset + (i * itemSize));
    array.push(value);
  }

  return array;
}

function writeValue(valueType: NmsValueType, value: any, buffer: Buffer, offset = 0): number {
  let pos = offset;
  switch (valueType) {
    case NmsValueType.Boolean:
      pos = buffer.writeUInt8(value ? 1 : 0, pos);
      break;
    case NmsValueType.Int8:
      pos = buffer.writeInt8(value, pos);
      break;
    case NmsValueType.Int16:
      pos = buffer.writeInt16LE(value, pos);
      break;
    case NmsValueType.Int32:
      pos = buffer.writeInt32LE(value, pos);
      break;
    case NmsValueType.Int64:
      console.error('signedLong is not implemented');
      break;
    case NmsValueType.UInt64:
      if (typeof value === 'number') {
        const int = Math.floor(value);
        const low = int & 0xFFFFFFFF;
        const hi = 0;
        // console.log(`${valueType} hi=${hi} lo=${low} value=${value}, int=${int}`);
        pos = buffer.writeUInt32LE(low, pos);
        pos = buffer.writeUInt32LE(hi, pos);
      }
      if (typeof value === 'string') {
        // console.log('STR', value);
        // const start = pos;
        pos = buffer.write(
          chunkArray(value.padStart(16, '0'), 2).reverse().join(''),
          pos,
          8,
          'hex',
        );
        // console.log('BUF', buffer.toString('hex', start, pos + 1));
      }
      break;
    case NmsValueType.UInt8:
      pos = buffer.writeUInt8(value, pos);
      break;
    case NmsValueType.UInt16:
      pos = buffer.writeUInt16LE(value, pos);
      break;
    case NmsValueType.UInt32:
      pos = buffer.writeUInt32LE(value, pos);
      break;
    case NmsValueType.Real32:
      pos = buffer.writeFloatLE(value, pos);
      break;
    case NmsValueType.Real64:
      pos = buffer.writeDoubleLE(value, pos);
      break;
    case NmsValueType.String: {
      let src = encode(value, 'win1251');
      if (src.length > NMS_MAX_DATA_LENGTH - 2) {
        src = src.slice(0, NMS_MAX_DATA_LENGTH - 2);
      }
      pos = src.copy(buffer, pos);
      pos = buffer.writeUInt8(0, pos + offset);
      break;
    }
    case NmsValueType.DateTime: {
      const dtbuffer = Buffer.from([
        packByte(value.getDate()),
        packByte(value.getMonth()),
        packByte(value.getFullYear() % 100),
        packByte(Math.floor(value.getFullYear() / 100)),
        packByte(value.getHours()),
        packByte(value.getMinutes()),
        packByte(value.getSeconds()),
        packByte(Math.floor(value.getMilliseconds() / 100) & 0x0f),
        packByte(value.getMilliseconds() % 100),
        packByte(value.getDay() + 1),
      ]);
      pos = offset + dtbuffer.copy(buffer, pos);
      break;
    }
    default:
      break;
  }

  if (valueType & NmsValueType.Array) {
    // TODO: Проверить запись массивов
    const arrayType = valueType & (NmsValueType.Array - 1);

    for (const item of value) {
      pos = writeValue(arrayType, item, buffer, pos);
    }
  }

  return pos;
}

export function encodeValue(valueType: NmsValueType, value: any) {
  const buffer = Buffer.alloc(1 + getSizeOf(valueType, value));
  buffer[0] = valueType & 0xFF;
  writeValue(valueType, value, buffer, 1);
  return buffer;
}

export function getNmsType(simpleType: string) {
  switch (simpleType) {
    case 'xs:boolean':
      return NmsValueType.Boolean;
    case 'xs:unsignedByte':
      return NmsValueType.UInt8;
    case 'xs:byte':
      return NmsValueType.Int8;
    case 'xs:short':
      return NmsValueType.Int16;
    case 'xs:unsignedShort':
      return NmsValueType.UInt16;
    case 'xs:int':
      return NmsValueType.Int32;
    case 'xs:unsignedInt':
      return NmsValueType.UInt32;
    case 'xs:long':
      return NmsValueType.Int64;
    case 'xs:unsignedLong':
      return NmsValueType.UInt64;
    case 'xs:float':
      return NmsValueType.Real32;
    case 'xs:NMTOKEN':
      return NmsValueType.UInt8;
    case 'xs:string':
      return NmsValueType.String;
    default:
      return NmsValueType.Unknown;
  }
}
