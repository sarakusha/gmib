import SerialPort, { OpenOptions } from 'serialport';
import debugFactory from 'debug';
import { EventEmitter } from 'events';
import { IKnownPort } from '../service/KnownPorts';
import Server from './Server';
import { IMibDescription } from '../service';

const debug = debugFactory('nibus:serial-tee');
const portOptions: OpenOptions = {
  baudRate: 115200,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
};

export default class SerialTee extends EventEmitter {
  private readonly serial: SerialPort;
  private closed = false;
  private readonly server: Server;

  static getSocketPath(path: string) {
    return `/tmp/nibus.${path.replace(/^(\/dev\/)/, '')}`;
  }

  constructor(public readonly portInfo: IKnownPort, public readonly description: IMibDescription) {
    super();
    const { comName: path } = portInfo;
    this.serial = new SerialPort(
      path,
      {
        ...portOptions,
        baudRate: description.baudRate || 115200,
      },
    );
    this.serial.on('close', this.close);
    this.server = new Server(SerialTee.getSocketPath(path), true);
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

  toJSON() {
    const { portInfo, description } = this;
    return {
      portInfo,
      description,
    };
  }
}
