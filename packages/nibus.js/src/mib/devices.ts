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
  IConverter, maxInclusiveConverter, minInclusiveConverter, packed8floatConverter, percentConverter,
  precisionConverter, representationConverter,
  toInt,
  unitConverter, validJsName, versionTypeConverter, withValue,
} from './mib';
import { getMibsSync } from './mib2json';
// import detector from '../service/detector';

const debug = debugFactory('nibus:devices');

const $values = Symbol('values');
const $errors = Symbol('errors');
const $dirties = Symbol('dirties');

function safeNumber(val: any) {
  const num = parseFloat(val);
  return (Number.isNaN(num) || `${num}` !== val) ? val : num;
}

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
  readonly address: Address;

  drain(): Promise<number[]>;

  write(...ids: number[]): Promise<number[]>;

  read(...ids: number[]): Promise<{ [name: string]: any }>;

  connection?: NibusConnection;

  release(): number;

  getId(idOrName: string | number): number;

  getName(idOrName: string | number): string;

  getRawValue(idOrName: number | string): any;

  getError(idOrName: number | string): any;

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
  prop: IMibProperty): [number, string] {
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
    const { appinfo: info = {}, enumeration, minInclusive, maxInclusive } = type;
    const { units, precision, representation } = info;
    const size = getIntSize(simpleType);
    units && converters.push(unitConverter(units));
    precision && converters.push(precisionConverter(precision));
    enumeration && converters.push(enumerationConverter(enumeration));
    representation && size && converters.push(representationConverter(representation, size));
    minInclusive && converters.push(minInclusiveConverter(minInclusive));
    maxInclusive && converters.push(maxInclusiveConverter(maxInclusive));
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
  // if (isReadable) {
  attributes.get = function () {
    console.assert(Reflect.get(this, '$countRef') > 0, 'Device was released');
    let value;
    if (!this.getError(id)) {
      value = convertTo(converters)(this.getRawValue(id));
    }
    return value;
  };
  // }
  if (isWritable) {
    attributes.set = function (newValue: any) {
      console.assert(Reflect.get(this, '$countRef') > 0, 'Device was released');
      const value = convertFrom(converters)(newValue);
      if (value === undefined || Number.isNaN(value as number)) {
        throw new Error(`Invalid value: ${JSON.stringify(newValue)}`);
      }
      this.setRawValue(id, value);
    };
  }
  Reflect.defineProperty(target, propertyKey, attributes);
  return [id, propertyKey];
}

export function getMibFile(mibname: string) {
  return path.resolve(__dirname, '../../mibs/', `${mibname}.mib.json`);
}

class DevicePrototype extends EventEmitter {
  // will be override for an instance
  $countRef = 1;

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

    // TODO: category
    // const mibCategory = _.find(detector.detection!.mibCategories, { mib: mibname });
    // if (mibCategory) {
    //   const { category, disableBatchReading } = mibCategory;
    //   Reflect.defineMetadata('category', category, this);
    //   Reflect.defineMetadata('disableBatchReading', !!disableBatchReading, this);
    // }

