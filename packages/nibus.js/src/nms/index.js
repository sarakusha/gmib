/* eslint-disable no-bitwise */
import { decode, encode } from 'iconv-lite';
import NmsValueType from './valuetype';
import { MibError } from '../errors';
import { NMS_MAX_DATA_LENGTH } from '../nbconst';

export { default as NmsServiceType } from './servicetype';
export { NmsValueType };

const packByte = b => (((b % 100) / 10) * 16) + (b % 10);
const unpackByte = byte => (byte & 0x0f) + (((byte >> 4) & 0x0f) * 10);

function getDateTime(buffer, offset) {
  const day = unpackByte(buffer.readUInt8(0 + offset));
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

export function getSizeOf(valueType, value) {
  switch (valueType) {
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
      return value.length + 1;
    default:
      break;
  }

  if ((valueType & NmsValueType.Array) === 0) {
    throw new MibError('Invalid ValueType');
  }

  const arrayType = valueType & (NmsValueType.Array - 1);
  const itemSize = getSizeOf(arrayType);

  return value ? value.length * itemSize : itemSize;
}

export function decodeValue(valueType, buffer, offset) {
  // if (buffer.length < offset + getSizeOf(valueType)) {
  //   return undefined;
  // }
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
      return buffer.toString('hex', offset, offset + 8).toUpperCase();
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
      return decode(buffer.slice(offset, nil !== -1 ? nil : undefined));
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

function writeValue(valueType, value, buffer, offset) {
  let pos;
  switch (valueType && 0xFF) {
    case NmsValueType.Boolean:
      pos = buffer.writeUInt8(value ? 1 : 0, offset);
      break;
    case NmsValueType.Int8:
      pos = buffer.writeInt8(value, offset);
      break;
    case NmsValueType.Int16:
      pos = buffer.writeInt16LE(value, offset);
      break;
    case NmsValueType.Int32:
      pos = buffer.writeInt32LE(value, offset);
      break;
    case NmsValueType.UInt64:
    case NmsValueType.Int64:
      if (typeof value === 'number') {
        const int = Math.floor(value);
        const low = int & 0xFFFFFFFF;
        const hi = int >>> 32;
        pos = buffer.writeUInt32LE(low, offset);
        pos = buffer.writeUInt32LE(hi, pos);
      }
      if (typeof value === 'string') {
        pos = buffer.write(value, offset, 'hex');
      }
      break;
    case NmsValueType.UInt8:
      pos = buffer.writeUInt8(value, offset);
      break;
    case NmsValueType.UInt16:
      pos = buffer.writeUInt16LE(value, offset);
      break;
    case NmsValueType.UInt32:
      pos = buffer.writeUInt32LE(value, offset);
      break;
    case NmsValueType.Real32:
      pos = buffer.writeFloatLE(value, offset);
      break;
    case NmsValueType.Real64:
      pos = buffer.writeDoubleLE(value, offset);
      break;
    case NmsValueType.String: {
      let src = encode(value, 'win1251');
      if (src.length > NMS_MAX_DATA_LENGTH - 2) {
        src = src.slice(0, NMS_MAX_DATA_LENGTH - 2);
      }
      pos += src.copy(buffer, offset);
      pos = buffer.writeUInt8(0, pos);
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
      pos = offset + dtbuffer.copy(buffer, offset);
      break;
    }
    default:
      pos = offset;
      break;
  }

  if (valueType & NmsValueType.Array) {
    // TODO: Проверить запись массивов
    const arrayType = valueType & (NmsValueType.Array - 1);

    for (let i = 0; i < value.length; i += 1) {
      pos = writeValue(arrayType, value[i], buffer, pos);
    }
  }

  return pos;
}

export function encodeValue(valueType, value) {
  const buffer = Buffer.alloc(1 + getSizeOf(valueType, value));
  buffer[0] = valueType & 0xFF;
  writeValue(valueType, value, buffer, 1);
  return buffer;
}
