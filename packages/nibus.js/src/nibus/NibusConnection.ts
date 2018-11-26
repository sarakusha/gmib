import _ from 'lodash';
import SerialPort, { OpenOptions } from 'serialport';
import { EventEmitter } from 'events';
import debugFactory from 'debug';
import { TimeoutError } from '../errors';
import { NmsDatagram } from '../nms';
import NmsServiceType from '../nms/NmsServiceType';
import { createSarp, SarpQueryType, SarpDatagram } from '../sarp';
import { IMibDescription } from '../service';
import NibusDatagram from './NibusDatagram';
import NibusEncoder from './NibusEncoder';
import NibusDecoder from './NibusDecoder';

export const MINIHOST_TYPE = 0xabc6;

const debug = debugFactory('nibus:connection');
const portOptions: OpenOptions = {
  baudRate: 115200,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
};

export type NibusBaudRate = 115200 | 57600 | 28800;

const NIBUS_TIMEOUT = 1000;

class WaitedNmsDatagram {
  readonly resolve: (datagram: NmsDatagram) => void;

  constructor(
    public readonly req: NmsDatagram,
    resolve: (datagram: NmsDatagram|NmsDatagram[]) => void,
    reject: (reason: Error) => void,
    callback: (self: WaitedNmsDatagram) => void) {
    let timer: NodeJS.Timer;
    let counter: number = req.service !== NmsServiceType.Read
      ? 1
      : Math.floor(req.nms.length / 3) + 1;
    const datagrams: NmsDatagram[] = [];
    const timeout = () => {
      callback(this);
      datagrams.length === 0 ? reject(new TimeoutError()) : resolve(datagrams);
    };
    const restart = (step = 1) => {
      counter -= step;
      clearTimeout(timer);
      if (counter > 0) {
        timer = setTimeout(timeout, NIBUS_TIMEOUT);
      } else if (counter === 0) {
        callback(this);
      }
      return counter === 0;
    };
    restart(0);
    this.resolve = (datagram: NmsDatagram) => {
      datagrams.push(datagram);
      if (restart()) {
        resolve(datagrams.length > 1 ? datagrams : datagram);
      }
    };
  }
}

/**
 * @fires sarp
 * @fires data
 */
export default class NibusConnection extends EventEmitter {
  private readonly serial: SerialPort;
  private readonly encoder = new NibusEncoder();
  private readonly decoder = new NibusDecoder();
  private ready = Promise.resolve();
  private closed = false;
  private readonly waited: WaitedNmsDatagram[] = [];

  private stopWaiting = (waited: WaitedNmsDatagram) => _.remove(this.waited, waited);

  private onDatagram(datagram: NibusDatagram) {
    let showLog = true;
    if (datagram instanceof NmsDatagram) {
      if (datagram.isResponse) {
        const waited = this.waited.find(waited => datagram.isResponseFor(waited.req));
        if (waited) {
          waited.resolve(datagram);
          showLog = false;
        }
      }
      /**
       * @event NibusConnection#data
       * @param {NibusDatagram} datagram
       */
      this.emit('data', datagram);
    } else if (datagram instanceof SarpDatagram) {
      showLog = false;
      /**
       * @event NibusConnection#sarp
       * @param {SarpDatagram} datagram
       */
      this.emit('sarp', datagram);
    }
    showLog && debug(`datagram received`, JSON.stringify(datagram.toJSON()));
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

  public sendDatagram(datagram: NibusDatagram): Promise<NmsDatagram | NmsDatagram[] | undefined> {
    // debug('write datagram', JSON.stringify(datagram.toJSON()));
    const { encoder, stopWaiting, waited, closed } = this;
    return new Promise((resolve, reject) => {
      this.ready = this.ready.finally(async () => {
        if (closed) return reject(new Error('Closed'));
        if (!this.serial.isOpen) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(reject, 2000);
            this.serial.once('open', () => {
              clearTimeout(timeout);
              resolve();
            });
          });
        }
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

  public findByType(type: number = MINIHOST_TYPE) {
    const sarp = createSarp(SarpQueryType.ByType, [0, 0, 0, (type >> 8) & 0xFF, type & 0xFF]);
    return this.sendDatagram(sarp);
  }

  public close(callback?: (err?: Error) => void) {
    const { port, description } = this;
    debug(`close connection on ${port} (${description.category})`);
    this.closed = true;
    this.encoder.end();
    this.decoder.removeAllListeners('data');
    if (this.serial.isOpen) {
      this.serial.close(callback);
    } else {
      callback && callback();
    }
  }
}
