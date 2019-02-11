import { EventEmitter } from 'events';
import _ from 'lodash';
import path from 'path';
import 'reflect-metadata';
import debugFactory from 'debug';
import Address, { AddressParam } from '../Address';
import { NibusError } from '../errors';
import { NibusConnection } from '../nibus';
import { chunkArray } from '../nibus/helper';
import { createNmsRead, createNmsWrite, getNmsType } from '../nms';
import NmsDatagram from '../nms/NmsDatagram';
import {
  booleanConverter, convertFrom, convertTo,
  enumerationConverter, fixedPointNumber4Converter, getIntSize,
  IConverter, packed8floatConverter, percentConverter,
  precisionConverter, representationConverter,
  toInt,
  unitConverter, validJsName, versionTypeConverter, withValue,
} from './mib';
import detector from '../service/detector';

const debug = debugFactory('nibus:devices');

const $values = Symbol('values');
const $errors = Symbol('errors');
const $dirties = Symbol('dirties');

enum PrivateProps {
  connection = -1,
}

const deviceMap: { [address: string]: DevicePrototype } = {};

const mibTypesCache: { [mibname: string]: Function } = {};

interface IMibPropertyAppInfo {
  nms_id: string | number;
  access: string;
  category?: string;
}

interface IMibProperty {
  type: string;
  annotation: string;
  appinfo: IMibPropertyAppInfo;
}

export interface IMibDeviceType {
  annotation: string;
  appinfo: {
    mib_vertsion: string,
    device_type: string,
    loader_type?: string,
    firmware?: string,
  };
  properties: {
    [key: string]: IMibProperty,
  };
}

export interface IMibType {
  base: string;
  appinfo?: {
    zero?: string,
    units?: string,
    precision?: string,
    representation?: string;
  };
  minInclusive?: string;
  maxInclusive?: string;
  enumeration?: {
    [key: string]: {
      annotation: string,
    },
  };
}

interface IMibDevice {
  device: string;
  types: {
    // errorType?: {
    //   enumeration: {[errcode: string]: string},
    // },
    [type: string]: IMibDeviceType | IMibType;
  };
}

/**
 * @fires connected
 * @fires disconnected
 * @fires changed
 * @fires changing
 */
export interface IDevice extends EventEmitter {
  [$values]: { [id: number]: any };
  [$errors]: { [id: number]: Error };
  [$dirties]: { [id: number]: boolean };
  readonly address: Address;

  drain(): Promise<number[]>;

  write(...ids: number[]): Promise<number[]>;

  read(...ids: number[]): Promise<any[]>;

  connection?: NibusConnection;

  release(): number;

  getId(idOrName: string | number): number;

  [mibProperty: string]: any;
}

interface IPropertyDescriptor<Owner> {
  configurable?: boolean;
  enumerable?: boolean;
  value?: any;
  writable?: boolean;

  get?(this: Owner): any;

  set?(this: Owner, v: any): void;
}

function getBaseType(types: IMibDevice['types'], type: string): string {
  let base = type;
  for (let superType: IMibType = types[base] as IMibType; superType != null;
       superType = types[superType.base] as IMibType) {
    base = superType.base;
  }
  return base;
}