    const keys = Reflect.ownKeys(device.properties) as string[];
    Reflect.defineMetadata('mibProperties', keys.map(validJsName), this);
    const map: { [id: number]: string[] } = {};
    keys.forEach((key: string) => {
      const [id, propName] = defineMibProperty(this, key, types, device.properties[key]);
      if (!map[id]) {
        map[id] = [propName];
      } else {
        map[id].push(propName);
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
    // if (value) {
    //   this.drain().catch(() => {});
    // }
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

  public getName(idOrName: string | number): string {
    const map = Reflect.getMetadata('map', this);
    if (Reflect.has(map, idOrName)) {
      return map[idOrName][0];
    }
    const keys: string[] = Reflect.getMetadata('mibProperties', this);
    if (typeof idOrName === 'string' && keys.includes(idOrName)) return idOrName;
    throw new Error(`Unknown property ${idOrName}`);
  }

  public getRawValue(idOrName: number | string): any {
    const id = this.getId(idOrName);
    const { [$values]: values } = this;
    return values[id];
  }

  public setRawValue(idOrName: number | string, value: any, isDirty = true) {
    // debug(`setRawValue(${idOrName}, ${JSON.stringify(safeNumber(value))})`);
    const id = this.getId(idOrName);
    const { [$values]: values, [$errors]: errors } = this;
    values[id] = safeNumber(value);
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
    return !!dirties[id];
  }

  public setDirty(idOrName: string | number, isDirty = true) {
    const id = this.getId(idOrName);
    const map: { [id: number]: string[] } = Reflect.getMetadata('map', this);
    const { [$dirties]: dirties } = this;
    if (isDirty) {
      dirties[id] = true;
      // TODO: implement autosave
      // this.write(id).catch(() => {});
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

  public async read(...ids: number[]): Promise<{ [name: string]: any }> {
    const { connection } = this;
    if (!connection) return Promise.reject('disconnected');
    if (ids.length === 0) return this.readAll();
    // debug(`read ${ids.join()} from [${this.address}]`);
    const disableBatchReading = Reflect.getMetadata('disableBatchReading', this);
    const map: { [id: string]: string[] } = Reflect.getMetadata('map', this);
    const chunks = chunkArray(ids, disableBatchReading ? 1 : 21);
    debug(`read [${chunks.map(chunk => `[${chunk.join()}]`).join()}] from [${this.address}]`);
    const requests = chunks.map(chunk => createNmsRead(this.address, ...chunk));
    return requests.reduce(
      async (promise, datagram) => {
        const result = await promise;
        const response = await connection.sendDatagram(datagram);
        const datagrams: NmsDatagram[] = Array.isArray(response)
          ? response as NmsDatagram[]
          : [response as NmsDatagram];
        datagrams.forEach(({ id, value, status }) => {
          if (status === 0) {
            this.setRawValue(id, value, false);
          } else {
            this.setError(id, new NibusError(status!, this));
          }
          const names = map[id];
          console.assert(names && names.length > 0, `Invalid id ${id}`);
          names.forEach((propName) => {
            result[propName] = status === 0
              ? this[propName]
              : { error: (this.getError(id) || {}).message || 'error' };
          });
        });
        return result;
      },
      Promise.resolve({} as { [name: string]: any }),
    );
  }
}

// tslint:disable-next-line
interface DevicePrototype extends IDevice {
  [$values]: { [id: number]: any };
  [$errors]: { [id: number]: Error };
  [$dirties]: { [id: number]: boolean };
}

function findMibByType(type: number): string | undefined {
  const cacheMibs = Object.keys(mibTypesCache);
  const cached = cacheMibs.find(mib =>
    Reflect.getMetadata('deviceType', mibTypesCache[mib].prototype) === type);
  if (cached) return cached;
  const mibs = getMibsSync();
  return _.difference(mibs, cacheMibs).find((mibName) => {
    const mibfile = getMibFile(mibName);
    const mib: IMibDevice = require(mibfile);
    const { types } = mib;
    const device = types[mib.device] as IMibDeviceType;
    return toInt(device.appinfo.device_type) === type;
  });
}

declare interface Devices {
  on(event: 'new', deviceListener: (device: IDevice) => void): this;

  once(event: 'new', deviceListener: (device: IDevice) => void): this;

  addEventListener(event: 'new', deviceListener: (device: IDevice) => void): this;

  on(event: 'delete', deviceListener: (device: IDevice) => void): this;

  once(event: 'delete', deviceListener: (device: IDevice) => void): this;

  addEventListener(event: 'delete', deviceListener: (device: IDevice) => void): this;
}

function getConstructor(mib: string): Function {
  let constructor = mibTypesCache[mib];
  if (!constructor) {
    // tslint:disable-next-line
    function Device(this: DevicePrototype, address: Address) {
      EventEmitter.apply(this);
      this[$values] = {};
      this[$errors] = {};
      this[$dirties] = {};
      Reflect.defineProperty(this, 'address', withValue(address));
      this.$countRef = 1;
      this.$debounceDrain = _.debounce(this.drain, 25);
    }

    const prototype = new DevicePrototype(mib);
    Device.prototype = Object.create(prototype);
    constructor = Device;
    mibTypesCache[mib] = constructor;
  }
  return constructor;
}

export function getMibPrototype(mib: string): Object {
  return getConstructor(mib).prototype;
}

class Devices extends EventEmitter {
  get = (): IDevice[] => _.values(deviceMap);

  find = (address: AddressParam): IDevice | undefined => {
    const targetAddress = new Address(address);
    return deviceMap[targetAddress.toString()];
  };

  create(address: AddressParam, mib: string): IDevice;
  create(address: AddressParam, type: number): IDevice;
  create(address: AddressParam, mibOrType: any): IDevice {
    let mib: string | undefined;
    if (typeof mibOrType === 'number') {
      mib = findMibByType(mibOrType);
      if (mib === undefined) throw new Error('Unknown mib type');
    } else if (typeof mibOrType === 'string') {
      mib = String(mibOrType || 'minihost_v2.06b');
    } else {
      throw new Error('mib expected');
    }
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

    const constructor = getConstructor(mib);
    device = Reflect.construct(constructor, [targetAddress]);
    if (!targetAddress.isEmpty) {
      deviceMap[targetAddress.toString()] = device;
      process.nextTick(() => this.emit('new', device));
    }
    return device;
  }
}

const devices = new Devices();

export default devices;
