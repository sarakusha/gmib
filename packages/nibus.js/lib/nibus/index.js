"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "NibusDatagram", {
  enumerable: true,
  get: function () {
    return _NibusDatagram.default;
  }
});
Object.defineProperty(exports, "INibusOptions", {
  enumerable: true,
  get: function () {
    return _NibusDatagram.INibusOptions;
  }
});
Object.defineProperty(exports, "INibusCommon", {
  enumerable: true,
  get: function () {
    return _NibusDatagram.INibusCommon;
  }
});
Object.defineProperty(exports, "NibusConnection", {
  enumerable: true,
  get: function () {
    return _NibusConnection.default;
  }
});
Object.defineProperty(exports, "NibusBaudRate", {
  enumerable: true,
  get: function () {
    return _NibusConnection.NibusBaudRate;
  }
});

var _NibusDatagram = _interopRequireWildcard(require("./NibusDatagram"));

var _NibusConnection = _interopRequireWildcard(require("./NibusConnection"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }