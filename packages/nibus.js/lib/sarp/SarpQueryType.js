"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var SarpQueryType;

(function (SarpQueryType) {
  SarpQueryType[SarpQueryType["ByType"] = 1] = "ByType";
  SarpQueryType[SarpQueryType["ByNet"] = 2] = "ByNet";
  SarpQueryType[SarpQueryType["ByGrpup"] = 3] = "ByGrpup";
  SarpQueryType[SarpQueryType["All"] = 4] = "All";
})(SarpQueryType || (SarpQueryType = {}));

var _default = SarpQueryType;
exports.default = _default;