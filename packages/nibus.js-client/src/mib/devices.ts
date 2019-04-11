/*
 * @license
 * Copyright (c) 2019. OOO Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

/* tslint:disable:variable-name */
import { crc16ccitt } from 'crc';
import debugFactory from 'debug';
import { EventEmitter } from 'events';
import * as t from 'io-ts';
import { PathReporter } from 'io-ts/lib/PathReporter';
import _ from 'lodash';
import path from 'path';
import 'reflect-metadata';
import { config as configDir } from 'xdg-basedir';
import Address, { AddressParam } from '../Address';
import { NibusError } from '../errors';
import { NMS_MAX_DATA_LENGTH } from '../nbconst';
import { NibusConnection } from '../nibus';
import { chunkArray } from '../nibus/helper';
import {
  createExecuteProgramInvocation,
  createNmsDownloadSegment,
  createNmsInitiateDownloadSequence,
  createNmsInitiateUploadSequence,
  createNmsRead,
  createNmsRequestDomainDownload,
  createNmsRequestDomainUpload,
  createNmsTerminateDownloadSequence,
  createNmsUploadSegment,
  createNmsVerifyDomainChecksum,
  createNmsWrite,
  getNmsType, TypedValue,
} from '../nms';
import NmsDatagram from '../nms/NmsDatagram';
import NmsValueType from '../nms/NmsValueType';
import { ConfigV } from '../session/common';
import {
  booleanConverter,
  convertFrom,
  convertTo,
  enumerationConverter,
  fixedPointNumber4Converter,
  getIntSize,
  IConverter,
  maxInclusiveConverter,
  minInclusiveConverter,
  packed8floatConverter,
  percentConverter,
  precisionConverter,
  representationConverter,
  toInt,
  unitConverter,
  validJsName,
  versionTypeConverter,
  withValue,
} from './mib';
import timeid from '../timeid';
// import { getMibsSync } from './mib2json';
// import detector from '../service/detector';

const pkgName = '@nata/nibus.js'; // require('../../package.json').name;

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

const MibPropertyAppInfoV = t.intersection([
  t.type({
    nms_id: t.union([t.string, t.Int]),
    access: t.string,
  }),
  t.partial({
    category: t.string,
  }),
]);

// interface IMibPropertyAppInfo extends t.TypeOf<typeof MibPropertyAppInfoV> {}

const MibPropertyV = t.type({
  type: t.string,
  annotation: t.string,
  appinfo: MibPropertyAppInfoV,
});

interface IMibProperty extends t.TypeOf<typeof MibPropertyV> {
  // appinfo: IMibPropertyAppInfo;
}

const MibDeviceAppInfoV = t.intersection([
  t.type({
    mib_version: t.string,
  }),
  t.partial({
    device_type: t.string,
    loader_type: t.string,
    firmware: t.string,
    min_version: t.string,
  }),
]);

const MibDeviceTypeV = t.type({
  annotation: t.string,
  appinfo: MibDeviceAppInfoV,
  properties: t.record(t.string, MibPropertyV),
});

export interface IMibDeviceType extends t.TypeOf<typeof MibDeviceTypeV> {}

const MibTypeV = t.intersection([
  t.type({
    base: t.string,
  }),
  t.partial({
    appinfo: t.partial({
      zero: t.string,
      units: t.string,
      precision: t.string,
      representation: t.string,
    }),
    minInclusive: t.string,
    maxInclusive: t.string,
    enumeration: t.record(t.string, t.type({ annotation: t.string })),
  }),
]);

export interface IMibType extends t.TypeOf<typeof MibTypeV> {}

const MibSubroutineV = t.intersection([
  t.type({
    annotation: t.string,
    appinfo: t.intersection([
      t.type({ nms_id: t.union([t.string, t.Int]) }),
      t.partial({ response: t.string }),
    ]),
  }),
  t.partial({
    properties: t.record(t.string, t.type({
      type: t.string,
      annotation: t.string,
    })),
  }),
]);

