"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NMS_MAX_DATA_LENGTH = exports.MAX_DATA_LENGTH = exports.SERVICE_INFO_LENGTH = exports.PREAMBLE = exports.Offsets = exports.States = void 0;
let States;
exports.States = States;

(function (States) {
  States[States["PREAMBLE_WAITING"] = 0] = "PREAMBLE_WAITING";
  States[States["HEADER_READING"] = 1] = "HEADER_READING";
  States[States["DATA_READING"] = 2] = "DATA_READING";
})(States || (exports.States = States = {}));

let Offsets;
exports.Offsets = Offsets;

(function (Offsets) {
  Offsets[Offsets["DESTINATION"] = 1] = "DESTINATION";
  Offsets[Offsets["SOURCE"] = 7] = "SOURCE";
  Offsets[Offsets["SERVICE"] = 13] = "SERVICE";
  Offsets[Offsets["LENGTH"] = 14] = "LENGTH";
  Offsets[Offsets["PROTOCOL"] = 15] = "PROTOCOL";
  Offsets[Offsets["DATA"] = 16] = "DATA";
})(Offsets || (exports.Offsets = Offsets = {}));

const PREAMBLE = 0x7E;
exports.PREAMBLE = PREAMBLE;
const SERVICE_INFO_LENGTH = Offsets.DATA;
exports.SERVICE_INFO_LENGTH = SERVICE_INFO_LENGTH;
const MAX_DATA_LENGTH = 238;
exports.MAX_DATA_LENGTH = MAX_DATA_LENGTH;
const NMS_MAX_DATA_LENGTH = 63;
exports.NMS_MAX_DATA_LENGTH = NMS_MAX_DATA_LENGTH;