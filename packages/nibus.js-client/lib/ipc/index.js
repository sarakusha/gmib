"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getSocketPath = getSocketPath;
Object.defineProperty(exports, "Client", {
  enumerable: true,
  get: function () {
    return _Client.default;
  }
});
Object.defineProperty(exports, "IPortArg", {
  enumerable: true,
  get: function () {
    return _events.IPortArg;
  }
});

require("source-map-support/register");

var _Client = _interopRequireDefault(require("./Client"));

var _events = require("./events");

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
function getSocketPath(path) {
  return `/tmp/nibus.${path.replace(/^(\/dev\/)/, '')}`;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pcGMvaW5kZXgudHMiXSwibmFtZXMiOlsiZ2V0U29ja2V0UGF0aCIsInBhdGgiLCJyZXBsYWNlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFVQTs7QUFDQTs7OztBQVhBOzs7Ozs7Ozs7QUFhTyxTQUFTQSxhQUFULENBQXVCQyxJQUF2QixFQUFxQztBQUMxQyxTQUFRLGNBQWFBLElBQUksQ0FBQ0MsT0FBTCxDQUFhLFlBQWIsRUFBMkIsRUFBM0IsQ0FBK0IsRUFBcEQ7QUFDRCIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IChjKSAyMDE5LiBPT08gTmF0YS1JbmZvXG4gKiBAYXV0aG9yIEFuZHJlaSBTYXJha2VldiA8YXZzQG5hdGEtaW5mby5ydT5cbiAqXG4gKiBUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgXCJAbmF0YVwiIHByb2plY3QuXG4gKiBGb3IgdGhlIGZ1bGwgY29weXJpZ2h0IGFuZCBsaWNlbnNlIGluZm9ybWF0aW9uLCBwbGVhc2Ugdmlld1xuICogdGhlIEVVTEEgZmlsZSB0aGF0IHdhcyBkaXN0cmlidXRlZCB3aXRoIHRoaXMgc291cmNlIGNvZGUuXG4gKi9cblxuZXhwb3J0IHsgZGVmYXVsdCBhcyBDbGllbnQgIH0gZnJvbSAnLi9DbGllbnQnO1xuZXhwb3J0IHsgSVBvcnRBcmcgfSBmcm9tICcuL2V2ZW50cyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTb2NrZXRQYXRoKHBhdGg6IHN0cmluZykge1xuICByZXR1cm4gYC90bXAvbmlidXMuJHtwYXRoLnJlcGxhY2UoL14oXFwvZGV2XFwvKS8sICcnKX1gO1xufVxuIl19