function defineMibProperty(
  target: DevicePrototype,
  key: string,
  types: IMibDevice['types'],
  prop: IMibProperty) {
  const propertyKey = validJsName(key);
  const { appinfo } = prop;
  const id = toInt(appinfo.nms_id);
  Reflect.defineMetadata('id', id, target, propertyKey);
  const simpleType = getBaseType(types, prop.type);
  const type = types[prop.type] as IMibType;
  const converters: IConverter[] = [];
  const isReadable = appinfo.access.indexOf('r') > -1;
  const isWritable = appinfo.access.indexOf('w') > -1;
  if (type != null) {
    const { appinfo: info = {}, enumeration } = type;
    const { units, precision, representation } = info;
    const size = getIntSize(simpleType);
    units && converters.push(unitConverter(units));
    precision && converters.push(precisionConverter(precision));
    enumeration && converters.push(enumerationConverter(enumeration));
    representation && size && converters.push(representationConverter(representation, size));
  }
  if (key === 'brightness' && prop.type === 'xs:unsignedByte') {
    converters.push(percentConverter);
  }
  switch (simpleType) {
    case 'packed8Float':
      converters.push(packed8floatConverter(type));
      break;
    case 'fixedPointNumber4':
      converters.push(fixedPointNumber4Converter);
      break;
    default:
      break;
  }
  if (prop.type === 'versionType') {
    converters.push(versionTypeConverter);
  }
  if (simpleType === 'xs:boolean') {
    converters.push(booleanConverter);
    Reflect.defineMetadata('enum', [{ Да: true }, { Нет: false }], target, propertyKey);
  }
  Reflect.defineMetadata('isWritable', isWritable, target, propertyKey);
  Reflect.defineMetadata('isReadable', isReadable, target, propertyKey);
  Reflect.defineMetadata('type', prop.type, target, propertyKey);
  Reflect.defineMetadata('simpleType', simpleType, target, propertyKey);
  Reflect.defineMetadata(
    'displayName',
    prop.annotation ? prop.annotation : name,
    target,
    propertyKey,
  );
  appinfo.category && Reflect.defineMetadata('category', appinfo.category, target, propertyKey);
  Reflect.defineMetadata('nmsType', getNmsType(simpleType), target, propertyKey);
  const attributes: IPropertyDescriptor<DevicePrototype> = {
    enumerable: isReadable,
  };
  if (isReadable) {
    attributes.get = function () {
      console.assert(Reflect.get(this, '$countRef') > 0, 'Device was released');
      let value;
      if (!this.getError(id)) {
        value = convertTo(converters)(this.getRawValue(id));
      }
      return value;
    };
  }
  if (isWritable) {
    attributes.set = function (newValue: any) {
      console.assert(Reflect.get(this, '$countRef') > 0, 'Device was released');
      this.setRawValue(id, convertFrom(converters)(newValue));
    };
  }
  Reflect.defineProperty(target, propertyKey, attributes);
  return id;
}

export function getMibFile(mibname: string) {
  return path.resolve(__dirname, '../../mibs/', `${mibname}.mib.json`);
}

class DevicePrototype extends EventEmitter {
  // will be override for an instance
  private $countRef = 1;

  // private $debounceDrain = _.debounce(this.drain, 25);

  constructor(mibname: string) {
    super();
    const mibfile = getMibFile(mibname);
    const mib: IMibDevice = require(mibfile);
    const { types } = mib;
    const device = types[mib.device] as IMibDeviceType;
    Reflect.defineMetadata('mib', mibname, this);
    Reflect.defineMetadata('mibfile', mibfile, this);
    Reflect.defineMetadata('annotation', device.annotation, this);
    Reflect.defineMetadata('mibVersion', device.appinfo.mib_vertsion, this);
    Reflect.defineMetadata('deviceType', toInt(device.appinfo.device_type), this);
    device.appinfo.loader_type && Reflect.defineMetadata('loaderType',
      toInt(device.appinfo.loader_type), this,
    );
    device.appinfo.firmware && Reflect.defineMetadata('firmware',
      device.appinfo.firmware, this,
    );
    types.errorType && Reflect.defineMetadata(
      'errorType', (types.errorType as IMibType).enumeration, this);

    const mibCategory = _.find(detector.detection!.mibCategories, { mib: mibname });
    if (mibCategory) {
      const { category, disableBatchReading } = mibCategory;
      Reflect.defineMetadata('category', category, this);
      Reflect.defineMetadata('disableBatchReading', !!disableBatchReading, this);
    }

    const keys = Reflect.ownKeys(device.properties) as string[];
    Reflect.defineMetadata('mibProperties', keys, this);
    const map: { [id: number]: string[] } = {};
    keys.forEach((key: string) => {
      const id = defineMibProperty(this, key, types, device.properties[key]);
      if (!map[id]) {
        map[id] = [key];
      } else {
        map[id].push(key);
      }
    });
    Reflect.defineMetadata('map', map, this);
  }

  public get connection(): NibusConnection | undefined {
    const { [$values]: values } = this;
    return values[PrivateProps.connection];
  }

  public set connection(value: NibusConnection | undefined) {
    const { [$values]: values } = this;
    const prev = values[PrivateProps.connection];
    if (prev === value) return;
    values[PrivateProps.connection] = value;
    /**
     * Device connected event
     * @event IDevice#connected
     * @event IDevice#disconnected
     */
    this.emit(value != null ? 'connected' : 'disconnected');
    if (value) {
      this.drain().catch(() => {});
    }
  }

