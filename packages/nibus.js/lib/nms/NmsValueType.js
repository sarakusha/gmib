"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var NmsValueType;

(function (NmsValueType) {
  NmsValueType[NmsValueType["Unknown"] = 0] = "Unknown";
  NmsValueType[NmsValueType["Boolean"] = 11] = "Boolean";
  NmsValueType[NmsValueType["Int8"] = 16] = "Int8";
  NmsValueType[NmsValueType["Int16"] = 2] = "Int16";
  NmsValueType[NmsValueType["Int32"] = 3] = "Int32";
  NmsValueType[NmsValueType["Int64"] = 20] = "Int64";
  NmsValueType[NmsValueType["UInt8"] = 17] = "UInt8";
  NmsValueType[NmsValueType["UInt16"] = 18] = "UInt16";
  NmsValueType[NmsValueType["UInt32"] = 19] = "UInt32";
  NmsValueType[NmsValueType["UInt64"] = 21] = "UInt64";
  NmsValueType[NmsValueType["Real32"] = 4] = "Real32";
  NmsValueType[NmsValueType["Real64"] = 5] = "Real64";
  NmsValueType[NmsValueType["String"] = 30] = "String";
  NmsValueType[NmsValueType["DateTime"] = 7] = "DateTime";
  NmsValueType[NmsValueType["Array"] = 128] = "Array";
  NmsValueType[NmsValueType["BooleanArray"] = 139] = "BooleanArray";
  NmsValueType[NmsValueType["Int8Array"] = 144] = "Int8Array";
  NmsValueType[NmsValueType["Int16Array"] = 130] = "Int16Array";
  NmsValueType[NmsValueType["Int32Array"] = 131] = "Int32Array";
  NmsValueType[NmsValueType["Int64Array"] = 148] = "Int64Array";
  NmsValueType[NmsValueType["UInt8Array"] = 145] = "UInt8Array";
  NmsValueType[NmsValueType["UInt16Array"] = 146] = "UInt16Array";
  NmsValueType[NmsValueType["UInt32Array"] = 147] = "UInt32Array";
  NmsValueType[NmsValueType["UInt64Array"] = 149] = "UInt64Array";
  NmsValueType[NmsValueType["Real32Array"] = 132] = "Real32Array";
  NmsValueType[NmsValueType["Real64Array"] = 133] = "Real64Array";
})(NmsValueType || (NmsValueType = {}));

var _default = NmsValueType;
exports.default = _default;