import { PathReporter } from 'io-ts/lib/PathReporter';
import _ from 'lodash';
import { Socket, connect } from 'net';
import xpipe from 'xpipe';
import { EventEmitter } from 'events';
import debugFactory from 'debug';
import { AddressParam } from '../Address';
import { TimeoutError } from '../errors';
import { SerialTee } from '../ipc';
// import { devices } from '../mib';
import {
  createNmsRead,
  NmsDatagram,
} from '../nms';
import NmsServiceType from '../nms/NmsServiceType';
import { createSarp, SarpQueryType, SarpDatagram } from '../sarp';
import { IMibDescription } from '../service';
import { MibDescriptionV } from '../service/KnownPorts';
import NibusDatagram from './NibusDatagram';
import NibusEncoder from './NibusEncoder';
import NibusDecoder from './NibusDecoder';

export const MINIHOST_TYPE = 0xabc6;
const FIRMWARE_VERSION_ID = 0x85;
const VERSION_ID = 2;

const debug = debugFactory('nibus:connection');
let NIBUS_TIMEOUT = 1000;

export const setNibusTimeout = (timeout: number) => {
  NIBUS_TIMEOUT = timeout;
};

export const getNibusTimeout = () => NIBUS_TIMEOUT;

class WaitedNmsDatagram {
  readonly resolve: (datagram: NmsDatagram) => void;

  constructor(
    public readonly req: NmsDatagram,
    resolve: (datagram: NmsDatagram | NmsDatagram[]) => void,
    reject: (reason: Error) => void,
    callback: (self: WaitedNmsDatagram) => void) {
    let timer: NodeJS.Timer;
    let counter: number = req.service !== NmsServiceType.Read
      ? 1
      : Math.floor(req.nms.length / 3) + 1;
    const datagrams: NmsDatagram[] = [];
    const timeout = () => {
      callback(this);
      datagrams.length === 0
        ? reject(new TimeoutError(
        `Timeout error on ${req.destination} while ${NmsServiceType[req.service]}`))
        : resolve(datagrams);
    };
    const restart = (step = 1) => {
      counter -= step;
      clearTimeout(timer);
      if (counter > 0) {
        timer = setTimeout(timeout, req.service !== NmsServiceType.VerifyDomainChecksum
          ? NIBUS_TIMEOUT
          : NIBUS_TIMEOUT * 5);
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

type SarpListner = (datagram: SarpDatagram) => void;
type NmsListener = (datagram: NmsDatagram) => void;

declare interface NibusConnection {
  on(event: 'sarp', listener: SarpListner): this;

  on(event: 'nms', listener: NmsListener): this;

  once(event: 'sarp', listener: SarpListner): this;

  once(event: 'nms', listener: NmsListener): this;

  addListener(event: 'sarp', listener: SarpListner): this;

  addListener(event: 'nms', listener: NmsListener): this;
}

class NibusConnection extends EventEmitter {
  private readonly socket: Socket;
  private readonly encoder = new NibusEncoder();
  private readonly decoder = new NibusDecoder();
  private ready = Promise.resolve();
  private closed = false;
  private readonly waited: WaitedNmsDatagram[] = [];
  public readonly description: IMibDescription;

  private stopWaiting = (waited: WaitedNmsDatagram) => _.remove(this.waited, waited);

  private onDatagram = (datagram: NibusDatagram) => {
    let showLog = true;
    if (datagram instanceof NmsDatagram) {
      if (datagram.isResponse) {
        const resp = this.waited.find(item => datagram.isResponseFor(item.req));
        if (resp) {
          resp.resolve(datagram);
          showLog = false;
        }
      }
      this.emit('nms', datagram);
    } else if (datagram instanceof SarpDatagram) {
      this.emit('sarp', datagram);
      showLog = false;
    }
    showLog &&
    debug(`datagram received`, JSON.stringify(datagram.toJSON()));
  };

  constructor(public readonly path: string, description: IMibDescription) {
    super();
    const validate = MibDescriptionV.decode(description);
    if (validate.isLeft()) {
      const msg = PathReporter.report(validate).join('\n');
      debug('<error>', msg);
      throw new TypeError(msg);
    }
    this.description = validate.value;
    this.socket = connect(xpipe.eq(SerialTee.getSocketPath(path)));
    this.socket.pipe(this.decoder);
    this.encoder.pipe(this.socket);
    this.decoder.on('data', this.onDatagram);
    this.socket.once('close', this.close);
    debug(`new connection on ${path} (${description.category})`);
  }

  public sendDatagram(datagram: NibusDatagram): Promise<NmsDatagram | NmsDatagram[] | undefined> {
    // debug('write datagram from ', datagram.source.toString());
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

  public ping(address: AddressParam): Promise<number> {
    debug(`ping [${address.toString()}] ${this.path}`);
    const now = Date.now();
    return this.sendDatagram(createNmsRead(address, VERSION_ID))
      .then((datagram) => {
        return <number>(Reflect.getOwnMetadata('timeStamp', datagram!)) - now;
      })
      .catch(() => {
        // debug(`ping [${address}] failed ${reson}`);
        return -1;
      });
  }

  public findByType(type: number = MINIHOST_TYPE) {
    debug(`findByType ${type} on ${this.path} (${this.description.category})`);
    const sarp = createSarp(SarpQueryType.ByType, [0, 0, 0, (type >> 8) & 0xFF, type & 0xFF]);
    return this.sendDatagram(sarp);
  }

  public async getVersion(address: AddressParam): Promise<number[]> {
    const nmsRead = createNmsRead(address, VERSION_ID);
    try {
      const { value, status } = await this.sendDatagram(nmsRead) as NmsDatagram;
      if (status !== 0) {
        debug('<error>', status);
        return [];
      }
      const version = (value as number) & 0xFFFF;
      const type = (value as number) >>> 16;
      return [version, type];
    } catch (err) {
      debug('<error>', err.message || err);
      return [];
    }
  }

  public close = () => {
    if (this.closed) return;
    const { path, description } = this;
    debug(`close connection on ${path} (${description.category})`);
    this.closed = true;
    this.encoder.end();
    this.decoder.removeAllListeners('data');
    this.socket.destroy();
    this.emit('close');
  };
}

export default NibusConnection;