const SubroutineTypeV = t.type({
  annotation: t.string,
  properties: t.type({
    id: t.type({
      type: t.literal('xs:unsignedShort'),
      annotation: t.string,
    }),
  }),
});

export const MibDeviceV = t.intersection([
  t.type({
    device: t.string,
    types: t.record(t.string, t.union([MibDeviceTypeV, MibTypeV, SubroutineTypeV])),
  }),
  t.partial({
    subroutines: t.record(t.string, MibSubroutineV),
  }),
]);

interface IMibDevice extends t.TypeOf<typeof MibDeviceV> {}

type Listener<T> = (arg: T) => void;
type ChangeArg = { id: number, names: string[] };
export type ChangeListener = Listener<ChangeArg>;
type UploadStartArg = { domain: string, domainSize: number, offset: number, size: number };
export type UploadStartListener = Listener<UploadStartArg>;
type UploadDataArg = { domain: string, data: Buffer, pos: number };
export type UploadDataListener = Listener<UploadDataArg>;
type UploadFinishArg = { domain: string, offset: number, data: Buffer };
export type UploadFinishListener = Listener<UploadFinishArg>;
type DownloadStartArg = { domain: string, domainSize: number, offset: number, size: number };
export type DownloadStartListener = Listener<DownloadStartArg>;
type DownloadDataArg = { domain: string, length: number };
export type DownloadDataListener = Listener<DownloadDataArg>;
type DownloadFinishArg = { domain: string; offset: number, size: number };
export type DownloadFinishListener = Listener<DownloadFinishArg>;

export interface IDevice {
  readonly id: string;
  readonly address: Address;
  drain(): Promise<number[]>;
  write(...ids: number[]): Promise<number[]>;
  read(...ids: number[]): Promise<{ [name: string]: any }>;
  upload(domain: string, offset?: number, size?: number): Promise<Uint8Array>;
  download(domain: string, data: Buffer, offset?: number, noTerm?: boolean): Promise<void>;
  execute(
    program: string,
    args?: Record<string, any>): Promise<NmsDatagram | NmsDatagram[] | undefined>;
  connection?: NibusConnection;
  release(): number;
  getId(idOrName: string | number): number;
  getName(idOrName: string | number): string;
  getRawValue(idOrName: number | string): any;
  getError(idOrName: number | string): any;
  isDirty(idOrName: string | number): boolean;
  [mibProperty: string]: any;

  on(event: 'connected' | 'disconnected', listener: () => void): this;
  on(event: 'changing' | 'changed', listener: ChangeListener): this;
  on(event: 'uploadStart', listener: UploadStartListener): this;
  on(event: 'uploadData', listener: UploadDataListener): this;
  on(event: 'uploadFinish', listener: UploadFinishListener): this;
  on(event: 'downloadStart', listener: DownloadStartListener): this;
  on(event: 'downloadData', listener: DownloadDataListener): this;
  on(event: 'downloadFinish', listener: DownloadFinishListener): this;

  once(event: 'connected' | 'disconnected', listener: () => void): this;
  once(event: 'changing' | 'changed', listener: ChangeListener): this;
  once(event: 'uploadStart', listener: UploadStartListener): this;
  once(event: 'uploadData', listener: UploadDataListener): this;
  once(event: 'uploadFinish', listener: UploadFinishListener): this;
  once(event: 'downloadStart', listener: DownloadStartListener): this;
  once(event: 'downloadData', listener: DownloadDataListener): this;
  once(event: 'downloadFinish', listener: DownloadFinishListener): this;

  addListener(event: 'connected' | 'disconnected', listener: () => void): this;
  addListener(event: 'changing' | 'changed', listener: ChangeListener): this;
  addListener(event: 'uploadStart', listener: UploadStartListener): this;
  addListener(event: 'uploadData', listener: UploadDataListener): this;
  addListener(event: 'uploadFinish', listener: UploadFinishListener): this;
  addListener(event: 'downloadStart', listener: DownloadStartListener): this;
  addListener(event: 'downloadData', listener: DownloadDataListener): this;
  addListener(event: 'downloadFinish', listener: DownloadFinishListener): this;

