import { EventEmitter } from 'events';
import _ from 'lodash';
import path from 'path';
import 'reflect-metadata';
import Address, { AddressParam } from '../Address';
import { NibusConnection } from '../nibus';
import { getNmsType } from '../nms';
import {
  booleanConverter, convertFrom, convertTo,
  enumerationConverter, fixedPointNumber4Converter, getIntSize,
  IConverter, packed8floatConverter, percentConverter,
  precisionConverter, representationConverter,
  toInt,
  unitConverter, validJsName, versionTypeConverter, withValue,
} from './mib';

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

interface IMibDeviceType {
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
    [type: string]: IMibDeviceType | IMibType;
  };
}

export interface IDevice {
  [$values]: { [id: number]: any };
  [$errors]: { [id: number]: Error };
  [$dirties]: { [id: number]: boolean };
  readonly address: Address;
  connection?: NibusConnection;

  release(): number;

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
  Reflect.defineMetadata('isReadOnly', isReadable && !isWritable, target, propertyKey);
  Reflect.defineMetadata('isBrowsable', isReadable, target, propertyKey);
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

class DevicePrototype extends EventEmitter {
  private $countRef = 1;

  constructor(mibname: string) {
    super();
    const mibfile = path.resolve(__dirname, '../../mibs/', `${mibname}.mib.json`);
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

    const keys = Reflect.ownKeys(device.properties) as string[];
    Reflect.defineMetadata('mibProperties', keys, this);
    const map: any = {};
    keys.forEach((key: string) => {
      const id = defineMibProperty(this, key, types, device.properties[key]);
      map[key] = id;
      map[id] = key;
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
    this.emit(value != null ? 'connected' : 'disconnected');
  }

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
    let id = toInt(idOrName);
    if (Number.isNaN(id) || id <= 0) {
      const map = Reflect.getMetadata('map', this);
      if (!map[idOrName]) {
        throw new Error(`Unknown property ${idOrName}`);
      }
      id = map[idOrName] as number;
    }
    return id;
  }

  public getRawValue(idOrName: number | string): any {
    const id = this.getId(idOrName);
    const { [$values]: values } = this;
    // console.log('getRaw THIS', this);
    // console.log('proto', Reflect.getPrototypeOf(this));
    // console.log('values', values);
    return values[id];
  }

  public setRawValue(idOrName: number | string, value: any, isDirty = true) {
    const id = this.getId(idOrName);
    const { [$values]: values, [$errors]: errors, [$dirties]: dirties } = this;
    values[id] = value;
    delete errors[id];
    dirties[id] = isDirty;
  }

  public getError(idOrName: number | string): any {
    const id = this.getId(idOrName);
    const { [$errors]: errors } = this;
    // console.log('getError THIS', this);
    // console.log('errors', errors);
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
    const { [$dirties]: dirties } = this;
    dirties[id] = isDirty;
  }

  public addref() {
    this.$countRef += 1;
    return this.$countRef;
  }

  public release() {
    this.$countRef -= 1;
    if (this.$countRef <= 0) {
      delete deviceMap[this.address.toString()];
      devices.emit('delete', this);
    }
    return this.$countRef;
  }
}

// tslint:disable-next-line
interface DevicePrototype extends IDevice {
}

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
    this.emit('new', device);
    return device;
  }
}

const devices = new Devices();

export default devices;
