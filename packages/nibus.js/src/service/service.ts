import _ from 'lodash';
import { EventEmitter } from 'events';
import debugFactory from 'debug';
import Address from '../Address';
import { IDevice, devices } from '../mib';
import { NibusConnection } from '../nibus';
import { createNmsRead } from '../nms';
import { createSarp, SarpQueryType } from '../sarp';
import detector, { IKnownPort } from './detector';

const debug = debugFactory('nibus:service');

function ping(connection: NibusConnection, address: Address): Promise<number> {
  const now = Date.now();
  return connection.sendDatagram(createNmsRead(address, 2))
    .then((datagram) => {
      return <number>(Reflect.getOwnMetadata('timeStamp', datagram!)) - now;
    })
    .catch(() => -1);
}

export const MINIHOST_TYPE = 0xabc6;

class NibusService extends EventEmitter {
  private connections: NibusConnection[] = [];
  private isStarted = false;

  private addHandler = ({ comName, category }: IKnownPort) => {
    const mibCategory = detector.detection!.mibCategories[category!];
    if (mibCategory) {
      const connection = new NibusConnection(comName, mibCategory);
      this.connections.push(connection);
      // debug(`new nibus-connection: ${mibCategory.category}`);
      this.emit('add', category);
      devices.get()
        .filter(device => device.connection == null)
        .reduce(async (promise, device) => {
          await promise;
          const time = await ping(connection, device.address);
          if (time !== -1) {
            device.connection = connection;
            this.emit('connected', device);
            // device.emit('connected');
            debug(`mib-device ${device.address} was connected`);
          }
        }, Promise.resolve())
        .catch();
    }
  };

  private removeHandler = ({ comName }: IKnownPort) => {
    const index = this.connections.findIndex(({ port }) => port === comName);
    if (index !== -1) {
      const [connection] = this.connections.splice(index, 1);
      // debug(`nibus-connection was closed ${connection.description.category}`);
      connection.close();
      devices.get()
        .filter(device => device.connection === connection)
        .forEach((device) => {
          device.connection = undefined;
          this.emit('disconnected', device);
          // device.emit('disconnected');
          debug(`mib-device ${device.address} was disconnected`);
        });
      this.emit('remove', connection.port);
    }
  };

  start() {
    const { detection, ports } = detector;
    if (detection == null) throw new Error('detection is N/A');
    this.connections = ports
      .filter(({ category }) => category != null && detection.mibCategories[category] != null)
      .map(({ comName, category }) =>
        new NibusConnection(comName, detection.mibCategories[category!]));

    this.connections.length &&
    debug(`It was created ${this.connections.length} nibus-connection(s): ${this.connections.map(
      connection => connection.description.category).join()}`);

    detector.on('add', this.addHandler);
    detector.on('remove', this.removeHandler);
    detector.start();
    this.isStarted = true;
    this.emit('start');
    debug('started');
  }

  stop() {
    this.isStarted = false;
    debug('stopped');
    this.emit('stop');
    detector.stop();
    this.connections.forEach(connection => connection.close());
    devices.get().forEach((device) => {
      device.connection = undefined;
      debug(`mib-device ${device.address} was disconnected`);
      // device.emit('disconnected');
    });
    this.connections.length = 0;
    detector.removeListener('add', this.addHandler);
    detector.removeListener('remove', this.removeHandler);
  }

  async pingDevice(device: IDevice): Promise<number> {
    if (!this.isStarted) return -1;

    const { connections } = this;
    if (device.connection && connections.includes(device.connection)) {
      const timeout = await ping(device.connection, device.address);
      if (timeout !== -1) return timeout;
      device.connection = undefined;
      this.emit('disconnected', device);
      // device.emit('disconnected');
    }

    const mib = Reflect.getMetadata('mib', device);
    const occupied = devices.get()
      .map(device => device.connection!)
      .filter(connection => connection != null && !connection.description.link);
    const acceptables = _.difference(connections, occupied)
      .filter(({ description }) => description.link || description.mib === mib);
    if (acceptables.length === 0) return -1;

    const [timeout, connection] = await Promise.race(acceptables.map(
      connection => ping(connection, device.address)
        .then(t => [t, connection] as [number, NibusConnection])));
    if (timeout === -1) return -1;

    device.connection = connection;
    this.emit('connected', device);
    // device.emit('connected');
    debug(`mib-device ${device.address} was connected`);
    return timeout;
  }

  findFirstByType(type: number = MINIHOST_TYPE) {
    const sarp = createSarp(SarpQueryType.ByType, [0, 0, 0, (type >> 8) & 0xFF, type & 0xFF]);

  }
}

const service = new NibusService();

devices.on('new', (device: IDevice) => {
  service.pingDevice(device).catch();
});

devices.on('delete', (device: IDevice) => {
  if (device.connection) {
    device.connection = undefined;
    service.emit('disconnected', device);
    // device.emit('disconnected');
  }
});

export default service;
