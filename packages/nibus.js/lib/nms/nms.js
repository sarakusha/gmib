"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getSizeOf = getSizeOf;
exports.decodeValue = decodeValue;
exports.encodeValue = encodeValue;
exports.getNmsType = getNmsType;

var _iconvLite = require("iconv-lite");

var _errors = require("../errors");

var _nbconst = require("../nbconst");

var _NmsValueType = _interopRequireDefault(require("./NmsValueType"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const packByte = b => b % 100 / 10 * 16 + b % 10;

const unpackByte = byte => (byte & 0x0f) + (byte >> 4 & 0x0f) * 10;

function getDateTime(buffer, offset = 0) {
  const day = unpackByte(buffer.readUInt8(offset));
  const month = unpackByte(buffer.readUInt8(1 + offset));
  const year = unpackByte(buffer.readUInt8(3 + offset)) + 100 * unpackByte(buffer.readUInt8(2 + offset));
  const hour = unpackByte(buffer.readUInt8(4 + offset));
  const minute = unpackByte(buffer.readUInt8(5 + offset));
  const second = unpackByte(buffer.readUInt8(6 + offset));
  const ms = unpackByte(buffer.readUInt8(8 + offset)) + 100 * (buffer.readUInt8(7 + offset) & 0x0f);
  return new Date(year, month, day, hour, minute, second, ms);
}

function getSizeOf(valueType, value) {
  switch (valueType) {
    case undefined:
      return 0;

    case _NmsValueType.default.Boolean:
    case _NmsValueType.default.Int8:
    case _NmsValueType.default.UInt8:
      return 1;

    case _NmsValueType.default.Int16:
    case _NmsValueType.default.UInt16:
      return 2;

    case _NmsValueType.default.Int32:
    case _NmsValueType.default.UInt32:
    case _NmsValueType.default.Real32:
      return 4;

    case _NmsValueType.default.Int64:
    case _NmsValueType.default.UInt64:
    case _NmsValueType.default.Real64:
      return 8;

    case _NmsValueType.default.DateTime:
      return 10;

    case _NmsValueType.default.String:
      return value ? value.length + 1 : 0;
  }

  if ((valueType & _NmsValueType.default.Array) === 0) {
    throw new _errors.MibError('Invalid ValueType');
  }

  const arrayType = valueType & _NmsValueType.default.Array - 1;
  const itemSize = getSizeOf(arrayType) || 0;
  return value ? value.length * itemSize : itemSize;
}

function decodeValue(valueType, buffer, offset = 0) {
  console.assert(buffer.length >= offset + getSizeOf(valueType), `Buffer is too small ${buffer.length} < ${offset} + ${getSizeOf(valueType)}`);

  switch (valueType) {
    case _NmsValueType.default.Boolean:
      return !!buffer[offset];

    case _NmsValueType.default.Int8:
      return buffer.readInt8(offset);

    case _NmsValueType.default.Int16:
      return buffer.readInt16LE(offset);

    case _NmsValueType.default.Int32:
      return buffer.readInt32LE(offset);

    case _NmsValueType.default.Int64:
    case _NmsValueType.default.UInt64:
      return buffer.toString('hex', offset, offset + 8).match(/.{2}/g).reverse().join('').toUpperCase();

    case _NmsValueType.default.UInt8:
      return buffer.readUInt8(offset);

    case _NmsValueType.default.UInt16:
      return buffer.readUInt16LE(offset);

    case _NmsValueType.default.UInt32:
      return buffer.readUInt32LE(offset);

    case _NmsValueType.default.Real32:
      return buffer.readFloatLE(offset);

    case _NmsValueType.default.Real64:
      return buffer.readDoubleLE(offset);

    case _NmsValueType.default.String:
      {
        const nil = buffer.indexOf(0, offset);
        return (0, _iconvLite.decode)(buffer.slice(offset, nil !== -1 ? nil : undefined), 'win1251');
      }

    case _NmsValueType.default.DateTime:
      return getDateTime(buffer, offset);

    default:
      break;
  }

  if ((valueType & _NmsValueType.default.Array) === 0) {
    throw new _errors.MibError(`Invalid ValueType ${_NmsValueType.default[valueType]}`);
  }

  const arrayType = valueType & _NmsValueType.default.Array - 1;
  const arraySize = buffer.length - offset;
  const itemSize = getSizeOf(arrayType);
  const arrayLength = arraySize / itemSize;
  const array = [];

  for (let i = 0; i < arrayLength; i += 1) {
    const value = decodeValue(arrayType, buffer, offset + i * itemSize);
    array.push(value);
  }

  return array;
}

function writeValue(valueType, value, buffer, offset = 0) {
  let pos = offset;

  switch (valueType) {
    case _NmsValueType.default.Boolean:
      pos = buffer.writeUInt8(value ? 1 : 0, pos);
      break;

    case _NmsValueType.default.Int8:
      pos = buffer.writeInt8(value, pos);
      break;

    case _NmsValueType.default.Int16:
      pos = buffer.writeInt16LE(value, pos);
      break;

    case _NmsValueType.default.Int32:
      pos = buffer.writeInt32LE(value, pos);
      break;

    case _NmsValueType.default.UInt64:
    case _NmsValueType.default.Int64:
      if (typeof value === 'number') {
        const int = Math.floor(value);
        const low = int & 0xFFFFFFFF;
        const hi = int >>> 32;
        pos = buffer.writeUInt32LE(low, pos);
        pos = buffer.writeUInt32LE(hi, pos);
      }

      if (typeof value === 'string') {
        pos = buffer.write(value, pos, value.length, 'hex');
      }

      break;

    case _NmsValueType.default.UInt8:
      pos = buffer.writeUInt8(value, pos);
      break;

    case _NmsValueType.default.UInt16:
      pos = buffer.writeUInt16LE(value, pos);
      break;

    case _NmsValueType.default.UInt32:
      pos = buffer.writeUInt32LE(value, pos);
      break;

    case _NmsValueType.default.Real32:
      pos = buffer.writeFloatLE(value, pos);
      break;

    case _NmsValueType.default.Real64:
      pos = buffer.writeDoubleLE(value, pos);
      break;

    case _NmsValueType.default.String:
      {
        let src = (0, _iconvLite.encode)(value, 'win1251');

        if (src.length > _nbconst.NMS_MAX_DATA_LENGTH - 2) {
          src = src.slice(0, _nbconst.NMS_MAX_DATA_LENGTH - 2);
        }

        pos = src.copy(buffer, pos);
        pos = buffer.writeUInt8(0, pos + offset);
        break;
      }

    case _NmsValueType.default.DateTime:
      {
        const dtbuffer = Buffer.from([packByte(value.getDate()), packByte(value.getMonth()), packByte(value.getFullYear() % 100), packByte(Math.floor(value.getFullYear() / 100)), packByte(value.getHours()), packByte(value.getMinutes()), packByte(value.getSeconds()), packByte(Math.floor(value.getMilliseconds() / 100) & 0x0f), packByte(value.getMilliseconds() % 100), packByte(value.getDay() + 1)]);
        pos = offset + dtbuffer.copy(buffer, pos);
        break;
      }

    default:
      break;
  }

  if (valueType & _NmsValueType.default.Array) {
    // TODO: Проверить запись массивов
    const arrayType = valueType & _NmsValueType.default.Array - 1;

    for (const item of value) {
      pos = writeValue(arrayType, item, buffer, pos);
    }
  }

  return pos;
}

function encodeValue(valueType, value) {
  const buffer = Buffer.alloc(1 + getSizeOf(valueType, value));
  buffer[0] = valueType & 0xFF;
  writeValue(valueType, value, buffer, 1);
  return buffer;
}

function getNmsType(simpleType) {
  switch (simpleType) {
    case 'xs:boolean':
      return _NmsValueType.default.Boolean;

    case 'xs:unsignedByte':
      return _NmsValueType.default.UInt8;

    case 'xs:byte':
      return _NmsValueType.default.Int8;

    case 'xs:short':
      return _NmsValueType.default.Int16;

    case 'xs:unsignedShort':
      return _NmsValueType.default.UInt16;

    case 'xs:int':
      return _NmsValueType.default.Int32;

    case 'xs:unsignedInt':
      return _NmsValueType.default.UInt32;

    case 'xs:long':
      return _NmsValueType.default.Int64;

    case 'xs:unsignedLong':
      return _NmsValueType.default.UInt64;

    case 'xs:float':
      return _NmsValueType.default.Real32;

    case 'xs:NMTOKEN':
      return _NmsValueType.default.UInt8;

    case 'xs:string':
      return _NmsValueType.default.String;

    default:
      return _NmsValueType.default.Unknown;
  }
}