  // noinspection JSUnusedGlobalSymbols
  public toJSON(): any {
    const json: any = {
      mib: Reflect.getMetadata('mib', this),
    };
    const keys: string[] = Reflect.getMetadata('mibProperties', this);
    keys.forEach((key) => {
      if (this.key !== undefined) json[key] = this[key];
    });
    json.address = this.address.toString();
    return json;
  }

  public getId(idOrName: string | number): number {
    let id: number;
    if (typeof idOrName === 'string') {
      id = Reflect.getMetadata('id', this, idOrName);
      if (Number.isInteger(id)) return id;
      id = toInt(idOrName);
    } else {
      id = idOrName;
    }
    const map = Reflect.getMetadata('map', this);
    if (!Reflect.has(map, id)) {
      throw new Error(`Unknown property ${idOrName}`);
    }
    return id;
  }

  public getRawValue(idOrName: number | string): any {
    const id = this.getId(idOrName);
    const { [$values]: values } = this;
    return values[id];
  }

  public setRawValue(idOrName: number | string, value: any, isDirty = true) {
    const id = this.getId(idOrName);
    const { [$values]: values, [$errors]: errors } = this;
    values[id] = value;
    delete errors[id];
    this.setDirty(id, isDirty);
  }

  public getError(idOrName: number | string): any {
    const id = this.getId(idOrName);
    const { [$errors]: errors } = this;
    return errors[id];
  }

  public setError(idOrName: number | string, error?: Error) {
    const id = this.getId(idOrName);
    const { [$errors]: errors } = this;
    if (error != null) {
      errors[id] = error;
    } else {
      delete errors[id];
    }
  }

  public isDirty(idOrName: string | number): boolean {
    const id = this.getId(idOrName);
    const { [$dirties]: dirties } = this;
    return dirties[id] === true;
  }

  public setDirty(idOrName: string | number, isDirty = true) {
    const id = this.getId(idOrName);
    const map: { [id: number]: string[] } = Reflect.getMetadata('map', this);
    const { [$dirties]: dirties } = this;
    if (isDirty) {
      dirties[id] = true;
      this.write(id).catch(() => {});
    } else {
      delete dirties[id];
    }
    /**
     * @event IDevice#changed
     * @event IDevice#changing
     */
    const names = map[id] || [];
    this.emit(
      isDirty ? 'changing' : 'changed',
      {
        id,
        names,
      },
    );
  }

  public addref() {
    this.$countRef += 1;
    return this.$countRef;
  }

  public release() {
    this.$countRef -= 1;
    if (this.$countRef <= 0) {
      delete deviceMap[this.address.toString()];
      /**
       * @event Devices#delete
       */
      devices.emit('delete', this);
    }
    return this.$countRef;
  }

  public drain(): Promise<number[]> {
    debug(`drain [${this.address}]`);
    const { [$dirties]: dirties } = this;
    const ids = Object.keys(dirties).map(Number).filter(id => dirties[id]);
    return ids.length > 0 ? this.write(...ids).catch(() => []) : Promise.resolve([]);
  }

  private writeAll() {
    const { [$values]: values } = this;
    const map = Reflect.getMetadata('map', this);
    const ids = Object.entries(values)
      .filter(([, value]) => value != null)
      .map(([id]) => map[id][0])
      .filter(name => Reflect.getMetadata('isWritable', this, name))
      .map(name => Reflect.getMetadata('id', this, name));
    return ids.length > 0 ? this.write(...ids) : Promise.resolve([]);
  }

  public write(...ids: number[]): Promise<number[]> {
    const { connection } = this;
    if (!connection) return Promise.reject(`${this.address} is disconnected`);
    if (ids.length === 0) {
      return this.writeAll();
    }
    debug(`writing ${ids.join()} to [${this.address}]`);
    const map = Reflect.getMetadata('map', this);
    const requests = ids.reduce(
      (acc: NmsDatagram[], id) => {
        const [name] = map[id];
        if (!name) {
          debug(`Unknown id: ${id} for ${Reflect.getMetadata('mib', this)}`);
        } else {
          acc.push(createNmsWrite(
            this.address,
            id,
            Reflect.getMetadata('nmsType', this, name),
            this.getRawValue(id),
          ));
        }
        return acc;
      },
      [],
    );
    return Promise.all(
      requests
        .map(datagram => connection.sendDatagram(datagram)
          .then((response) => {
            const { status } = response as NmsDatagram;
            if (status === 0) {
              this.setDirty(datagram.id, false);
              return datagram.id;
            }
            this.setError(datagram.id, new NibusError(status!, this));
            return -1;
          }, (reason) => {
            this.setError(datagram.id, reason);
            return -1;
          })))
      .then(ids => ids.filter(id => id > 0));
  }