  off(event: 'connected' | 'disconnected', listener: () => void): this;
  off(event: 'changing' | 'changed', listener: ChangeListener): this;
  off(event: 'uploadStart', listener: UploadStartListener): this;
  off(event: 'uploadData', listener: UploadDataListener): this;
  off(event: 'uploadFinish', listener: UploadFinishListener): this;
  off(event: 'downloadStart', listener: DownloadStartListener): this;
  off(event: 'downloadData', listener: DownloadDataListener): this;
  off(event: 'downloadFinish', listener: DownloadFinishListener): this;

  removeListener(event: 'connected' | 'disconnected', listener: () => void): this;
  removeListener(event: 'changing' | 'changed', listener: ChangeListener): this;
  removeListener(event: 'uploadStart', listener: UploadStartListener): this;
  removeListener(event: 'uploadData', listener: UploadDataListener): this;
  removeListener(event: 'uploadFinish', listener: UploadFinishListener): this;
  removeListener(event: 'downloadStart', listener: DownloadStartListener): this;
  removeListener(event: 'downloadData', listener: DownloadDataListener): this;
  removeListener(event: 'downloadFinish', listener: DownloadFinishListener): this;

  emit(event: 'connected' | 'disconnected'): boolean;
  emit(event: 'changing' | 'changed', arg: ChangeArg): boolean;
  emit(event: 'uploadStart', arg: UploadStartArg): boolean;
  emit(event: 'uploadData', arg: UploadDataArg): boolean;
  emit(event: 'uploadFinish', arg: UploadFinishArg): boolean;
  emit(event: 'downloadStart', arg: DownloadStartArg): boolean;
  emit(event: 'downloadData', arg: DownloadDataArg): boolean;
  emit(event: 'downloadFinish', arg: DownloadFinishArg): boolean;
}

