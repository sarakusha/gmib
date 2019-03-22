"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ConfigV = exports.PATH = void 0;

var t = _interopRequireWildcard(require("io-ts"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

/* tslint:disable:variable-name */
const PATH = '/tmp/nibus.service.sock';
exports.PATH = PATH;
const LogLevelV = t.keyof({
  none: null,
  hex: null,
  nibus: null
});
const MibTypeV = t.array(t.intersection([t.type({
  mib: t.string
}), t.partial({
  minVersion: t.number
})]));
const ConfigV = t.partial({
  logLevel: LogLevelV,
  omit: t.union([t.array(t.string), t.null]),
  pick: t.union([t.array(t.string), t.null]),
  mibs: t.array(t.string),
  mibTypes: t.record(t.string, MibTypeV)
}); // type MibType = t.TypeOf<typeof MibTypeV>;

exports.ConfigV = ConfigV;