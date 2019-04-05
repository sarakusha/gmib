"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

require("source-map-support/register");

/*
 * @license
 * Copyright (c) 2019. OOO Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ubXMvTm1zVmFsdWVUeXBlLnRzIl0sIm5hbWVzIjpbIk5tc1ZhbHVlVHlwZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUE7Ozs7Ozs7OztJQVVLQSxZOztXQUFBQSxZO0FBQUFBLEVBQUFBLFksQ0FBQUEsWTtBQUFBQSxFQUFBQSxZLENBQUFBLFk7QUFBQUEsRUFBQUEsWSxDQUFBQSxZO0FBQUFBLEVBQUFBLFksQ0FBQUEsWTtBQUFBQSxFQUFBQSxZLENBQUFBLFk7QUFBQUEsRUFBQUEsWSxDQUFBQSxZO0FBQUFBLEVBQUFBLFksQ0FBQUEsWTtBQUFBQSxFQUFBQSxZLENBQUFBLFk7QUFBQUEsRUFBQUEsWSxDQUFBQSxZO0FBQUFBLEVBQUFBLFksQ0FBQUEsWTtBQUFBQSxFQUFBQSxZLENBQUFBLFk7QUFBQUEsRUFBQUEsWSxDQUFBQSxZO0FBQUFBLEVBQUFBLFksQ0FBQUEsWTtBQUFBQSxFQUFBQSxZLENBQUFBLFk7QUFBQUEsRUFBQUEsWSxDQUFBQSxZO0FBQUFBLEVBQUFBLFksQ0FBQUEsWTtBQUFBQSxFQUFBQSxZLENBQUFBLFk7QUFBQUEsRUFBQUEsWSxDQUFBQSxZO0FBQUFBLEVBQUFBLFksQ0FBQUEsWTtBQUFBQSxFQUFBQSxZLENBQUFBLFk7QUFBQUEsRUFBQUEsWSxDQUFBQSxZO0FBQUFBLEVBQUFBLFksQ0FBQUEsWTtBQUFBQSxFQUFBQSxZLENBQUFBLFk7QUFBQUEsRUFBQUEsWSxDQUFBQSxZO0FBQUFBLEVBQUFBLFksQ0FBQUEsWTtBQUFBQSxFQUFBQSxZLENBQUFBLFk7R0FBQUEsWSxLQUFBQSxZOztlQTZCVUEsWSIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IChjKSAyMDE5LiBPT08gTmF0YS1JbmZvXG4gKiBAYXV0aG9yIEFuZHJlaSBTYXJha2VldiA8YXZzQG5hdGEtaW5mby5ydT5cbiAqXG4gKiBUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgXCJAbmF0YVwiIHByb2plY3QuXG4gKiBGb3IgdGhlIGZ1bGwgY29weXJpZ2h0IGFuZCBsaWNlbnNlIGluZm9ybWF0aW9uLCBwbGVhc2Ugdmlld1xuICogdGhlIEVVTEEgZmlsZSB0aGF0IHdhcyBkaXN0cmlidXRlZCB3aXRoIHRoaXMgc291cmNlIGNvZGUuXG4gKi9cblxuZW51bSBObXNWYWx1ZVR5cGUge1xuICBVbmtub3duID0gMCxcbiAgQm9vbGVhbiA9IDExLFxuICBJbnQ4ID0gMTYsXG4gIEludDE2ID0gMixcbiAgSW50MzIgPSAzLFxuICBJbnQ2NCA9IDIwLFxuICBVSW50OCA9IDE3LFxuICBVSW50MTYgPSAxOCxcbiAgVUludDMyID0gMTksXG4gIFVJbnQ2NCA9IDIxLFxuICBSZWFsMzIgPSA0LFxuICBSZWFsNjQgPSA1LFxuICBTdHJpbmcgPSAzMCxcbiAgRGF0ZVRpbWUgPSA3LFxuICBBcnJheSA9IDB4ODAsXG4gIEJvb2xlYW5BcnJheSA9IEJvb2xlYW4gfCBBcnJheSxcbiAgSW50OEFycmF5ID0gSW50OCB8IEFycmF5LFxuICBJbnQxNkFycmF5ID0gSW50MTYgfCBBcnJheSxcbiAgSW50MzJBcnJheSA9IEludDMyIHwgQXJyYXksXG4gIEludDY0QXJyYXkgPSBJbnQ2NCB8IEFycmF5LFxuICBVSW50OEFycmF5ID0gVUludDggfCBBcnJheSxcbiAgVUludDE2QXJyYXkgPSBVSW50MTYgfCBBcnJheSxcbiAgVUludDMyQXJyYXkgPSBVSW50MzIgfCBBcnJheSxcbiAgVUludDY0QXJyYXkgPSBVSW50NjQgfCBBcnJheSxcbiAgUmVhbDMyQXJyYXkgPSBSZWFsMzIgfCBBcnJheSxcbiAgUmVhbDY0QXJyYXkgPSBSZWFsNjQgfCBBcnJheSxcbn1cblxuZXhwb3J0IGRlZmF1bHQgTm1zVmFsdWVUeXBlO1xuIl19