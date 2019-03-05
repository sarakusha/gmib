"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _tableLayout = _interopRequireDefault(require("table-layout"));

var _debug = _interopRequireDefault(require("debug"));

var _const = require("../service/const");

var _ipc = require("../ipc");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// @ts-ignore
// import { Socket, connect } from 'net';
// import service, { detector } from '../service';
// import { IKnownPort } from '../service/detector';
const debug = (0, _debug.default)('nibus:list');
const list = {
  command: 'list',
  describe: 'Показать список доступных устройств',
  builder: {},
  handler: async () => new Promise((resolve, reject) => {
    const socket = _ipc.Client.connect(_const.PATH);

    let closed = false;
    let resolved = false;
    socket.once('close', () => {
      // debug('close event');
      if (!closed) {
        closed = true;
        resolved || reject();
      }
    });
    socket.on('ports', ports => {
      // debug('ports', ports);
      const rows = _lodash.default.sortBy(ports, [_lodash.default.property('description.category')]).map(({
        portInfo: {
          manufacturer,
          category,
          device,
          comName
        }
      }) => ({
        manufacturer,
        category,
        device,
        comName
      }));

      const table = new _tableLayout.default(rows, {
        maxWidth: 80
      });
      console.info(table.toString());
      resolved = true;
      resolve();
      socket.destroy();
    });
    socket.on('error', err => {
      debug('<error>', err);
    });
  }) // const rows = _.sortBy<IKnownPort>(ports, [_.property('manufacturer'),
  // _.property('category')]) .map(({ manufacturer, category, device, comName }) => ({
  // manufacturer, category, device, comName, })); const table = new Table(rows, { maxWidth: 80
  // }); console.info(table.toString());

};
var _default = list;
exports.default = _default;