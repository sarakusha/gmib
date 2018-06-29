import _ from 'lodash';
import SerialPort, { OpenOptions } from 'serialport';
import { EventEmitter } from 'events';
import debugFactory from 'debug';
import { TimeoutError } from '../errors';
import { NmsDatagram } from '../nms';
import { SarpDatagram } from '../sarp';
import { IMibDescription } from '../service';
import NibusDatagram from './NibusDatagram';
import NibusEncoder from './NibusEncoder';
import NibusDecoder from './NibusDecoder';

const debug = debugFactory('nibus:connection');
const portOptions: OpenOptions = {
  baudRate: 115200,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
};

export type NibusBaudRate = 115200 | 57600;

const NIBUS_TIMEOUT = 1000;

class WaitedNmsDatagram {
  readonly resolve: (datagram?: NmsDatagram) => void;
  readonly reject: (reason: Error) => void;

  constructor(
    public readonly req: NmsDatagram,
    resolve: (datagram?: NmsDatagram) => void,
    reject: (reason: Error) => void,
    callback: (self: WaitedNmsDatagram) => void) {
    const timer = setTimeout(() => this.reject(new TimeoutError()), NIBUS_TIMEOUT);
    const stop = () => {
      clearTimeout(timer);
      callback(this);
    };
    this.resolve = (datagram?: NmsDatagram) => {
      stop();
      resolve(datagram);
    };
    this.reject = (reason) => {
      stop();
      reject(reason);
    };
  }
}

export default class NibusConnection extends EventEmitter {
  private readonly serial: SerialPort;
  private readonly encoder = new NibusEncoder();
  private readonly decoder = new NibusDecoder();
  private ready = Promise.resolve();
  private closed = false;
  private readonly waited: WaitedNmsDatagram[] = [];

  private stopWaiting = (waited: WaitedNmsDatagram) => _.remove(this.waited, waited);

  private onDatagram(datagram: NibusDatagram) {
    if (datagram instanceof NmsDatagram && datagram.isResponse) {
      const waited = this.waited.find(waited => datagram.isResponseFor(waited.req));
      if (waited) {
        return waited.resolve(datagram);
      }
    }
    if (datagram instanceof SarpDatagram) {
      return this.emit('sarp', datagram);
    }
    this.emit('data', datagram);
  }

  constructor(public readonly port: string, public readonly description: IMibDescription) {
    super();
    this.serial = new SerialPort(
      port,
      {
        ...portOptions,
        baudRate: description.baudRate || 115200,
      },
    );
    this.serial.pipe(this.decoder);
    this.encoder.pipe(this.serial);
    this.decoder.on('data', this.onDatagram.bind(this));
    debug(`new connection on ${port} (${description.category})`);
  }

  public sendDatagram(datagram: NibusDatagram): Promise<NmsDatagram | undefined> {
    const { encoder, stopWaiting, waited, closed } = this;
    return new Promise((resolve, reject) => {
      this.ready = this.ready.finally(async () => {
        if (closed) return reject(new Error('Closed'));
        if (!encoder.write(datagram)) {
          await new Promise(cb => encoder.once('drain', cb));
        }
        if (!(datagram instanceof NmsDatagram) || !datagram.isResponsible) {
          return resolve();
        }
        waited.push(new WaitedNmsDatagram(
          datagram,
          resolve,
          reject,
          stopWaiting,
        ));
      });
    });
  }

  public close(callback?: (err?: Error) => void) {
    const { port, description } = this;
    debug(`close connection on ${port} (${description.category})`);
    this.closed = true;
    this.encoder.end();
    this.decoder.removeAllListeners('data');
    this.serial.isOpen && this.serial.close(callback);
  }
}
