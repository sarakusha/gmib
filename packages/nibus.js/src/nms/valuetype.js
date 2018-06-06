import _ from 'lodash';

const NmsValueType = {
  Unknown: 0,
  Boolean: 11,
  Int8: 16,
  Int16: 2,
  Int32: 3,
  Int64: 20,
  UInt8: 17,
  UInt16: 18,
  UInt32: 19,
  UInt64: 21,
  Real32: 4,
  Real64: 5,
  String: 30,
  DateTime: 7,
  Array: 0x80,
};

[
  'Boolean',
  'Int8',
  'Int16',
  'Int32',
  'Int64',
  'UInt8',
  'UInt16',
  'UInt32',
  'UInt64',
  'Real32',
  'Real64',
].forEach((key) => {
// eslint-disable-next-line no-bitwise
  Reflect.set(NmsValueType, `${key}Array`, Reflect.get(NmsValueType, key) | NmsValueType.Array);
});

_.transform(NmsValueType, (self, value, key) => {
  Reflect.set(self, value, key);
}, NmsValueType);

export default Object.freeze(NmsValueType);