  public writeValues(source: object, strong = true): Promise<number[]> {
    try {
      const ids = Object.keys(source).map(name => this.getId(name));
      if (ids.length === 0) return Promise.reject(new TypeError('value is empty'));
      Object.assign(this, source);
      return this.write(...ids)
        .then((written) => {
          if (written.length === 0 || (strong && written.length !== ids.length)) {
            throw this.getError(ids[0]);
          }
          return written;
        });
    } catch (err) {
      return Promise.reject(err);
    }
  }

  private readAll(): Promise<any> {
    const map: { [id: string]: string[] } = Reflect.getMetadata('map', this);
    const ids = Object.entries(map)
      .filter(([, names]) => Reflect.getMetadata('isReadable', this, names[0]))
      .map(([id]) => Number(id));
    return ids.length > 0 ? this.read(...ids) : Promise.resolve([]);
  }

  public read(...ids: number[]): Promise<any> {
    const { connection } = this;
    if (!connection) return Promise.reject('disconnected');
    if (ids.length === 0) return this.readAll();
    // debug(`read ${ids.join()} from [${this.address}]`);
    const disableBatchReading = Reflect.getMetadata('disableBatchReading', this);
    const map: { [id: string]: string[] } = Reflect.getMetadata('map', this);
    const chunks = chunkArray(ids, disableBatchReading ? 1 : 21);
    debug(`read [${chunks.map(chunk => `[${chunk.join()}]`).join()}] from [${this.address}]`);
    const requests = chunks.map(chunk => createNmsRead(this.address, ...chunk));
    return Promise.all(
      requests
        .map((datagram, index) => connection.sendDatagram(datagram)
          .then((response) => {
            const datagrams: NmsDatagram[] = !Array.isArray(response!)
              ? [response as NmsDatagram]
              : response as NmsDatagram[];
            datagrams.forEach(({ id, value, status }) => {
              if (status === 0) {
                this.setRawValue(id, value, false);
              } else {
                this.setError(id, new NibusError(status!, this));
              }
            });
            return datagrams.reduce((result: any, { id }) => {
              const names = map[id];
              console.assert(names && names.length > 0, `Invalid id ${id}`);
              names.forEach((propName) => {
                const value = this[propName];
                const error = this.getError(id);
                result[propName] = error ? { error: error.message } : value;
              });
              return result;
            }, {});
          }, (reason) => {
            return chunks[index].reduce((result: any, id: number) => {
              this.setError(id, reason);
              map[id].forEach(propName => result[propName] = reason);
              return result;
            });
          }),
        ),
    ).then(results => results.length > 1 ? Object.assign({}, ...results) : results[0]);
  }
}

// tslint:disable-next-line
interface DevicePrototype extends IDevice {
}

/**
 * @fires new
 * @fires delete
 */
class Devices extends EventEmitter {
  get = (): IDevice[] => _.values(deviceMap);

  create(address: AddressParam, mib: string = 'minihost_v2.06b'): IDevice {
    const targetAddress = new Address(address);
    let device = deviceMap[targetAddress.toString()];
    if (device) {
      console.assert(
        Reflect.getMetadata('mib', device) === mib,
        `mibs are different, expected ${mib}`,
      );
      device.addref();
      return device;
    }

    // tslint:disable-next-line
    function Device(this: IDevice, address: Address) {
      EventEmitter.apply(this);
      this[$values] = {};
      this[$errors] = {};
      this[$dirties] = {};
      Reflect.defineProperty(this, 'address', withValue(address));
      this.$countRef = 1;
      this.$debounceDrain = _.debounce(this.drain, 25);
    }

    let constructor = mibTypesCache[mib];
    if (!constructor) {
      const prototype = new DevicePrototype(mib);
      Device.prototype = Object.create(prototype);
      constructor = Device;
      mibTypesCache[mib] = constructor;
    }
    device = Reflect.construct(constructor, [targetAddress]);
    deviceMap[targetAddress.toString()] = device;
    /**
     * New device event
     * @event Devices#new
     * @param {IDevice} device
     */
    this.emit('new', device);
    return device;
  }
}

const devices = new Devices();

export default devices;
