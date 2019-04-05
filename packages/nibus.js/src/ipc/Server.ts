/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import net, { Socket, Server } from 'net';
import { Duplex } from 'stream';
import debugFactory from 'debug';
import fs from 'fs';
import xpipe from 'xpipe';

const debug = debugFactory('nibus:IPCServer');
const noop = () => {};

export enum Direction {
  in,
  out,
}

interface IPCServer {
  on(event: 'connection', listener: (socket: Socket) => void): this;
  on(event: 'client:error', listener: (err: Error) => void): this;
  on(event: 'raw', listener: (data: Buffer, dir: Direction) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;

  once(event: 'connection', listener: (socket: Socket) => void): this;
  once(event: 'raw', listener: (data: Buffer, dir: Direction) => void): this;
  once(event: string | symbol, listener: (...args: any[]) => void): this;

  addListener(event: 'connection', listener: (socket: Socket) => void): this;
  addListener(event: 'client:error', listener: (err: Error) => void): this;
  addListener(event: 'raw', listener: (data: Buffer, dir: Direction) => void): this;
  addListener(event: string | symbol, listener: (...args: any[]) => void): this;

  emit(event: 'connection', socket: Socket): boolean;
  emit(event: 'client:error', err: Error): boolean;
  emit(event: 'raw', data: Buffer, dir: Direction): boolean;
  emit(event: string | symbol, ...args: any[]): boolean;
}

class IPCServer extends Duplex {
  private readonly server: Server;
  private readonly clients: Socket[];
  private closed = false;
  private reading = false;

  constructor(path: string, private readonly raw = false) {
    super();
    this.clients = [];
    this.server = new Server();
    this.server = net
      .createServer(this.connectionHandler)
      .on('error', this.errorHandler)
      .on('close', this.close)
      .listen(xpipe.eq(path), () => {
        debug('listening on', this.server.address());
      });
    process.on('SIGINT', () => this.close());
    process.on('SIGTERM', () => this.close());
  }

  private connectionHandler = (socket: Socket) => {
    this.emit('connection', socket);
    this.clients.push(socket);
    socket
      .once('error', this.clientErrorHandler.bind(this, socket))
      .on('data', this.clientDataHandler.bind(this, socket))
      .once('close', () => this.removeClient(socket));
    debug('new connection on', this.path, this.clients.length);
  };

  private errorHandler = (err: Error) => {
    if ((err as any).code === 'EADDRINUSE') {
      const check = net.connect(xpipe.eq(this.path), () => {
        debug('Server running, giving up...');
        process.exit();
      });
      check.once('error', (e) => {
        if ((e as any).code === 'ECONNREFUSED') {
          fs.unlinkSync(xpipe.eq(this.path));
          this.server.listen(xpipe.eq(this.path), () => {
            debug('restart', this.server.address());
          });
        }
      });
    } else {
      throw err;
    }
  };

  private clientErrorHandler(client: Socket, err: Error) {
    debug('error on client', err.message);
    this.emit('client:error', client, err);
    this.removeClient(client);
  }

  private clientDataHandler(client: Socket, data: Buffer) {
    // if (this.raie) {
    //   debug(this.path, printBuffer(data));
    // }
    if (this.reading) {
      this.reading = this.push(data);
    }
    if (this.raw)  {
      return this.emit('raw', data, Direction.in);
    }
    debug('data from', client.remoteAddress, data.toString());
    const { event, args } = JSON.parse(data.toString());
    this.emit(`client:${event}`, client, ...args);
  }

  private removeClient(client: Socket) {
    const index = this.clients.findIndex(item => item === client);
    if (index !== -1) {
      this.clients.splice(index, 1);
    }
    client.destroy();
    debug('destroy connection on', this.path, this.clients.length);
  }

  // tslint:disable-next-line:function-name
  _write(chunk: any, encoding: string, callback: (error?: (Error | null)) => void): void {
    this.emit('raw', chunk as Buffer, Direction.out);
    this.clients.forEach(client => client.write(chunk, encoding, noop));
    callback();
  }

  // tslint:disable-next-line:function-name
  _read(size: number): void {
    this.reading = true;
  }

  public get path() {
    return (this.server.address() || '').toString();
  }

  send(client: Socket, event: string, ...args: any[]): Promise<void> {
    if (this.closed) {
      return Promise.reject(new Error('Server is closed'));
    }
    const data = {
      event,
      args,
    };
    return new Promise(resolve => client.write(JSON.stringify(data), () => resolve()));
  }

  broadcast(event: string, ...args: any[]): Promise<void> {
    return Promise.all(this.clients.map(client => this.send(client, event, ...args)))
      .then(() => {});
  }

  close = () => {
    if (this.closed) return;
    const path = this.server.address();
    this.clients.forEach(client => client.destroy());
    this.clients.length = 0;
    this.server.close();
    this.raw && this.push(null);
    this.closed = true;
    debug(`${path} closed`);
  };
}

export default IPCServer;
