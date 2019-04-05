"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ConfigV = exports.PATH = void 0;

require("source-map-support/register");

var t = _interopRequireWildcard(require("io-ts"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

/*
 * @license
 * Copyright (c) 2019. OOO Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXNzaW9uL2NvbW1vbi50cyJdLCJuYW1lcyI6WyJQQVRIIiwiTG9nTGV2ZWxWIiwidCIsImtleW9mIiwibm9uZSIsImhleCIsIm5pYnVzIiwiTWliVHlwZVYiLCJhcnJheSIsImludGVyc2VjdGlvbiIsInR5cGUiLCJtaWIiLCJzdHJpbmciLCJwYXJ0aWFsIiwibWluVmVyc2lvbiIsIm51bWJlciIsIkNvbmZpZ1YiLCJsb2dMZXZlbCIsIm9taXQiLCJ1bmlvbiIsIm51bGwiLCJwaWNrIiwibWlicyIsIm1pYlR5cGVzIiwicmVjb3JkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFXQTs7OztBQVhBOzs7Ozs7Ozs7O0FBVUE7QUFFTyxNQUFNQSxJQUFJLEdBQUcseUJBQWI7O0FBRVAsTUFBTUMsU0FBUyxHQUFHQyxDQUFDLENBQUNDLEtBQUYsQ0FBUTtBQUN4QkMsRUFBQUEsSUFBSSxFQUFFLElBRGtCO0FBRXhCQyxFQUFBQSxHQUFHLEVBQUUsSUFGbUI7QUFHeEJDLEVBQUFBLEtBQUssRUFBRTtBQUhpQixDQUFSLENBQWxCO0FBTUEsTUFBTUMsUUFBUSxHQUFHTCxDQUFDLENBQUNNLEtBQUYsQ0FBUU4sQ0FBQyxDQUFDTyxZQUFGLENBQWUsQ0FDdENQLENBQUMsQ0FBQ1EsSUFBRixDQUFPO0FBQUVDLEVBQUFBLEdBQUcsRUFBRVQsQ0FBQyxDQUFDVTtBQUFULENBQVAsQ0FEc0MsRUFFdENWLENBQUMsQ0FBQ1csT0FBRixDQUFVO0FBQUVDLEVBQUFBLFVBQVUsRUFBRVosQ0FBQyxDQUFDYTtBQUFoQixDQUFWLENBRnNDLENBQWYsQ0FBUixDQUFqQjtBQUtPLE1BQU1DLE9BQU8sR0FBR2QsQ0FBQyxDQUFDVyxPQUFGLENBQVU7QUFDL0JJLEVBQUFBLFFBQVEsRUFBRWhCLFNBRHFCO0FBRS9CaUIsRUFBQUEsSUFBSSxFQUFFaEIsQ0FBQyxDQUFDaUIsS0FBRixDQUFRLENBQUNqQixDQUFDLENBQUNNLEtBQUYsQ0FBUU4sQ0FBQyxDQUFDVSxNQUFWLENBQUQsRUFBb0JWLENBQUMsQ0FBQ2tCLElBQXRCLENBQVIsQ0FGeUI7QUFHL0JDLEVBQUFBLElBQUksRUFBRW5CLENBQUMsQ0FBQ2lCLEtBQUYsQ0FBUSxDQUFDakIsQ0FBQyxDQUFDTSxLQUFGLENBQVFOLENBQUMsQ0FBQ1UsTUFBVixDQUFELEVBQW9CVixDQUFDLENBQUNrQixJQUF0QixDQUFSLENBSHlCO0FBSS9CRSxFQUFBQSxJQUFJLEVBQUVwQixDQUFDLENBQUNNLEtBQUYsQ0FBUU4sQ0FBQyxDQUFDVSxNQUFWLENBSnlCO0FBSy9CVyxFQUFBQSxRQUFRLEVBQUVyQixDQUFDLENBQUNzQixNQUFGLENBQVN0QixDQUFDLENBQUNVLE1BQVgsRUFBbUJMLFFBQW5CO0FBTHFCLENBQVYsQ0FBaEIsQyxDQVFQIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTkuIE9PTyBOYXRhLUluZm9cbiAqIEBhdXRob3IgQW5kcmVpIFNhcmFrZWV2IDxhdnNAbmF0YS1pbmZvLnJ1PlxuICpcbiAqIFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBcIkBuYXRhXCIgcHJvamVjdC5cbiAqIEZvciB0aGUgZnVsbCBjb3B5cmlnaHQgYW5kIGxpY2Vuc2UgaW5mb3JtYXRpb24sIHBsZWFzZSB2aWV3XG4gKiB0aGUgRVVMQSBmaWxlIHRoYXQgd2FzIGRpc3RyaWJ1dGVkIHdpdGggdGhpcyBzb3VyY2UgY29kZS5cbiAqL1xuXG4vKiB0c2xpbnQ6ZGlzYWJsZTp2YXJpYWJsZS1uYW1lICovXG5pbXBvcnQgKiBhcyB0IGZyb20gJ2lvLXRzJztcbmV4cG9ydCBjb25zdCBQQVRIID0gJy90bXAvbmlidXMuc2VydmljZS5zb2NrJztcblxuY29uc3QgTG9nTGV2ZWxWID0gdC5rZXlvZih7XG4gIG5vbmU6IG51bGwsXG4gIGhleDogbnVsbCxcbiAgbmlidXM6IG51bGwsXG59KTtcblxuY29uc3QgTWliVHlwZVYgPSB0LmFycmF5KHQuaW50ZXJzZWN0aW9uKFtcbiAgdC50eXBlKHsgbWliOiB0LnN0cmluZyB9KSxcbiAgdC5wYXJ0aWFsKHsgbWluVmVyc2lvbjogdC5udW1iZXIgfSksXG5dKSk7XG5cbmV4cG9ydCBjb25zdCBDb25maWdWID0gdC5wYXJ0aWFsKHtcbiAgbG9nTGV2ZWw6IExvZ0xldmVsVixcbiAgb21pdDogdC51bmlvbihbdC5hcnJheSh0LnN0cmluZyksIHQubnVsbF0pLFxuICBwaWNrOiB0LnVuaW9uKFt0LmFycmF5KHQuc3RyaW5nKSwgdC5udWxsXSksXG4gIG1pYnM6IHQuYXJyYXkodC5zdHJpbmcpLFxuICBtaWJUeXBlczogdC5yZWNvcmQodC5zdHJpbmcsIE1pYlR5cGVWKSxcbn0pO1xuXG4vLyB0eXBlIE1pYlR5cGUgPSB0LlR5cGVPZjx0eXBlb2YgTWliVHlwZVY+O1xuZXhwb3J0IHR5cGUgQ29uZmlnID0gdC5UeXBlT2Y8dHlwZW9mIENvbmZpZ1Y+O1xuXG5leHBvcnQgdHlwZSBMb2dMZXZlbCA9IHQuVHlwZU9mPHR5cGVvZiBMb2dMZXZlbFY+O1xuIl19