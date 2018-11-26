"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createSarp = createSarp;
Object.defineProperty(exports, "SarpDatagram", {
  enumerable: true,
  get: function () {
    return _SarpDatagram.default;
  }
});
Object.defineProperty(exports, "ISarpOptions", {
  enumerable: true,
  get: function () {
    return _SarpDatagram.ISarpOptions;
  }
});
Object.defineProperty(exports, "SarpQueryType", {
  enumerable: true,
  get: function () {
    return _SarpQueryType.default;
  }
});

var _Address = _interopRequireDefault(require("../Address"));

var _SarpDatagram = _interopRequireWildcard(require("./SarpDatagram"));

var _SarpQueryType = _interopRequireDefault(require("./SarpQueryType"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function createSarp(queryType, queryParam = Buffer.alloc(5)) {
  const param = Buffer.isBuffer(queryParam) ? queryParam : Buffer.from(queryParam);
  return new _SarpDatagram.default({
    queryType,
    destination: _Address.default.broadcast,
    queryParam: param
  });
}