"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _service = _interopRequireDefault(require("../service"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const ping = {
  command: 'ping',
  describe: 'ping device',
  builder: {},
  handler: async argv => {
    await _service.default.start();
    const timeout = await _service.default.ping(argv.mac);
    console.info(timeout);

    _service.default.close();
  }
};
var _default = ping;
exports.default = _default;