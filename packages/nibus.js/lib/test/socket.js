"use strict";

var _net = _interopRequireDefault(require("net"));

var _xpipe = _interopRequireDefault(require("xpipe"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const path = _xpipe.default.eq('/tmp/nibus.sock');

const sockets = [];

const server = _net.default.createServer(socket => {
  sockets.push(socket);
});

server.on('error', err => {
  throw err;
});
server.listen(path, () => {
  console.log('server listen on', server.address());
});
const clients = [];

for (let i = 0; i < 5; i += 1) {
  clients.push(_net.default.connect(path, () => {
    console.log('connected', i);
  }).on('close', () => {
    console.log('closed', i);
  }).on('data', data => {
    console.log(`data ${i}: ${data.toString()}`);
  }));
}

setTimeout(() => {
  sockets.forEach((socket, i) => socket.write(`hello ${i}`));
}, 1000);
setTimeout(() => {
  server.close();
  sockets.forEach(socket => socket.destroy());
  console.log('CLOSE');
}, 3000);