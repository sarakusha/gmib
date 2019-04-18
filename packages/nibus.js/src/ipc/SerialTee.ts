/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import SerialPort, { OpenOptions } from 'serialport';
import debugFactory from 'debug';
import { EventEmitter } from 'events';
import { ipc } from '@nata/nibus.js-client/';
import Server, { Direction } from './Server';
import { IKnownPort } from '@nata/nibus.js-client/lib/session';
import { IMibDescription } from '@nata/nibus.js-client/lib/MibDescription';

const debug = debugFactory('nibus:serial-tee');
const portOptions: OpenOptions = {
  baudRate: 115200,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
};

export interface SerialLogger {
  (data: Buffer, dir: Direction): void;
}

// declare module serialport {
//   interface SerialPort {
//     write(
//       data: string | Uint8Array | Buffer,
//       callback?: (error: any, bytesWritten: number) => void): boolean;
//     write(
//       buffer: string | Uint8Array | Buffer,
//       encoding?: 'ascii' | 'utf8' | 'utf16le' | 'ucs2' | 'base64' | 'binary' | 'hex',
//       callback?: (error: any, bytesWritten: number) => void): boolean;
//     test: () => void;
//   }
// }

export default class SerialTee extends EventEmitter {
  private readonly serial: SerialPort;
  private closed = false;
  private readonly server: Server;
  private logger: SerialLogger | null = null;

  constructor(public readonly portInfo: IKnownPort, public readonly description: IMibDescription) {
    super();
    const { comName: path } = portInfo;
    this.serial = new SerialPort(
      path,
      {
        ...portOptions,
        baudRate: description.baudRate || 115200,
        parity: description.parity || portOptions.parity,
      },
    );
    this.serial.on('close', this.close);
    this.server = new Server(ipc.getSocketPath(path), true);
    this.server.pipe(this.serial);
    this.serial.pipe(this.server);
    debug(`new connection on ${path} (${description.category})`);
  }

  public get path() {
    return this.server.path;
  }

  public close = () => {
    if (this.closed) return;
    const { serial, server } = this;
    if (serial.isOpen) {
      debug('close serial', serial.path);
      serial.close();
    }
    server.close();
    this.closed = true;
    this.emit('close', this.portInfo.comName);
  };

  public setLogger(logger: SerialLogger | null) {
    if (this.logger) {
      this.server.off('raw', this.logger);
    }
    this.logger = logger;
    if (this.logger) {
      this.server.on('raw', this.logger);
    }
  }

  toJSON() {
    const { portInfo, description } = this;
    return {
      portInfo,
      description,
    };
  }
}
