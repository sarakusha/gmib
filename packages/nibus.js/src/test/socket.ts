import net, { Socket, Server } from 'net';
import xpipe from 'xpipe';

const path = xpipe.eq('/tmp/nibus.sock');
const sockets: Socket[] = [];

const server: Server = net.createServer((socket) => {
  sockets.push(socket);
});

server.on('error', (err) => {
  throw err;
});

server.listen(path, () => {
  console.log('server listen on', server.address());
});

const clients: Socket[] = [];

for (let i = 0; i < 5; i += 1) {
  clients.push(
    net
      .connect(path, () => {
        console.log('connected', i);
      })
      .on('close', () => {
        console.log('closed', i);
      })
      .on('data', (data) => {
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
