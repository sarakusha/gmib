"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _mib = require("../../mib");

var _service = _interopRequireDefault(require("../../service"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const test = {
  command: 'test',
  describe: 'Test',
  builder: {},
  handler: async () => new Promise(async resolve => {
    await _service.default.start();

    const minihost = _mib.devices.create('::78:54');

    _service.default.on('connected', device => {
      _service.default.close(); // const versionId = minihost.getId('version');
      // minihost.read(versionId)
      //   .then((value) => {
      //     console.log('read', value);
      //   }, (reason) => {
      //     console.error('cannot read <error>', reason);
      //   })
      //   .finally(() => {
      //     session.close();
      //     resolve();
      //   });

    });
  })
};
var _default = test;
exports.default = _default;