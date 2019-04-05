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

require("source-map-support/register");

var _Address = _interopRequireDefault(require("../Address"));

var _SarpDatagram = _interopRequireWildcard(require("./SarpDatagram"));

var _SarpQueryType = _interopRequireDefault(require("./SarpQueryType"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
 * @license
 * Copyright (c) 2019. OOO Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
function createSarp(queryType, queryParam = Buffer.alloc(5)) {
  const param = Buffer.isBuffer(queryParam) ? queryParam : Buffer.from(queryParam);
  return new _SarpDatagram.default({
    queryType,
    destination: _Address.default.broadcast,
    queryParam: param
  });
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zYXJwL2luZGV4LnRzIl0sIm5hbWVzIjpbImNyZWF0ZVNhcnAiLCJxdWVyeVR5cGUiLCJxdWVyeVBhcmFtIiwiQnVmZmVyIiwiYWxsb2MiLCJwYXJhbSIsImlzQnVmZmVyIiwiZnJvbSIsIlNhcnBEYXRhZ3JhbSIsImRlc3RpbmF0aW9uIiwiQWRkcmVzcyIsImJyb2FkY2FzdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBVUE7O0FBQ0E7O0FBQ0E7Ozs7OztBQVpBOzs7Ozs7Ozs7QUFpQk8sU0FBU0EsVUFBVCxDQUNMQyxTQURLLEVBQ3FCQyxVQUEwQyxHQUFHQyxNQUFNLENBQUNDLEtBQVAsQ0FBYSxDQUFiLENBRGxFLEVBQ21GO0FBQ3hGLFFBQU1DLEtBQWEsR0FBR0YsTUFBTSxDQUFDRyxRQUFQLENBQWdCSixVQUFoQixJQUNsQkEsVUFEa0IsR0FFbEJDLE1BQU0sQ0FBQ0ksSUFBUCxDQUF1QkwsVUFBdkIsQ0FGSjtBQUdBLFNBQU8sSUFBSU0scUJBQUosQ0FBaUI7QUFDdEJQLElBQUFBLFNBRHNCO0FBRXRCUSxJQUFBQSxXQUFXLEVBQUVDLGlCQUFRQyxTQUZDO0FBR3RCVCxJQUFBQSxVQUFVLEVBQUVHO0FBSFUsR0FBakIsQ0FBUDtBQUtEIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTkuIE9PTyBOYXRhLUluZm9cbiAqIEBhdXRob3IgQW5kcmVpIFNhcmFrZWV2IDxhdnNAbmF0YS1pbmZvLnJ1PlxuICpcbiAqIFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBcIkBuYXRhXCIgcHJvamVjdC5cbiAqIEZvciB0aGUgZnVsbCBjb3B5cmlnaHQgYW5kIGxpY2Vuc2UgaW5mb3JtYXRpb24sIHBsZWFzZSB2aWV3XG4gKiB0aGUgRVVMQSBmaWxlIHRoYXQgd2FzIGRpc3RyaWJ1dGVkIHdpdGggdGhpcyBzb3VyY2UgY29kZS5cbiAqL1xuXG5pbXBvcnQgQWRkcmVzcyBmcm9tICcuLi9BZGRyZXNzJztcbmltcG9ydCBTYXJwRGF0YWdyYW0sIHsgSVNhcnBPcHRpb25zIH0gZnJvbSAnLi9TYXJwRGF0YWdyYW0nO1xuaW1wb3J0IFNhcnBRdWVyeVR5cGUgZnJvbSAnLi9TYXJwUXVlcnlUeXBlJztcblxuZXhwb3J0IHsgU2FycFF1ZXJ5VHlwZSB9O1xuZXhwb3J0IHsgU2FycERhdGFncmFtLCBJU2FycE9wdGlvbnMgfTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNhcnAoXG4gIHF1ZXJ5VHlwZTogU2FycFF1ZXJ5VHlwZSwgcXVlcnlQYXJhbTogQnVmZmVyIHwgVWludDhBcnJheSB8IG51bWJlcltdID0gQnVmZmVyLmFsbG9jKDUpKSB7XG4gIGNvbnN0IHBhcmFtOiBCdWZmZXIgPSBCdWZmZXIuaXNCdWZmZXIocXVlcnlQYXJhbSlcbiAgICA/IHF1ZXJ5UGFyYW1cbiAgICA6IEJ1ZmZlci5mcm9tKDxudW1iZXJbXT4ocXVlcnlQYXJhbSkpO1xuICByZXR1cm4gbmV3IFNhcnBEYXRhZ3JhbSh7XG4gICAgcXVlcnlUeXBlLFxuICAgIGRlc3RpbmF0aW9uOiBBZGRyZXNzLmJyb2FkY2FzdCxcbiAgICBxdWVyeVBhcmFtOiBwYXJhbSxcbiAgfSk7XG59XG4iXX0=