interface ISubroutineDesc {
  id: number;
  // name: string;
  description: string;
  notReply?: boolean;
  args?: { name: string, type: NmsValueType, desc?: string }[];
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
  let enumeration: IMibType['enumeration'] | undefined;
  if (type != null) {
    const { appinfo: info = {}, minInclusive, maxInclusive } = type;
    enumeration = type.enumeration;
    const { units, precision, representation } = info;
    const size = getIntSize(simpleType);
    if (units) {
      converters.push(unitConverter(units));
      Reflect.defineMetadata('unit', units, target, propertyKey);
    }
    precision && converters.push(precisionConverter(precision));
    if (enumeration) {
      converters.push(enumerationConverter(enumeration));
      Reflect.defineMetadata('enum', Object.entries(enumeration)
        .map(([key, val]) => [
          val!.annotation,
          toInt(key),
        ]), target, propertyKey);
    }
    representation && size && converters.push(representationConverter(representation, size));
    if (minInclusive) {
      converters.push(minInclusiveConverter(minInclusive));
      Reflect.defineMetadata('min', minInclusive, target, propertyKey);
    }
    if (maxInclusive) {
      converters.push(maxInclusiveConverter(maxInclusive));
      Reflect.defineMetadata('max', maxInclusive, target, propertyKey);
    }
  }
  if (key === 'brightness' && prop.type === 'xs:unsignedByte') {
    converters.push(percentConverter);
    Reflect.defineMetadata('unit', '%', target, propertyKey);
    Reflect.defineMetadata('min', 0, target, propertyKey);
    Reflect.defineMetadata('max', 100, target, propertyKey);
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
  if (simpleType === 'xs:boolean' && !enumeration) {
    converters.push(booleanConverter);
    Reflect.defineMetadata('enum', [['Да', true], ['Нет', false]], target, propertyKey);
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
  const to = convertTo(converters);
  const from = convertFrom(converters);
  Reflect.defineMetadata('convertTo', to, target, propertyKey);
  Reflect.defineMetadata('convertFrom', from, target, propertyKey);
  attributes.get = function () {
    console.assert(Reflect.get(this, '$countRef') > 0, 'Device was released');
    let value;
    if (!this.getError(id)) {
      value = to(this.getRawValue(id));
    }
    return value;
  };
  if (isWritable) {
    attributes.set = function (newValue: any) {
      console.assert(Reflect.get(this, '$countRef') > 0, 'Device was released');
      const value = from(newValue);
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

class DevicePrototype extends EventEmitter implements IDevice {
  // will be override for an instance
  $countRef = 1;
  // private $debounceDrain = _.debounce(this.drain, 25);

  constructor(mibname: string) {
    super();
    const mibfile = getMibFile(mibname);
    const mibValidation = MibDeviceV.decode(require(mibfile));
    if (mibValidation.isLeft()) {
      throw new Error(`Invalid mib file ${mibfile} ${PathReporter.report(mibValidation)}`);
    }
    const mib = mibValidation.value;
    const { types, subroutines } = mib;
    const device = types[mib.device] as IMibDeviceType;
    Reflect.defineMetadata('mib', mibname, this);
    Reflect.defineMetadata('mibfile', mibfile, this);
    Reflect.defineMetadata('annotation', device.annotation, this);
    Reflect.defineMetadata('mibVersion', device.appinfo.mib_version, this);
    Reflect.defineMetadata('deviceType', toInt(device.appinfo.device_type), this);
    device.appinfo.loader_type && Reflect.defineMetadata('loaderType',
      toInt(device.appinfo.loader_type), this,
    );
    device.appinfo.firmware && Reflect.defineMetadata('firmware',
      device.appinfo.firmware, this,
    );
    device.appinfo.min_version && Reflect.defineMetadata('min_version',
      device.appinfo.min_version, this,
    );
    types.errorType && Reflect.defineMetadata(
      'errorType', (types.errorType as IMibType).enumeration, this);

    if (subroutines) {
      const metasubs = _.transform(
        subroutines,
        (result, sub, name) => {
          result[name] = {
            id: toInt(sub.appinfo.nms_id),
            description: sub.annotation,
            args: sub.properties && Object.entries(sub.properties)
              .map(([name, prop]) => ({
                name,
                type: getNmsType(prop.type),
                desc: prop.annotation,
              })),
          };
          return result;
        },
        {} as Record<string, ISubroutineDesc>,
      );
      Reflect.defineMetadata('subroutines', metasubs, this);
    }

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
      if (this[key] !== undefined) json[key] = this[key];
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

  /*
    public toIds(idsOrNames: (string | number)[]): number[] {
      const map = Reflect.getMetadata('map', this);
      return idsOrNames.map((idOrName) => {
        if (typeof idOrName === 'string')
      });
    }
  */
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
    debug('addref', new Error('addref').stack);
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
      .map(([id]) => Number(id))
      .filter((id => Reflect.getMetadata('isWritable', this, map[id][0])));
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

  async upload(domain: string, offset = 0, size?: number): Promise<Buffer> {
    const { connection } = this;
    try {
      if (!connection) throw new Error('disconnected');
      const reqUpload = createNmsRequestDomainUpload(this.address, domain.padEnd(8, '\0'));
      const { id, value: domainSize, status } =
        await connection.sendDatagram(reqUpload) as NmsDatagram;
      if (status !== 0) {
        // debug('<error>', status);
        throw new NibusError(status!, this, 'Request upload domain error');
      }
      const initUpload = createNmsInitiateUploadSequence(this.address, id);
      const { status: initStat } = await connection.sendDatagram(initUpload) as NmsDatagram;
      if (initStat !== 0) {
        throw new NibusError(initStat!, this, 'Initiate upload domain error');
      }
      const total = size || (domainSize - offset);
      let rest = total;
      let pos = offset;
      this.emit(
        'uploadStart',
        {
          domain,
          domainSize,
          offset,
          size: total,
        },
      );
      const bufs: Buffer[] = [];
      while (rest > 0) {
        const length = Math.min(255, rest);
        const uploadSegment = createNmsUploadSegment(this.address, id, pos, length);
        const { status: uploadStatus, value: result } =
          await connection.sendDatagram(uploadSegment) as NmsDatagram;
        if (uploadStatus !== 0) {
          throw new NibusError(uploadStatus!, this, 'Upload segment error');
        }
        if (result.data.length === 0) {
          break;
        }
        bufs.push(result.data);
        this.emit(
          'uploadData',
          {
            domain,
            pos,
            data: result.data,
          },
        );
        rest -= result.data.length;
        pos += result.data.length;
      }
      const result = Buffer.concat(bufs);
      this.emit(
        'uploadFinish',
        {
          domain,
          offset,
          data: result,
        },
      );
      return result;
    } catch (e) {
      this.emit('uploadError', e);
      throw e;
    }
  }

  async download(domain: string, buffer: Buffer, offset = 0, noTerm = false) {
    const { connection } = this;
    if (!connection) throw new Error('disconnected');
    const reqDownload = createNmsRequestDomainDownload(this.address, domain.padEnd(8, '\0'));
    const { id, value: max, status } = await connection.sendDatagram(reqDownload) as NmsDatagram;
    if (status !== 0) {
      // debug('<error>', status);
      throw new NibusError(status!, this, 'Request download domain error');
    }
    const terminate = async (err?: Error) => {
      let termStat = 0;
      if (!noTerm) {
        const req = createNmsTerminateDownloadSequence(this.address, id);
        const res = await connection.sendDatagram(req) as NmsDatagram;
        termStat = res.status!;
      }
      if (err) throw err;
      if (termStat !== 0) {
        throw new NibusError(
          termStat!,
          this,
          'Terminate download sequence error, maybe need --no-term',
        );
      }
    };
    if (buffer.length > max - offset) {
      throw new Error(`Buffer to large. Expected ${max - offset} bytes`);
    }
    const initDownload = createNmsInitiateDownloadSequence(this.address, id);
    const { status: initStat } = await connection.sendDatagram(initDownload) as NmsDatagram;
    if (initStat !== 0) {
      throw new NibusError(initStat!, this, 'Initiate download domain error');
    }
    this.emit(
      'downloadStart',
      {
        domain,
        offset,
        domainSize: max,
        size: buffer.length,
      },
    );
    const crc = crc16ccitt(buffer, 0);
    const chunkSize = NMS_MAX_DATA_LENGTH - 4;
    const chunks = chunkArray(buffer, chunkSize);
    await chunks.reduce(async (prev, chunk: Buffer, i) => {
      await prev;
      const pos = i * chunkSize + offset;
      const segmentDownload =
        createNmsDownloadSegment(this.address, id!, pos, chunk);
      const { status: downloadStat } =
        await connection.sendDatagram(segmentDownload) as NmsDatagram;
      if (downloadStat !== 0) {
        await terminate(new NibusError(downloadStat!, this, 'Download segment error'));
      }
      this.emit(
        'downloadData',
        {
          domain,
          length: chunk.length,
        },
      );
    }, Promise.resolve());
    const verify = createNmsVerifyDomainChecksum(this.address, id, offset, buffer.length, crc);
    const { status: verifyStat } = await connection.sendDatagram(verify) as NmsDatagram;
    if (verifyStat !== 0) {
      await terminate(new NibusError(verifyStat!, this, 'Download segment error'));
    }
    await terminate();
    this.emit(
      'downloadFinish',
      {
        domain,
        offset,
        size: buffer.length,
      },
    );
  }

  async execute(program: string, args?: Record<string, any>) {
    const { connection } = this;
    if (!connection) throw new Error('disconnected');
    const subroutines = Reflect.getMetadata('subroutines', this) as Record<string, ISubroutineDesc>;
    if (!subroutines || !Reflect.has(subroutines, program)) {
      throw new Error(`Unknown program ${program}`);
    }
    const subroutine = subroutines[program];
    const props: TypedValue[] = [];
    if (subroutine.args) {
      Object.entries(subroutine.args).forEach(([name, desc]) => {
        const arg = args && args[name];
        if (!arg) throw new Error(`Expected arg ${name} in program ${program}`);
        props.push([desc.type, arg]);
      });
    }
    const req = createExecuteProgramInvocation(
      this.address,
      subroutine.id,
      subroutine.notReply,
      ...props,
    );
    return connection.sendDatagram(req);
  }
}

// tslint:disable-next-line
interface DevicePrototype {
  readonly id: string;
  readonly address: Address;
  [mibProperty: string]: any;
  $countRef: number;
  [$values]: { [id: number]: any };
  [$errors]: { [id: number]: Error };
  [$dirties]: { [id: number]: boolean };
}

function findMibByType(type: number, version?: number): string | undefined {
  const conf = path.resolve(configDir || '/tmp', 'configstore', pkgName);
  const validate = ConfigV.decode(require(conf));
  if (validate.isLeft()) {
    throw new Error(`Invalid config file ${conf}
  ${PathReporter.report(validate)}`);
  }
  const { mibTypes } = validate.value;
  const mibs = mibTypes![type];
  if (mibs && mibs.length) {
    let mibType = mibs[0];
    if (version && mibs.length > 1) {
      mibType = _.findLast(mibs, ({ minVersion = 0 }) => minVersion <= version) || mibType;
    }
    return mibType.mib;
  }
  // const cacheMibs = Object.keys(mibTypesCache);
  // const cached = cacheMibs.find(mib =>
  //   Reflect.getMetadata('deviceType', mibTypesCache[mib].prototype) === type);
  // if (cached) return cached;
  // const mibs = getMibsSync();
  // return _.difference(mibs, cacheMibs).find((mibName) => {
  //   const mibfile = getMibFile(mibName);
  //   const mib: IMibDevice = require(mibfile);
  //   const { types } = mib;
  //   const device = types[mib.device] as IMibDeviceType;
  //   return toInt(device.appinfo.device_type) === type;
  // });
}

export declare interface Devices {
  on(event: 'new' | 'delete', deviceListener: (device: IDevice) => void): this;
  once(event: 'new' | 'delete', deviceListener: (device: IDevice) => void): this;
  addListener(event: 'new' | 'delete', deviceListener: (device: IDevice) => void): this;
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
      (this as any).id = timeid();
      // debug(new Error('CREATE').stack);
    }

    const prototype = new DevicePrototype(mib);
    Device.prototype = Object.create(prototype);
    (Device as any).displayName = `${mib[0].toUpperCase()}${mib.slice(1)}`;
    constructor = Device;
    mibTypesCache[mib] = constructor;
  }
  return constructor;
}

export function getMibPrototype(mib: string): Object {
  return getConstructor(mib).prototype;
}

export class Devices extends EventEmitter {
  get = (): IDevice[] => _.values(deviceMap);

  find = (address: AddressParam): IDevice | undefined => {
    const targetAddress = new Address(address);
    return deviceMap[targetAddress.toString()];
  };

  create(address: AddressParam, mib: string): IDevice;
  create(address: AddressParam, type: number, version?: number): IDevice;
  create(address: AddressParam, mibOrType: any, version?: number): IDevice {
    let mib: string | undefined;
    if (typeof mibOrType === 'number') {
      mib = findMibByType(mibOrType, version);
      if (mib === undefined) throw new Error('Unknown mib type');
    } else if (typeof mibOrType === 'string') {
      mib = String(mibOrType);
    } else {
      throw new Error(`mib or type expected, got ${mibOrType}`);
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
