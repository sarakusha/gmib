"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getMibFile = getMibFile;
exports.getMibPrototype = getMibPrototype;
exports.default = exports.Devices = exports.MibDeviceV = void 0;

require("source-map-support/register");

var _crc = require("crc");

var _debug = _interopRequireDefault(require("debug"));

var _events = require("events");

var t = _interopRequireWildcard(require("io-ts"));

var _PathReporter = require("io-ts/lib/PathReporter");

var _lodash = _interopRequireDefault(require("lodash"));

var _path = _interopRequireDefault(require("path"));

require("reflect-metadata");

var _xdgBasedir = require("xdg-basedir");

var _Address = _interopRequireDefault(require("../Address"));

var _errors = require("../errors");

var _nbconst = require("../nbconst");

var _helper = require("../nibus/helper");

var _nms = require("../nms");

var _NmsValueType = _interopRequireDefault(require("../nms/NmsValueType"));

var _common = require("../session/common");

var _timeid = _interopRequireDefault(require("../timeid"));

var _mib = require("./mib");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// import { getMibsSync } from './mib2json';
// import detector from '../service/detector';
const pkgName = '@nata/nibus.js'; // require('../../package.json').name;

const debug = (0, _debug.default)('nibus:devices');
const $values = Symbol('values');
const $errors = Symbol('errors');
const $dirties = Symbol('dirties');

function safeNumber(val) {
  const num = parseFloat(val);
  return Number.isNaN(num) || `${num}` !== val ? val : num;
}

var PrivateProps;

(function (PrivateProps) {
  PrivateProps[PrivateProps["connection"] = -1] = "connection";
})(PrivateProps || (PrivateProps = {}));

const deviceMap = {};
const mibTypesCache = {};
const MibPropertyAppInfoV = t.intersection([t.type({
  nms_id: t.union([t.string, t.Int]),
  access: t.string
}), t.partial({
  category: t.string
})]); // interface IMibPropertyAppInfo extends t.TypeOf<typeof MibPropertyAppInfoV> {}

const MibPropertyV = t.type({
  type: t.string,
  annotation: t.string,
  appinfo: MibPropertyAppInfoV
});
const MibDeviceAppInfoV = t.intersection([t.type({
  mib_version: t.string
}), t.partial({
  device_type: t.string,
  loader_type: t.string,
  firmware: t.string,
  min_version: t.string
})]);
const MibDeviceTypeV = t.type({
  annotation: t.string,
  appinfo: MibDeviceAppInfoV,
  properties: t.record(t.string, MibPropertyV)
});
const MibTypeV = t.intersection([t.type({
  base: t.string
}), t.partial({
  appinfo: t.partial({
    zero: t.string,
    units: t.string,
    precision: t.string,
    representation: t.string
  }),
  minInclusive: t.string,
  maxInclusive: t.string,
  enumeration: t.record(t.string, t.type({
    annotation: t.string
  }))
})]);
const MibSubroutineV = t.intersection([t.type({
  annotation: t.string,
  appinfo: t.intersection([t.type({
    nms_id: t.union([t.string, t.Int])
  }), t.partial({
    response: t.string
  })])
}), t.partial({
  properties: t.record(t.string, t.type({
    type: t.string,
    annotation: t.string
  }))
})]);
const SubroutineTypeV = t.type({
  annotation: t.string,
  properties: t.type({
    id: t.type({
      type: t.literal('xs:unsignedShort'),
      annotation: t.string
    })
  })
});
const MibDeviceV = t.intersection([t.type({
  device: t.string,
  types: t.record(t.string, t.union([MibDeviceTypeV, MibTypeV, SubroutineTypeV]))
}), t.partial({
  subroutines: t.record(t.string, MibSubroutineV)
})]);
exports.MibDeviceV = MibDeviceV;

function getBaseType(types, type) {
  let base = type;

  for (let superType = types[base]; superType != null; superType = types[superType.base]) {
    base = superType.base;
  }

  return base;
}

function defineMibProperty(target, key, types, prop) {
  const propertyKey = (0, _mib.validJsName)(key);
  const {
    appinfo
  } = prop;
  const id = (0, _mib.toInt)(appinfo.nms_id);
  Reflect.defineMetadata('id', id, target, propertyKey);
  const simpleType = getBaseType(types, prop.type);
  const type = types[prop.type];
  const converters = [];
  const isReadable = appinfo.access.indexOf('r') > -1;
  const isWritable = appinfo.access.indexOf('w') > -1;
  let enumeration;
  let min;
  let max;

  switch ((0, _nms.getNmsType)(simpleType)) {
    case _NmsValueType.default.Int8:
      min = -128;
      max = 127;
      break;

    case _NmsValueType.default.Int16:
      min = -32768;
      max = 32767;
      break;

    case _NmsValueType.default.Int32:
      min = -2147483648;
      max = 2147483647;
      break;

    case _NmsValueType.default.UInt8:
      min = 0;
      max = 255;
      break;

    case _NmsValueType.default.UInt16:
      min = 0;
      max = 65535;
      break;

    case _NmsValueType.default.UInt32:
      min = 0;
      max = 4294967295;
      break;
  }

  switch (simpleType) {
    case 'packed8Float':
      converters.push((0, _mib.packed8floatConverter)(type));
      break;

    case 'fixedPointNumber4':
      converters.push(_mib.fixedPointNumber4Converter);
      break;

    default:
      break;
  }

  if (key === 'brightness' && prop.type === 'xs:unsignedByte') {
    converters.push(_mib.percentConverter);
    Reflect.defineMetadata('unit', '%', target, propertyKey);
    Reflect.defineMetadata('min', 0, target, propertyKey);
    Reflect.defineMetadata('max', 100, target, propertyKey);
  } else if (isWritable) {
    if (type != null) {
      const {
        minInclusive,
        maxInclusive
      } = type;

      if (minInclusive) {
        const val = parseFloat(minInclusive);
        min = min !== undefined ? Math.max(min, val) : val;
      }

      if (maxInclusive) {
        const val = parseFloat(maxInclusive);
        max = max !== undefined ? Math.min(max, val) : val;
      }
    }

    if (min !== undefined) {
      min = (0, _mib.convertTo)(converters)(min);
      converters.push((0, _mib.minInclusiveConverter)(min));
      Reflect.defineMetadata('min', min, target, propertyKey);
    }

    if (max !== undefined) {
      max = (0, _mib.convertTo)(converters)(max);
      converters.push((0, _mib.maxInclusiveConverter)(max));
      Reflect.defineMetadata('max', max, target, propertyKey);
    }
  }

  if (type != null) {
    const {
      appinfo: info = {}
    } = type;
    enumeration = type.enumeration;
    const {
      units,
      precision,
      representation
    } = info;
    const size = (0, _mib.getIntSize)(simpleType);

    if (units) {
      converters.push((0, _mib.unitConverter)(units));
      Reflect.defineMetadata('unit', units, target, propertyKey);
    }

    precision && converters.push((0, _mib.precisionConverter)(precision));

    if (enumeration) {
      converters.push((0, _mib.enumerationConverter)(enumeration));
      Reflect.defineMetadata('enum', Object.entries(enumeration).map(([key, val]) => [val.annotation, (0, _mib.toInt)(key)]), target, propertyKey);
    }

    representation && size && converters.push((0, _mib.representationConverter)(representation, size));
  }

  if (prop.type === 'versionType') {
    converters.push(_mib.versionTypeConverter);
  }

  if (simpleType === 'xs:boolean' && !enumeration) {
    converters.push(_mib.booleanConverter);
    Reflect.defineMetadata('enum', [['Да', true], ['Нет', false]], target, propertyKey);
  }

  Reflect.defineMetadata('isWritable', isWritable, target, propertyKey);
  Reflect.defineMetadata('isReadable', isReadable, target, propertyKey);
  Reflect.defineMetadata('type', prop.type, target, propertyKey);
  Reflect.defineMetadata('simpleType', simpleType, target, propertyKey);
  Reflect.defineMetadata('displayName', prop.annotation ? prop.annotation : name, target, propertyKey);
  appinfo.category && Reflect.defineMetadata('category', appinfo.category, target, propertyKey);
  Reflect.defineMetadata('nmsType', (0, _nms.getNmsType)(simpleType), target, propertyKey);
  const attributes = {
    enumerable: isReadable
  };
  const to = (0, _mib.convertTo)(converters);
  const from = (0, _mib.convertFrom)(converters);
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
    attributes.set = function (newValue) {
      console.assert(Reflect.get(this, '$countRef') > 0, 'Device was released');
      const value = from(newValue);

      if (value === undefined || Number.isNaN(value)) {
        throw new Error(`Invalid value: ${JSON.stringify(newValue)}`);
      }

      this.setRawValue(id, value);
    };
  }

  Reflect.defineProperty(target, propertyKey, attributes);
  return [id, propertyKey];
}

function getMibFile(mibname) {
  return _path.default.resolve(__dirname, '../../mibs/', `${mibname}.mib.json`);
}

class DevicePrototype extends _events.EventEmitter {
  // will be override for an instance
  // private $debounceDrain = _.debounce(this.drain, 25);
  constructor(mibname) {
    super();

    _defineProperty(this, "$countRef", 1);

    const mibfile = getMibFile(mibname);
    const mibValidation = MibDeviceV.decode(require(mibfile));

    if (mibValidation.isLeft()) {
      throw new Error(`Invalid mib file ${mibfile} ${_PathReporter.PathReporter.report(mibValidation)}`);
    }

    const mib = mibValidation.value;
    const {
      types,
      subroutines
    } = mib;
    const device = types[mib.device];
    Reflect.defineMetadata('mib', mibname, this);
    Reflect.defineMetadata('mibfile', mibfile, this);
    Reflect.defineMetadata('annotation', device.annotation, this);
    Reflect.defineMetadata('mibVersion', device.appinfo.mib_version, this);
    Reflect.defineMetadata('deviceType', (0, _mib.toInt)(device.appinfo.device_type), this);
    device.appinfo.loader_type && Reflect.defineMetadata('loaderType', (0, _mib.toInt)(device.appinfo.loader_type), this);
    device.appinfo.firmware && Reflect.defineMetadata('firmware', device.appinfo.firmware, this);
    device.appinfo.min_version && Reflect.defineMetadata('min_version', device.appinfo.min_version, this);
    types.errorType && Reflect.defineMetadata('errorType', types.errorType.enumeration, this);

    if (subroutines) {
      const metasubs = _lodash.default.transform(subroutines, (result, sub, name) => {
        result[name] = {
          id: (0, _mib.toInt)(sub.appinfo.nms_id),
          description: sub.annotation,
          args: sub.properties && Object.entries(sub.properties).map(([name, prop]) => ({
            name,
            type: (0, _nms.getNmsType)(prop.type),
            desc: prop.annotation
          }))
        };
        return result;
      }, {});

      Reflect.defineMetadata('subroutines', metasubs, this);
    } // TODO: category
    // const mibCategory = _.find(detector.detection!.mibCategories, { mib: mibname });
    // if (mibCategory) {
    //   const { category, disableBatchReading } = mibCategory;
    //   Reflect.defineMetadata('category', category, this);
    //   Reflect.defineMetadata('disableBatchReading', !!disableBatchReading, this);
    // }


    const keys = Reflect.ownKeys(device.properties);
    Reflect.defineMetadata('mibProperties', keys.map(_mib.validJsName), this);
    const map = {};
    keys.forEach(key => {
      const [id, propName] = defineMibProperty(this, key, types, device.properties[key]);

      if (!map[id]) {
        map[id] = [propName];
      } else {
        map[id].push(propName);
      }
    });
    Reflect.defineMetadata('map', map, this);
  }

  get connection() {
    const {
      [$values]: values
    } = this;
    return values[PrivateProps.connection];
  }

  set connection(value) {
    const {
      [$values]: values
    } = this;
    const prev = values[PrivateProps.connection];
    if (prev === value) return;
    values[PrivateProps.connection] = value;
    /**
     * Device connected event
     * @event IDevice#connected
     * @event IDevice#disconnected
     */

    this.emit(value != null ? 'connected' : 'disconnected'); // if (value) {
    //   this.drain().catch(() => {});
    // }
  } // noinspection JSUnusedGlobalSymbols


  toJSON() {
    const json = {
      mib: Reflect.getMetadata('mib', this)
    };
    const keys = Reflect.getMetadata('mibProperties', this);
    keys.forEach(key => {
      if (this[key] !== undefined) json[key] = this[key];
    });
    json.address = this.address.toString();
    return json;
  }

  getId(idOrName) {
    let id;

    if (typeof idOrName === 'string') {
      id = Reflect.getMetadata('id', this, idOrName);
      if (Number.isInteger(id)) return id;
      id = (0, _mib.toInt)(idOrName);
    } else {
      id = idOrName;
    }

    const map = Reflect.getMetadata('map', this);

    if (!Reflect.has(map, id)) {
      throw new Error(`Unknown property ${idOrName}`);
    }

    return id;
  }

  getName(idOrName) {
    const map = Reflect.getMetadata('map', this);

    if (Reflect.has(map, idOrName)) {
      return map[idOrName][0];
    }

    const keys = Reflect.getMetadata('mibProperties', this);
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


  getRawValue(idOrName) {
    const id = this.getId(idOrName);
    const {
      [$values]: values
    } = this;
    return values[id];
  }

  setRawValue(idOrName, value, isDirty = true) {
    // debug(`setRawValue(${idOrName}, ${JSON.stringify(safeNumber(value))})`);
    const id = this.getId(idOrName);
    const {
      [$values]: values,
      [$errors]: errors
    } = this;
    const newVal = safeNumber(value);

    if (newVal !== values[id] || errors[id]) {
      values[id] = newVal;
      delete errors[id];
      this.setDirty(id, isDirty);
    }
  }

  getError(idOrName) {
    const id = this.getId(idOrName);
    const {
      [$errors]: errors
    } = this;
    return errors[id];
  }

  setError(idOrName, error) {
    const id = this.getId(idOrName);
    const {
      [$errors]: errors
    } = this;

    if (error != null) {
      errors[id] = error;
    } else {
      delete errors[id];
    }
  }

  isDirty(idOrName) {
    const id = this.getId(idOrName);
    const {
      [$dirties]: dirties
    } = this;
    return !!dirties[id];
  }

  setDirty(idOrName, isDirty = true) {
    const id = this.getId(idOrName);
    const map = Reflect.getMetadata('map', this);
    const {
      [$dirties]: dirties
    } = this;

    if (isDirty) {
      dirties[id] = true; // TODO: implement autosave
      // this.write(id).catch(() => {});
    } else {
      delete dirties[id];
    }
    /**
     * @event IDevice#changed
     * @event IDevice#changing
     */


    const names = map[id] || [];
    this.emit(isDirty ? 'changing' : 'changed', {
      id,
      names
    });
  }

  addref() {
    this.$countRef += 1;
    debug('addref', new Error('addref').stack);
    return this.$countRef;
  }

  release() {
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

  drain() {
    debug(`drain [${this.address}]`);
    const {
      [$dirties]: dirties
    } = this;
    const ids = Object.keys(dirties).map(Number).filter(id => dirties[id]);
    return ids.length > 0 ? this.write(...ids).catch(() => []) : Promise.resolve([]);
  }

  writeAll() {
    const {
      [$values]: values
    } = this;
    const map = Reflect.getMetadata('map', this);
    const ids = Object.entries(values).filter(([, value]) => value != null).map(([id]) => Number(id)).filter(id => Reflect.getMetadata('isWritable', this, map[id][0]));
    return ids.length > 0 ? this.write(...ids) : Promise.resolve([]);
  }

  write(...ids) {
    const {
      connection
    } = this;
    if (!connection) return Promise.reject(`${this.address} is disconnected`);

    if (ids.length === 0) {
      return this.writeAll();
    }

    debug(`writing ${ids.join()} to [${this.address}]`);
    const map = Reflect.getMetadata('map', this);
    const requests = ids.reduce((acc, id) => {
      const [name] = map[id];

      if (!name) {
        debug(`Unknown id: ${id} for ${Reflect.getMetadata('mib', this)}`);
      } else {
        acc.push((0, _nms.createNmsWrite)(this.address, id, Reflect.getMetadata('nmsType', this, name), this.getRawValue(id)));
      }

      return acc;
    }, []);
    return Promise.all(requests.map(datagram => connection.sendDatagram(datagram).then(response => {
      const {
        status
      } = response;

      if (status === 0) {
        this.setDirty(datagram.id, false);
        return datagram.id;
      }

      this.setError(datagram.id, new _errors.NibusError(status, this));
      return -1;
    }, reason => {
      this.setError(datagram.id, reason);
      return -1;
    }))).then(ids => ids.filter(id => id > 0));
  }

  writeValues(source, strong = true) {
    try {
      const ids = Object.keys(source).map(name => this.getId(name));
      if (ids.length === 0) return Promise.reject(new TypeError('value is empty'));
      Object.assign(this, source);
      return this.write(...ids).then(written => {
        if (written.length === 0 || strong && written.length !== ids.length) {
          throw this.getError(ids[0]);
        }

        return written;
      });
    } catch (err) {
      return Promise.reject(err);
    }
  }

  readAll() {
    if (this.$read) return this.$read;
    const map = Reflect.getMetadata('map', this);
    const ids = Object.entries(map).filter(([, names]) => Reflect.getMetadata('isReadable', this, names[0])).map(([id]) => Number(id)).sort();
    this.$read = ids.length > 0 ? this.read(...ids) : Promise.resolve([]);

    const clear = () => delete this.$read;

    return this.$read.finally(clear);
  }

  async read(...ids) {
    const {
      connection
    } = this;
    if (!connection) return Promise.reject('disconnected');
    if (ids.length === 0) return this.readAll(); // debug(`read ${ids.join()} from [${this.address}]`);

    const disableBatchReading = Reflect.getMetadata('disableBatchReading', this);
    const map = Reflect.getMetadata('map', this);
    const chunks = (0, _helper.chunkArray)(ids, disableBatchReading ? 1 : 21);
    debug(`read [${chunks.map(chunk => `[${chunk.join()}]`).join()}] from [${this.address}]`);
    const requests = chunks.map(chunk => (0, _nms.createNmsRead)(this.address, ...chunk));
    return requests.reduce(async (promise, datagram) => {
      const result = await promise;
      const response = await connection.sendDatagram(datagram);
      const datagrams = Array.isArray(response) ? response : [response];
      datagrams.forEach(({
        id,
        value,
        status
      }) => {
        if (status === 0) {
          this.setRawValue(id, value, false);
        } else {
          this.setError(id, new _errors.NibusError(status, this));
        }

        const names = map[id];
        console.assert(names && names.length > 0, `Invalid id ${id}`);
        names.forEach(propName => {
          result[propName] = status === 0 ? this[propName] : {
            error: (this.getError(id) || {}).message || 'error'
          };
        });
      });
      return result;
    }, Promise.resolve({}));
  }

  async upload(domain, offset = 0, size) {
    const {
      connection
    } = this;

    try {
      if (!connection) throw new Error('disconnected');
      const reqUpload = (0, _nms.createNmsRequestDomainUpload)(this.address, domain.padEnd(8, '\0'));
      const {
        id,
        value: domainSize,
        status
      } = await connection.sendDatagram(reqUpload);

      if (status !== 0) {
        // debug('<error>', status);
        throw new _errors.NibusError(status, this, 'Request upload domain error');
      }

      const initUpload = (0, _nms.createNmsInitiateUploadSequence)(this.address, id);
      const {
        status: initStat
      } = await connection.sendDatagram(initUpload);

      if (initStat !== 0) {
        throw new _errors.NibusError(initStat, this, 'Initiate upload domain error');
      }

      const total = size || domainSize - offset;
      let rest = total;
      let pos = offset;
      this.emit('uploadStart', {
        domain,
        domainSize,
        offset,
        size: total
      });
      const bufs = [];

      while (rest > 0) {
        const length = Math.min(255, rest);
        const uploadSegment = (0, _nms.createNmsUploadSegment)(this.address, id, pos, length);
        const {
          status: uploadStatus,
          value: result
        } = await connection.sendDatagram(uploadSegment);

        if (uploadStatus !== 0) {
          throw new _errors.NibusError(uploadStatus, this, 'Upload segment error');
        }

        if (result.data.length === 0) {
          break;
        }

        bufs.push(result.data);
        this.emit('uploadData', {
          domain,
          pos,
          data: result.data
        });
        rest -= result.data.length;
        pos += result.data.length;
      }

      const result = Buffer.concat(bufs);
      this.emit('uploadFinish', {
        domain,
        offset,
        data: result
      });
      return result;
    } catch (e) {
      this.emit('uploadError', e);
      throw e;
    }
  }

  async download(domain, buffer, offset = 0, noTerm = false) {
    const {
      connection
    } = this;
    if (!connection) throw new Error('disconnected');
    const reqDownload = (0, _nms.createNmsRequestDomainDownload)(this.address, domain.padEnd(8, '\0'));
    const {
      id,
      value: max,
      status
    } = await connection.sendDatagram(reqDownload);

    if (status !== 0) {
      // debug('<error>', status);
      throw new _errors.NibusError(status, this, 'Request download domain error');
    }

    const terminate = async err => {
      let termStat = 0;

      if (!noTerm) {
        const req = (0, _nms.createNmsTerminateDownloadSequence)(this.address, id);
        const res = await connection.sendDatagram(req);
        termStat = res.status;
      }

      if (err) throw err;

      if (termStat !== 0) {
        throw new _errors.NibusError(termStat, this, 'Terminate download sequence error, maybe need --no-term');
      }
    };

    if (buffer.length > max - offset) {
      throw new Error(`Buffer to large. Expected ${max - offset} bytes`);
    }

    const initDownload = (0, _nms.createNmsInitiateDownloadSequence)(this.address, id);
    const {
      status: initStat
    } = await connection.sendDatagram(initDownload);

    if (initStat !== 0) {
      throw new _errors.NibusError(initStat, this, 'Initiate download domain error');
    }

    this.emit('downloadStart', {
      domain,
      offset,
      domainSize: max,
      size: buffer.length
    });
    const crc = (0, _crc.crc16ccitt)(buffer, 0);
    const chunkSize = _nbconst.NMS_MAX_DATA_LENGTH - 4;
    const chunks = (0, _helper.chunkArray)(buffer, chunkSize);
    await chunks.reduce(async (prev, chunk, i) => {
      await prev;
      const pos = i * chunkSize + offset;
      const segmentDownload = (0, _nms.createNmsDownloadSegment)(this.address, id, pos, chunk);
      const {
        status: downloadStat
      } = await connection.sendDatagram(segmentDownload);

      if (downloadStat !== 0) {
        await terminate(new _errors.NibusError(downloadStat, this, 'Download segment error'));
      }

      this.emit('downloadData', {
        domain,
        length: chunk.length
      });
    }, Promise.resolve());
    const verify = (0, _nms.createNmsVerifyDomainChecksum)(this.address, id, offset, buffer.length, crc);
    const {
      status: verifyStat
    } = await connection.sendDatagram(verify);

    if (verifyStat !== 0) {
      await terminate(new _errors.NibusError(verifyStat, this, 'Download segment error'));
    }

    await terminate();
    this.emit('downloadFinish', {
      domain,
      offset,
      size: buffer.length
    });
  }

  async execute(program, args) {
    const {
      connection
    } = this;
    if (!connection) throw new Error('disconnected');
    const subroutines = Reflect.getMetadata('subroutines', this);

    if (!subroutines || !Reflect.has(subroutines, program)) {
      throw new Error(`Unknown program ${program}`);
    }

    const subroutine = subroutines[program];
    const props = [];

    if (subroutine.args) {
      Object.entries(subroutine.args).forEach(([name, desc]) => {
        const arg = args && args[name];
        if (!arg) throw new Error(`Expected arg ${name} in program ${program}`);
        props.push([desc.type, arg]);
      });
    }

    const req = (0, _nms.createExecuteProgramInvocation)(this.address, subroutine.id, subroutine.notReply, ...props);
    return connection.sendDatagram(req);
  }

} // tslint:disable-next-line


function findMibByType(type, version) {
  const conf = _path.default.resolve(_xdgBasedir.config || '/tmp', 'configstore', pkgName);

  const validate = _common.ConfigV.decode(require(conf));

  if (validate.isLeft()) {
    throw new Error(`Invalid config file ${conf}
  ${_PathReporter.PathReporter.report(validate)}`);
  }

  const {
    mibTypes
  } = validate.value;
  const mibs = mibTypes[type];

  if (mibs && mibs.length) {
    let mibType = mibs[0];

    if (version && mibs.length > 1) {
      mibType = _lodash.default.findLast(mibs, ({
        minVersion = 0
      }) => minVersion <= version) || mibType;
    }

    return mibType.mib;
  } // const cacheMibs = Object.keys(mibTypesCache);
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

function getConstructor(mib) {
  let constructor = mibTypesCache[mib];

  if (!constructor) {
    // tslint:disable-next-line
    function Device(address) {
      _events.EventEmitter.apply(this);

      this[$values] = {};
      this[$errors] = {};
      this[$dirties] = {};
      Reflect.defineProperty(this, 'address', (0, _mib.withValue)(address));
      this.$countRef = 1;
      this.id = (0, _timeid.default)(); // debug(new Error('CREATE').stack);
    }

    const prototype = new DevicePrototype(mib);
    Device.prototype = Object.create(prototype);
    Device.displayName = `${mib[0].toUpperCase()}${mib.slice(1)}`;
    constructor = Device;
    mibTypesCache[mib] = constructor;
  }

  return constructor;
}

function getMibPrototype(mib) {
  return getConstructor(mib).prototype;
}

class Devices extends _events.EventEmitter {
  constructor(...args) {
    super(...args);

    _defineProperty(this, "get", () => _lodash.default.values(deviceMap));

    _defineProperty(this, "find", address => {
      const targetAddress = new _Address.default(address);
      return deviceMap[targetAddress.toString()];
    });
  }

  create(address, mibOrType, version) {
    let mib;

    if (typeof mibOrType === 'number') {
      mib = findMibByType(mibOrType, version);
      if (mib === undefined) throw new Error('Unknown mib type');
    } else if (typeof mibOrType === 'string') {
      mib = String(mibOrType);
    } else {
      throw new Error(`mib or type expected, got ${mibOrType}`);
    }

    const targetAddress = new _Address.default(address);
    let device = deviceMap[targetAddress.toString()];

    if (device) {
      console.assert(Reflect.getMetadata('mib', device) === mib, `mibs are different, expected ${mib}`);
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

exports.Devices = Devices;
const devices = new Devices();
var _default = devices;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taWIvZGV2aWNlcy50cyJdLCJuYW1lcyI6WyJwa2dOYW1lIiwiZGVidWciLCIkdmFsdWVzIiwiU3ltYm9sIiwiJGVycm9ycyIsIiRkaXJ0aWVzIiwic2FmZU51bWJlciIsInZhbCIsIm51bSIsInBhcnNlRmxvYXQiLCJOdW1iZXIiLCJpc05hTiIsIlByaXZhdGVQcm9wcyIsImRldmljZU1hcCIsIm1pYlR5cGVzQ2FjaGUiLCJNaWJQcm9wZXJ0eUFwcEluZm9WIiwidCIsImludGVyc2VjdGlvbiIsInR5cGUiLCJubXNfaWQiLCJ1bmlvbiIsInN0cmluZyIsIkludCIsImFjY2VzcyIsInBhcnRpYWwiLCJjYXRlZ29yeSIsIk1pYlByb3BlcnR5ViIsImFubm90YXRpb24iLCJhcHBpbmZvIiwiTWliRGV2aWNlQXBwSW5mb1YiLCJtaWJfdmVyc2lvbiIsImRldmljZV90eXBlIiwibG9hZGVyX3R5cGUiLCJmaXJtd2FyZSIsIm1pbl92ZXJzaW9uIiwiTWliRGV2aWNlVHlwZVYiLCJwcm9wZXJ0aWVzIiwicmVjb3JkIiwiTWliVHlwZVYiLCJiYXNlIiwiemVybyIsInVuaXRzIiwicHJlY2lzaW9uIiwicmVwcmVzZW50YXRpb24iLCJtaW5JbmNsdXNpdmUiLCJtYXhJbmNsdXNpdmUiLCJlbnVtZXJhdGlvbiIsIk1pYlN1YnJvdXRpbmVWIiwicmVzcG9uc2UiLCJTdWJyb3V0aW5lVHlwZVYiLCJpZCIsImxpdGVyYWwiLCJNaWJEZXZpY2VWIiwiZGV2aWNlIiwidHlwZXMiLCJzdWJyb3V0aW5lcyIsImdldEJhc2VUeXBlIiwic3VwZXJUeXBlIiwiZGVmaW5lTWliUHJvcGVydHkiLCJ0YXJnZXQiLCJrZXkiLCJwcm9wIiwicHJvcGVydHlLZXkiLCJSZWZsZWN0IiwiZGVmaW5lTWV0YWRhdGEiLCJzaW1wbGVUeXBlIiwiY29udmVydGVycyIsImlzUmVhZGFibGUiLCJpbmRleE9mIiwiaXNXcml0YWJsZSIsIm1pbiIsIm1heCIsIk5tc1ZhbHVlVHlwZSIsIkludDgiLCJJbnQxNiIsIkludDMyIiwiVUludDgiLCJVSW50MTYiLCJVSW50MzIiLCJwdXNoIiwiZml4ZWRQb2ludE51bWJlcjRDb252ZXJ0ZXIiLCJwZXJjZW50Q29udmVydGVyIiwidW5kZWZpbmVkIiwiTWF0aCIsImluZm8iLCJzaXplIiwiT2JqZWN0IiwiZW50cmllcyIsIm1hcCIsInZlcnNpb25UeXBlQ29udmVydGVyIiwiYm9vbGVhbkNvbnZlcnRlciIsIm5hbWUiLCJhdHRyaWJ1dGVzIiwiZW51bWVyYWJsZSIsInRvIiwiZnJvbSIsImdldCIsImNvbnNvbGUiLCJhc3NlcnQiLCJ2YWx1ZSIsImdldEVycm9yIiwiZ2V0UmF3VmFsdWUiLCJzZXQiLCJuZXdWYWx1ZSIsIkVycm9yIiwiSlNPTiIsInN0cmluZ2lmeSIsInNldFJhd1ZhbHVlIiwiZGVmaW5lUHJvcGVydHkiLCJnZXRNaWJGaWxlIiwibWlibmFtZSIsInBhdGgiLCJyZXNvbHZlIiwiX19kaXJuYW1lIiwiRGV2aWNlUHJvdG90eXBlIiwiRXZlbnRFbWl0dGVyIiwiY29uc3RydWN0b3IiLCJtaWJmaWxlIiwibWliVmFsaWRhdGlvbiIsImRlY29kZSIsInJlcXVpcmUiLCJpc0xlZnQiLCJQYXRoUmVwb3J0ZXIiLCJyZXBvcnQiLCJtaWIiLCJlcnJvclR5cGUiLCJtZXRhc3VicyIsIl8iLCJ0cmFuc2Zvcm0iLCJyZXN1bHQiLCJzdWIiLCJkZXNjcmlwdGlvbiIsImFyZ3MiLCJkZXNjIiwia2V5cyIsIm93bktleXMiLCJ2YWxpZEpzTmFtZSIsImZvckVhY2giLCJwcm9wTmFtZSIsImNvbm5lY3Rpb24iLCJ2YWx1ZXMiLCJwcmV2IiwiZW1pdCIsInRvSlNPTiIsImpzb24iLCJnZXRNZXRhZGF0YSIsImFkZHJlc3MiLCJ0b1N0cmluZyIsImdldElkIiwiaWRPck5hbWUiLCJpc0ludGVnZXIiLCJoYXMiLCJnZXROYW1lIiwiaW5jbHVkZXMiLCJpc0RpcnR5IiwiZXJyb3JzIiwibmV3VmFsIiwic2V0RGlydHkiLCJzZXRFcnJvciIsImVycm9yIiwiZGlydGllcyIsIm5hbWVzIiwiYWRkcmVmIiwiJGNvdW50UmVmIiwic3RhY2siLCJyZWxlYXNlIiwiZGV2aWNlcyIsImRyYWluIiwiaWRzIiwiZmlsdGVyIiwibGVuZ3RoIiwid3JpdGUiLCJjYXRjaCIsIlByb21pc2UiLCJ3cml0ZUFsbCIsInJlamVjdCIsImpvaW4iLCJyZXF1ZXN0cyIsInJlZHVjZSIsImFjYyIsImFsbCIsImRhdGFncmFtIiwic2VuZERhdGFncmFtIiwidGhlbiIsInN0YXR1cyIsIk5pYnVzRXJyb3IiLCJyZWFzb24iLCJ3cml0ZVZhbHVlcyIsInNvdXJjZSIsInN0cm9uZyIsIlR5cGVFcnJvciIsImFzc2lnbiIsIndyaXR0ZW4iLCJlcnIiLCJyZWFkQWxsIiwiJHJlYWQiLCJzb3J0IiwicmVhZCIsImNsZWFyIiwiZmluYWxseSIsImRpc2FibGVCYXRjaFJlYWRpbmciLCJjaHVua3MiLCJjaHVuayIsInByb21pc2UiLCJkYXRhZ3JhbXMiLCJBcnJheSIsImlzQXJyYXkiLCJtZXNzYWdlIiwidXBsb2FkIiwiZG9tYWluIiwib2Zmc2V0IiwicmVxVXBsb2FkIiwicGFkRW5kIiwiZG9tYWluU2l6ZSIsImluaXRVcGxvYWQiLCJpbml0U3RhdCIsInRvdGFsIiwicmVzdCIsInBvcyIsImJ1ZnMiLCJ1cGxvYWRTZWdtZW50IiwidXBsb2FkU3RhdHVzIiwiZGF0YSIsIkJ1ZmZlciIsImNvbmNhdCIsImUiLCJkb3dubG9hZCIsImJ1ZmZlciIsIm5vVGVybSIsInJlcURvd25sb2FkIiwidGVybWluYXRlIiwidGVybVN0YXQiLCJyZXEiLCJyZXMiLCJpbml0RG93bmxvYWQiLCJjcmMiLCJjaHVua1NpemUiLCJOTVNfTUFYX0RBVEFfTEVOR1RIIiwiaSIsInNlZ21lbnREb3dubG9hZCIsImRvd25sb2FkU3RhdCIsInZlcmlmeSIsInZlcmlmeVN0YXQiLCJleGVjdXRlIiwicHJvZ3JhbSIsInN1YnJvdXRpbmUiLCJwcm9wcyIsImFyZyIsIm5vdFJlcGx5IiwiZmluZE1pYkJ5VHlwZSIsInZlcnNpb24iLCJjb25mIiwiY29uZmlnRGlyIiwidmFsaWRhdGUiLCJDb25maWdWIiwibWliVHlwZXMiLCJtaWJzIiwibWliVHlwZSIsImZpbmRMYXN0IiwibWluVmVyc2lvbiIsImdldENvbnN0cnVjdG9yIiwiRGV2aWNlIiwiYXBwbHkiLCJwcm90b3R5cGUiLCJjcmVhdGUiLCJkaXNwbGF5TmFtZSIsInRvVXBwZXJDYXNlIiwic2xpY2UiLCJnZXRNaWJQcm90b3R5cGUiLCJEZXZpY2VzIiwidGFyZ2V0QWRkcmVzcyIsIkFkZHJlc3MiLCJtaWJPclR5cGUiLCJTdHJpbmciLCJjb25zdHJ1Y3QiLCJpc0VtcHR5IiwicHJvY2VzcyIsIm5leHRUaWNrIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQVdBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUVBOztBQUNBOztBQWdCQTs7QUFDQTs7QUFDQTs7QUFDQTs7Ozs7Ozs7QUFvQkE7QUFDQTtBQUVBLE1BQU1BLE9BQU8sR0FBRyxnQkFBaEIsQyxDQUFrQzs7QUFFbEMsTUFBTUMsS0FBSyxHQUFHLG9CQUFhLGVBQWIsQ0FBZDtBQUVBLE1BQU1DLE9BQU8sR0FBR0MsTUFBTSxDQUFDLFFBQUQsQ0FBdEI7QUFDQSxNQUFNQyxPQUFPLEdBQUdELE1BQU0sQ0FBQyxRQUFELENBQXRCO0FBQ0EsTUFBTUUsUUFBUSxHQUFHRixNQUFNLENBQUMsU0FBRCxDQUF2Qjs7QUFFQSxTQUFTRyxVQUFULENBQW9CQyxHQUFwQixFQUE4QjtBQUM1QixRQUFNQyxHQUFHLEdBQUdDLFVBQVUsQ0FBQ0YsR0FBRCxDQUF0QjtBQUNBLFNBQVFHLE1BQU0sQ0FBQ0MsS0FBUCxDQUFhSCxHQUFiLEtBQXNCLEdBQUVBLEdBQUksRUFBUCxLQUFhRCxHQUFuQyxHQUEwQ0EsR0FBMUMsR0FBZ0RDLEdBQXZEO0FBQ0Q7O0lBRUlJLFk7O1dBQUFBLFk7QUFBQUEsRUFBQUEsWSxDQUFBQSxZO0dBQUFBLFksS0FBQUEs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InNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IChjKSAyMDE5LiBPT08gTmF0YS1JbmZvXG4gKiBAYXV0aG9yIEFuZHJlaSBTYXJha2VldiA8YXZzQG5hdGEtaW5mby5ydT5cbiAqXG4gKiBUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgXCJAbmF0YVwiIHByb2plY3QuXG4gKiBGb3IgdGhlIGZ1bGwgY29weXJpZ2h0IGFuZCBsaWNlbnNlIGluZm9ybWF0aW9uLCBwbGVhc2Ugdmlld1xuICogdGhlIEVVTEEgZmlsZSB0aGF0IHdhcyBkaXN0cmlidXRlZCB3aXRoIHRoaXMgc291cmNlIGNvZGUuXG4gKi9cblxuLyogdHNsaW50OmRpc2FibGU6dmFyaWFibGUtbmFtZSAqL1xuaW1wb3J0IHsgY3JjMTZjY2l0dCB9IGZyb20gJ2NyYyc7XG5pbXBvcnQgZGVidWdGYWN0b3J5IGZyb20gJ2RlYnVnJztcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJ2lvLXRzJztcbmltcG9ydCB7IFBhdGhSZXBvcnRlciB9IGZyb20gJ2lvLXRzL2xpYi9QYXRoUmVwb3J0ZXInO1xuaW1wb3J0IF8gZnJvbSAnbG9kYXNoJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICdyZWZsZWN0LW1ldGFkYXRhJztcbmltcG9ydCB7IGNvbmZpZyBhcyBjb25maWdEaXIgfSBmcm9tICd4ZGctYmFzZWRpcic7XG5pbXBvcnQgQWRkcmVzcywgeyBBZGRyZXNzUGFyYW0gfSBmcm9tICcuLi9BZGRyZXNzJztcbmltcG9ydCB7IE5pYnVzRXJyb3IgfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IHsgTk1TX01BWF9EQVRBX0xFTkdUSCB9IGZyb20gJy4uL25iY29uc3QnO1xuaW1wb3J0IHsgTmlidXNDb25uZWN0aW9uIH0gZnJvbSAnLi4vbmlidXMnO1xuaW1wb3J0IHsgY2h1bmtBcnJheSB9IGZyb20gJy4uL25pYnVzL2hlbHBlcic7XG5pbXBvcnQge1xuICBjcmVhdGVFeGVjdXRlUHJvZ3JhbUludm9jYXRpb24sXG4gIGNyZWF0ZU5tc0Rvd25sb2FkU2VnbWVudCxcbiAgY3JlYXRlTm1zSW5pdGlhdGVEb3dubG9hZFNlcXVlbmNlLFxuICBjcmVhdGVObXNJbml0aWF0ZVVwbG9hZFNlcXVlbmNlLFxuICBjcmVhdGVObXNSZWFkLFxuICBjcmVhdGVObXNSZXF1ZXN0RG9tYWluRG93bmxvYWQsXG4gIGNyZWF0ZU5tc1JlcXVlc3REb21haW5VcGxvYWQsXG4gIGNyZWF0ZU5tc1Rlcm1pbmF0ZURvd25sb2FkU2VxdWVuY2UsXG4gIGNyZWF0ZU5tc1VwbG9hZFNlZ21lbnQsXG4gIGNyZWF0ZU5tc1ZlcmlmeURvbWFpbkNoZWNrc3VtLFxuICBjcmVhdGVObXNXcml0ZSxcbiAgZ2V0Tm1zVHlwZSxcbiAgVHlwZWRWYWx1ZSxcbn0gZnJvbSAnLi4vbm1zJztcbmltcG9ydCBObXNEYXRhZ3JhbSBmcm9tICcuLi9ubXMvTm1zRGF0YWdyYW0nO1xuaW1wb3J0IE5tc1ZhbHVlVHlwZSBmcm9tICcuLi9ubXMvTm1zVmFsdWVUeXBlJztcbmltcG9ydCB7IENvbmZpZ1YgfSBmcm9tICcuLi9zZXNzaW9uL2NvbW1vbic7XG5pbXBvcnQgdGltZWlkIGZyb20gJy4uL3RpbWVpZCc7XG5pbXBvcnQge1xuICBib29sZWFuQ29udmVydGVyLFxuICBjb252ZXJ0RnJvbSxcbiAgY29udmVydFRvLFxuICBlbnVtZXJhdGlvbkNvbnZlcnRlcixcbiAgZml4ZWRQb2ludE51bWJlcjRDb252ZXJ0ZXIsXG4gIGdldEludFNpemUsXG4gIElDb252ZXJ0ZXIsXG4gIG1heEluY2x1c2l2ZUNvbnZlcnRlcixcbiAgbWluSW5jbHVzaXZlQ29udmVydGVyLFxuICBwYWNrZWQ4ZmxvYXRDb252ZXJ0ZXIsXG4gIHBlcmNlbnRDb252ZXJ0ZXIsXG4gIHByZWNpc2lvbkNvbnZlcnRlcixcbiAgcmVwcmVzZW50YXRpb25Db252ZXJ0ZXIsXG4gIHRvSW50LFxuICB1bml0Q29udmVydGVyLFxuICB2YWxpZEpzTmFtZSxcbiAgdmVyc2lvblR5cGVDb252ZXJ0ZXIsXG4gIHdpdGhWYWx1ZSxcbn0gZnJvbSAnLi9taWInO1xuLy8gaW1wb3J0IHsgZ2V0TWlic1N5bmMgfSBmcm9tICcuL21pYjJqc29uJztcbi8vIGltcG9ydCBkZXRlY3RvciBmcm9tICcuLi9zZXJ2aWNlL2RldGVjdG9yJztcblxuY29uc3QgcGtnTmFtZSA9ICdAbmF0YS9uaWJ1cy5qcyc7IC8vIHJlcXVpcmUoJy4uLy4uL3BhY2thZ2UuanNvbicpLm5hbWU7XG5cbmNvbnN0IGRlYnVnID0gZGVidWdGYWN0b3J5KCduaWJ1czpkZXZpY2VzJyk7XG5cbmNvbnN0ICR2YWx1ZXMgPSBTeW1ib2woJ3ZhbHVlcycpO1xuY29uc3QgJGVycm9ycyA9IFN5bWJvbCgnZXJyb3JzJyk7XG5jb25zdCAkZGlydGllcyA9IFN5bWJvbCgnZGlydGllcycpO1xuXG5mdW5jdGlvbiBzYWZlTnVtYmVyKHZhbDogYW55KSB7XG4gIGNvbnN0IG51bSA9IHBhcnNlRmxvYXQodmFsKTtcbiAgcmV0dXJuIChOdW1iZXIuaXNOYU4obnVtKSB8fCBgJHtudW19YCAhPT0gdmFsKSA/IHZhbCA6IG51bTtcbn1cblxuZW51bSBQcml2YXRlUHJvcHMge1xuICBjb25uZWN0aW9uID0gLTEsXG59XG5cbmNvbnN0IGRldmljZU1hcDogeyBbYWRkcmVzczogc3RyaW5nXTogRGV2aWNlUHJvdG90eXBlIH0gPSB7fTtcblxuY29uc3QgbWliVHlwZXNDYWNoZTogeyBbbWlibmFtZTogc3RyaW5nXTogRnVuY3Rpb24gfSA9IHt9O1xuXG5jb25zdCBNaWJQcm9wZXJ0eUFwcEluZm9WID0gdC5pbnRlcnNlY3Rpb24oW1xuICB0LnR5cGUoe1xuICAgIG5tc19pZDogdC51bmlvbihbdC5zdHJpbmcsIHQuSW50XSksXG4gICAgYWNjZXNzOiB0LnN0cmluZyxcbiAgfSksXG4gIHQucGFydGlhbCh7XG4gICAgY2F0ZWdvcnk6IHQuc3RyaW5nLFxuICB9KSxcbl0pO1xuXG4vLyBpbnRlcmZhY2UgSU1pYlByb3BlcnR5QXBwSW5mbyBleHRlbmRzIHQuVHlwZU9mPHR5cGVvZiBNaWJQcm9wZXJ0eUFwcEluZm9WPiB7fVxuXG5jb25zdCBNaWJQcm9wZXJ0eVYgPSB0LnR5cGUoe1xuICB0eXBlOiB0LnN0cmluZyxcbiAgYW5ub3RhdGlvbjogdC5zdHJpbmcsXG4gIGFwcGluZm86IE1pYlByb3BlcnR5QXBwSW5mb1YsXG59KTtcblxuaW50ZXJmYWNlIElNaWJQcm9wZXJ0eSBleHRlbmRzIHQuVHlwZU9mPHR5cGVvZiBNaWJQcm9wZXJ0eVY+IHtcbiAgLy8gYXBwaW5mbzogSU1pYlByb3BlcnR5QXBwSW5mbztcbn1cblxuY29uc3QgTWliRGV2aWNlQXBwSW5mb1YgPSB0LmludGVyc2VjdGlvbihbXG4gIHQudHlwZSh7XG4gICAgbWliX3ZlcnNpb246IHQuc3RyaW5nLFxuICB9KSxcbiAgdC5wYXJ0aWFsKHtcbiAgICBkZXZpY2VfdHlwZTogdC5zdHJpbmcsXG4gICAgbG9hZGVyX3R5cGU6IHQuc3RyaW5nLFxuICAgIGZpcm13YXJlOiB0LnN0cmluZyxcbiAgICBtaW5fdmVyc2lvbjogdC5zdHJpbmcsXG4gIH0pLFxuXSk7XG5cbmNvbnN0IE1pYkRldmljZVR5cGVWID0gdC50eXBlKHtcbiAgYW5ub3RhdGlvbjogdC5zdHJpbmcsXG4gIGFwcGluZm86IE1pYkRldmljZUFwcEluZm9WLFxuICBwcm9wZXJ0aWVzOiB0LnJlY29yZCh0LnN0cmluZywgTWliUHJvcGVydHlWKSxcbn0pO1xuXG5leHBvcnQgaW50ZXJmYWNlIElNaWJEZXZpY2VUeXBlIGV4dGVuZHMgdC5UeXBlT2Y8dHlwZW9mIE1pYkRldmljZVR5cGVWPiB7fVxuXG5jb25zdCBNaWJUeXBlViA9IHQuaW50ZXJzZWN0aW9uKFtcbiAgdC50eXBlKHtcbiAgICBiYXNlOiB0LnN0cmluZyxcbiAgfSksXG4gIHQucGFydGlhbCh7XG4gICAgYXBwaW5mbzogdC5wYXJ0aWFsKHtcbiAgICAgIHplcm86IHQuc3RyaW5nLFxuICAgICAgdW5pdHM6IHQuc3RyaW5nLFxuICAgICAgcHJlY2lzaW9uOiB0LnN0cmluZyxcbiAgICAgIHJlcHJlc2VudGF0aW9uOiB0LnN0cmluZyxcbiAgICB9KSxcbiAgICBtaW5JbmNsdXNpdmU6IHQuc3RyaW5nLFxuICAgIG1heEluY2x1c2l2ZTogdC5zdHJpbmcsXG4gICAgZW51bWVyYXRpb246IHQucmVjb3JkKHQuc3RyaW5nLCB0LnR5cGUoeyBhbm5vdGF0aW9uOiB0LnN0cmluZyB9KSksXG4gIH0pLFxuXSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU1pYlR5cGUgZXh0ZW5kcyB0LlR5cGVPZjx0eXBlb2YgTWliVHlwZVY+IHt9XG5cbmNvbnN0IE1pYlN1YnJvdXRpbmVWID0gdC5pbnRlcnNlY3Rpb24oW1xuICB0LnR5cGUoe1xuICAgIGFubm90YXRpb246IHQuc3RyaW5nLFxuICAgIGFwcGluZm86IHQuaW50ZXJzZWN0aW9uKFtcbiAgICAgIHQudHlwZSh7IG5tc19pZDogdC51bmlvbihbdC5zdHJpbmcsIHQuSW50XSkgfSksXG4gICAgICB0LnBhcnRpYWwoeyByZXNwb25zZTogdC5zdHJpbmcgfSksXG4gICAgXSksXG4gIH0pLFxuICB0LnBhcnRpYWwoe1xuICAgIHByb3BlcnRpZXM6IHQucmVjb3JkKHQuc3RyaW5nLCB0LnR5cGUoe1xuICAgICAgdHlwZTogdC5zdHJpbmcsXG4gICAgICBhbm5vdGF0aW9uOiB0LnN0cmluZyxcbiAgICB9KSksXG4gIH0pLFxuXSk7XG5cbmNvbnN0IFN1YnJvdXRpbmVUeXBlViA9IHQudHlwZSh7XG4gIGFubm90YXRpb246IHQuc3RyaW5nLFxuICBwcm9wZXJ0aWVzOiB0LnR5cGUoe1xuICAgIGlkOiB0LnR5cGUoe1xuICAgICAgdHlwZTogdC5saXRlcmFsKCd4czp1bnNpZ25lZFNob3J0JyksXG4gICAgICBhbm5vdGF0aW9uOiB0LnN0cmluZyxcbiAgICB9KSxcbiAgfSksXG59KTtcblxuZXhwb3J0IGNvbnN0IE1pYkRldmljZVYgPSB0LmludGVyc2VjdGlvbihbXG4gIHQudHlwZSh7XG4gICAgZGV2aWNlOiB0LnN0cmluZyxcbiAgICB0eXBlczogdC5yZWNvcmQodC5zdHJpbmcsIHQudW5pb24oW01pYkRldmljZVR5cGVWLCBNaWJUeXBlViwgU3Vicm91dGluZVR5cGVWXSkpLFxuICB9KSxcbiAgdC5wYXJ0aWFsKHtcbiAgICBzdWJyb3V0aW5lczogdC5yZWNvcmQodC5zdHJpbmcsIE1pYlN1YnJvdXRpbmVWKSxcbiAgfSksXG5dKTtcblxuaW50ZXJmYWNlIElNaWJEZXZpY2UgZXh0ZW5kcyB0LlR5cGVPZjx0eXBlb2YgTWliRGV2aWNlVj4ge31cblxudHlwZSBMaXN0ZW5lcjxUPiA9IChhcmc6IFQpID0+IHZvaWQ7XG50eXBlIENoYW5nZUFyZyA9IHsgaWQ6IG51bWJlciwgbmFtZXM6IHN0cmluZ1tdIH07XG5leHBvcnQgdHlwZSBDaGFuZ2VMaXN0ZW5lciA9IExpc3RlbmVyPENoYW5nZUFyZz47XG50eXBlIFVwbG9hZFN0YXJ0QXJnID0geyBkb21haW46IHN0cmluZywgZG9tYWluU2l6ZTogbnVtYmVyLCBvZmZzZXQ6IG51bWJlciwgc2l6ZTogbnVtYmVyIH07XG5leHBvcnQgdHlwZSBVcGxvYWRTdGFydExpc3RlbmVyID0gTGlzdGVuZXI8VXBsb2FkU3RhcnRBcmc+O1xudHlwZSBVcGxvYWREYXRhQXJnID0geyBkb21haW46IHN0cmluZywgZGF0YTogQnVmZmVyLCBwb3M6IG51bWJlciB9O1xuZXhwb3J0IHR5cGUgVXBsb2FkRGF0YUxpc3RlbmVyID0gTGlzdGVuZXI8VXBsb2FkRGF0YUFyZz47XG50eXBlIFVwbG9hZEZpbmlzaEFyZyA9IHsgZG9tYWluOiBzdHJpbmcsIG9mZnNldDogbnVtYmVyLCBkYXRhOiBCdWZmZXIgfTtcbmV4cG9ydCB0eXBlIFVwbG9hZEZpbmlzaExpc3RlbmVyID0gTGlzdGVuZXI8VXBsb2FkRmluaXNoQXJnPjtcbnR5cGUgRG93bmxvYWRTdGFydEFyZyA9IHsgZG9tYWluOiBzdHJpbmcsIGRvbWFpblNpemU6IG51bWJlciwgb2Zmc2V0OiBudW1iZXIsIHNpemU6IG51bWJlciB9O1xuZXhwb3J0IHR5cGUgRG93bmxvYWRTdGFydExpc3RlbmVyID0gTGlzdGVuZXI8RG93bmxvYWRTdGFydEFyZz47XG50eXBlIERvd25sb2FkRGF0YUFyZyA9IHsgZG9tYWluOiBzdHJpbmcsIGxlbmd0aDogbnVtYmVyIH07XG5leHBvcnQgdHlwZSBEb3dubG9hZERhdGFMaXN0ZW5lciA9IExpc3RlbmVyPERvd25sb2FkRGF0YUFyZz47XG50eXBlIERvd25sb2FkRmluaXNoQXJnID0geyBkb21haW46IHN0cmluZzsgb2Zmc2V0OiBudW1iZXIsIHNpemU6IG51bWJlciB9O1xuZXhwb3J0IHR5cGUgRG93bmxvYWRGaW5pc2hMaXN0ZW5lciA9IExpc3RlbmVyPERvd25sb2FkRmluaXNoQXJnPjtcbmV4cG9ydCB0eXBlIERldmljZUlkID0gc3RyaW5nICYgeyBfX2JyYW5kOiAnRGV2aWNlSWQnIH07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSURldmljZSB7XG4gIHJlYWRvbmx5IGlkOiBEZXZpY2VJZDtcbiAgcmVhZG9ubHkgYWRkcmVzczogQWRkcmVzcztcbiAgZHJhaW4oKTogUHJvbWlzZTxudW1iZXJbXT47XG4gIHdyaXRlKC4uLmlkczogbnVtYmVyW10pOiBQcm9taXNlPG51bWJlcltdPjtcbiAgcmVhZCguLi5pZHM6IG51bWJlcltdKTogUHJvbWlzZTx7IFtuYW1lOiBzdHJpbmddOiBhbnkgfT47XG4gIHVwbG9hZChkb21haW46IHN0cmluZywgb2Zmc2V0PzogbnVtYmVyLCBzaXplPzogbnVtYmVyKTogUHJvbWlzZTxCdWZmZXI+O1xuICBkb3dubG9hZChkb21haW46IHN0cmluZywgZGF0YTogQnVmZmVyLCBvZmZzZXQ/OiBudW1iZXIsIG5vVGVybT86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+O1xuICBleGVjdXRlKFxuICAgIHByb2dyYW06IHN0cmluZyxcbiAgICBhcmdzPzogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8Tm1zRGF0YWdyYW0gfCBObXNEYXRhZ3JhbVtdIHwgdW5kZWZpbmVkPjtcbiAgY29ubmVjdGlvbj86IE5pYnVzQ29ubmVjdGlvbjtcbiAgcmVsZWFzZSgpOiBudW1iZXI7XG4gIGdldElkKGlkT3JOYW1lOiBzdHJpbmcgfCBudW1iZXIpOiBudW1iZXI7XG4gIGdldE5hbWUoaWRPck5hbWU6IHN0cmluZyB8IG51bWJlcik6IHN0cmluZztcbiAgZ2V0UmF3VmFsdWUoaWRPck5hbWU6IG51bWJlciB8IHN0cmluZyk6IGFueTtcbiAgZ2V0RXJyb3IoaWRPck5hbWU6IG51bWJlciB8IHN0cmluZyk6IGFueTtcbiAgaXNEaXJ0eShpZE9yTmFtZTogc3RyaW5nIHwgbnVtYmVyKTogYm9vbGVhbjtcbiAgW21pYlByb3BlcnR5OiBzdHJpbmddOiBhbnk7XG5cbiAgb24oZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcsIGxpc3RlbmVyOiAoKSA9PiB2b2lkKTogdGhpcztcbiAgb24oZXZlbnQ6ICdjaGFuZ2luZycgfCAnY2hhbmdlZCcsIGxpc3RlbmVyOiBDaGFuZ2VMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAndXBsb2FkU3RhcnQnLCBsaXN0ZW5lcjogVXBsb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAndXBsb2FkRGF0YScsIGxpc3RlbmVyOiBVcGxvYWREYXRhTGlzdGVuZXIpOiB0aGlzO1xuICBvbihldmVudDogJ3VwbG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBVcGxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAnZG93bmxvYWRTdGFydCcsIGxpc3RlbmVyOiBEb3dubG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBvbihldmVudDogJ2Rvd25sb2FkRGF0YScsIGxpc3RlbmVyOiBEb3dubG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAnZG93bmxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogRG93bmxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG5cbiAgb25jZShldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnY2hhbmdpbmcnIHwgJ2NoYW5nZWQnLCBsaXN0ZW5lcjogQ2hhbmdlTGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAndXBsb2FkU3RhcnQnLCBsaXN0ZW5lcjogVXBsb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICd1cGxvYWREYXRhJywgbGlzdGVuZXI6IFVwbG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICd1cGxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogVXBsb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnZG93bmxvYWRTdGFydCcsIGxpc3RlbmVyOiBEb3dubG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnZG93bmxvYWREYXRhJywgbGlzdGVuZXI6IERvd25sb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgb25jZShldmVudDogJ2Rvd25sb2FkRmluaXNoJywgbGlzdGVuZXI6IERvd25sb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuXG4gIGFkZExpc3RlbmVyKGV2ZW50OiAnY29ubmVjdGVkJyB8ICdkaXNjb25uZWN0ZWQnLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCk6IHRoaXM7XG4gIGFkZExpc3RlbmVyKGV2ZW50OiAnY2hhbmdpbmcnIHwgJ2NoYW5nZWQnLCBsaXN0ZW5lcjogQ2hhbmdlTGlzdGVuZXIpOiB0aGlzO1xuICBhZGRMaXN0ZW5lcihldmVudDogJ3VwbG9hZFN0YXJ0JywgbGlzdGVuZXI6IFVwbG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBhZGRMaXN0ZW5lcihldmVudDogJ3VwbG9hZERhdGEnLCBsaXN0ZW5lcjogVXBsb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICd1cGxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogVXBsb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuICBhZGRMaXN0ZW5lcihldmVudDogJ2Rvd25sb2FkU3RhcnQnLCBsaXN0ZW5lcjogRG93bmxvYWRTdGFydExpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICdkb3dubG9hZERhdGEnLCBsaXN0ZW5lcjogRG93bmxvYWREYXRhTGlzdGVuZXIpOiB0aGlzO1xuICBhZGRMaXN0ZW5lcihldmVudDogJ2Rvd25sb2FkRmluaXNoJywgbGlzdGVuZXI6IERvd25sb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuXG4gIG9mZihldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICdjaGFuZ2luZycgfCAnY2hhbmdlZCcsIGxpc3RlbmVyOiBDaGFuZ2VMaXN0ZW5lcik6IHRoaXM7XG4gIG9mZihldmVudDogJ3VwbG9hZFN0YXJ0JywgbGlzdGVuZXI6IFVwbG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICd1cGxvYWREYXRhJywgbGlzdGVuZXI6IFVwbG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIG9mZihldmVudDogJ3VwbG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBVcGxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG4gIG9mZihldmVudDogJ2Rvd25sb2FkU3RhcnQnLCBsaXN0ZW5lcjogRG93bmxvYWRTdGFydExpc3RlbmVyKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAnZG93bmxvYWREYXRhJywgbGlzdGVuZXI6IERvd25sb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAnZG93bmxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogRG93bmxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG5cbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcsIGxpc3RlbmVyOiAoKSA9PiB2b2lkKTogdGhpcztcbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnQ6ICdjaGFuZ2luZycgfCAnY2hhbmdlZCcsIGxpc3RlbmVyOiBDaGFuZ2VMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAndXBsb2FkU3RhcnQnLCBsaXN0ZW5lcjogVXBsb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAndXBsb2FkRGF0YScsIGxpc3RlbmVyOiBVcGxvYWREYXRhTGlzdGVuZXIpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ3VwbG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBVcGxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAnZG93bmxvYWRTdGFydCcsIGxpc3RlbmVyOiBEb3dubG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ2Rvd25sb2FkRGF0YScsIGxpc3RlbmVyOiBEb3dubG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAnZG93bmxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogRG93bmxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG5cbiAgZW1pdChldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJyk6IGJvb2xlYW47XG4gIGVtaXQoZXZlbnQ6ICdjaGFuZ2luZycgfCAnY2hhbmdlZCcsIGFyZzogQ2hhbmdlQXJnKTogYm9vbGVhbjtcbiAgZW1pdChldmVudDogJ3VwbG9hZFN0YXJ0JywgYXJnOiBVcGxvYWRTdGFydEFyZyk6IGJvb2xlYW47XG4gIGVtaXQoZXZlbnQ6ICd1cGxvYWREYXRhJywgYXJnOiBVcGxvYWREYXRhQXJnKTogYm9vbGVhbjtcbiAgZW1pdChldmVudDogJ3VwbG9hZEZpbmlzaCcsIGFyZzogVXBsb2FkRmluaXNoQXJnKTogYm9vbGVhbjtcbiAgZW1pdChldmVudDogJ2Rvd25sb2FkU3RhcnQnLCBhcmc6IERvd25sb2FkU3RhcnRBcmcpOiBib29sZWFuO1xuICBlbWl0KGV2ZW50OiAnZG93bmxvYWREYXRhJywgYXJnOiBEb3dubG9hZERhdGFBcmcpOiBib29sZWFuO1xuICBlbWl0KGV2ZW50OiAnZG93bmxvYWRGaW5pc2gnLCBhcmc6IERvd25sb2FkRmluaXNoQXJnKTogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIElTdWJyb3V0aW5lRGVzYyB7XG4gIGlkOiBudW1iZXI7XG4gIC8vIG5hbWU6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgbm90UmVwbHk/OiBib29sZWFuO1xuICBhcmdzPzogeyBuYW1lOiBzdHJpbmcsIHR5cGU6IE5tc1ZhbHVlVHlwZSwgZGVzYz86IHN0cmluZyB9W107XG59XG5cbmludGVyZmFjZSBJUHJvcGVydHlEZXNjcmlwdG9yPE93bmVyPiB7XG4gIGNvbmZpZ3VyYWJsZT86IGJvb2xlYW47XG4gIGVudW1lcmFibGU/OiBib29sZWFuO1xuICB2YWx1ZT86IGFueTtcbiAgd3JpdGFibGU/OiBib29sZWFuO1xuXG4gIGdldD8odGhpczogT3duZXIpOiBhbnk7XG5cbiAgc2V0Pyh0aGlzOiBPd25lciwgdjogYW55KTogdm9pZDtcbn1cblxuZnVuY3Rpb24gZ2V0QmFzZVR5cGUodHlwZXM6IElNaWJEZXZpY2VbJ3R5cGVzJ10sIHR5cGU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGxldCBiYXNlID0gdHlwZTtcbiAgZm9yIChsZXQgc3VwZXJUeXBlOiBJTWliVHlwZSA9IHR5cGVzW2Jhc2VdIGFzIElNaWJUeXBlOyBzdXBlclR5cGUgIT0gbnVsbDtcbiAgICAgICBzdXBlclR5cGUgPSB0eXBlc1tzdXBlclR5cGUuYmFzZV0gYXMgSU1pYlR5cGUpIHtcbiAgICBiYXNlID0gc3VwZXJUeXBlLmJhc2U7XG4gIH1cbiAgcmV0dXJuIGJhc2U7XG59XG5cbmZ1bmN0aW9uIGRlZmluZU1pYlByb3BlcnR5KFxuICB0YXJnZXQ6IERldmljZVByb3RvdHlwZSxcbiAga2V5OiBzdHJpbmcsXG4gIHR5cGVzOiBJTWliRGV2aWNlWyd0eXBlcyddLFxuICBwcm9wOiBJTWliUHJvcGVydHkpOiBbbnVtYmVyLCBzdHJpbmddIHtcbiAgY29uc3QgcHJvcGVydHlLZXkgPSB2YWxpZEpzTmFtZShrZXkpO1xuICBjb25zdCB7IGFwcGluZm8gfSA9IHByb3A7XG4gIGNvbnN0IGlkID0gdG9JbnQoYXBwaW5mby5ubXNfaWQpO1xuICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdpZCcsIGlkLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgY29uc3Qgc2ltcGxlVHlwZSA9IGdldEJhc2VUeXBlKHR5cGVzLCBwcm9wLnR5cGUpO1xuICBjb25zdCB0eXBlID0gdHlwZXNbcHJvcC50eXBlXSBhcyBJTWliVHlwZTtcbiAgY29uc3QgY29udmVydGVyczogSUNvbnZlcnRlcltdID0gW107XG4gIGNvbnN0IGlzUmVhZGFibGUgPSBhcHBpbmZvLmFjY2Vzcy5pbmRleE9mKCdyJykgPiAtMTtcbiAgY29uc3QgaXNXcml0YWJsZSA9IGFwcGluZm8uYWNjZXNzLmluZGV4T2YoJ3cnKSA+IC0xO1xuICBsZXQgZW51bWVyYXRpb246IElNaWJUeXBlWydlbnVtZXJhdGlvbiddIHwgdW5kZWZpbmVkO1xuICBsZXQgbWluOiBudW1iZXIgfCB1bmRlZmluZWQ7XG4gIGxldCBtYXg6IG51bWJlciB8IHVuZGVmaW5lZDtcbiAgc3dpdGNoIChnZXRObXNUeXBlKHNpbXBsZVR5cGUpKSB7XG4gICAgY2FzZSBObXNWYWx1ZVR5cGUuSW50ODpcbiAgICAgIG1pbiA9IC0xMjg7XG4gICAgICBtYXggPSAxMjc7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE5tc1ZhbHVlVHlwZS5JbnQxNjpcbiAgICAgIG1pbiA9IC0zMjc2ODtcbiAgICAgIG1heCA9IDMyNzY3O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBObXNWYWx1ZVR5cGUuSW50MzI6XG4gICAgICBtaW4gPSAtMjE0NzQ4MzY0ODtcbiAgICAgIG1heCA9IDIxNDc0ODM2NDc7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE5tc1ZhbHVlVHlwZS5VSW50ODpcbiAgICAgIG1pbiA9IDA7XG4gICAgICBtYXggPSAyNTU7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE5tc1ZhbHVlVHlwZS5VSW50MTY6XG4gICAgICBtaW4gPSAwO1xuICAgICAgbWF4ID0gNjU1MzU7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE5tc1ZhbHVlVHlwZS5VSW50MzI6XG4gICAgICBtaW4gPSAwO1xuICAgICAgbWF4ID0gNDI5NDk2NzI5NTtcbiAgICAgIGJyZWFrO1xuICB9XG4gIHN3aXRjaCAoc2ltcGxlVHlwZSkge1xuICAgIGNhc2UgJ3BhY2tlZDhGbG9hdCc6XG4gICAgICBjb252ZXJ0ZXJzLnB1c2gocGFja2VkOGZsb2F0Q29udmVydGVyKHR5cGUpKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2ZpeGVkUG9pbnROdW1iZXI0JzpcbiAgICAgIGNvbnZlcnRlcnMucHVzaChmaXhlZFBvaW50TnVtYmVyNENvbnZlcnRlcik7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgYnJlYWs7XG4gIH1cbiAgaWYgKGtleSA9PT0gJ2JyaWdodG5lc3MnICYmIHByb3AudHlwZSA9PT0gJ3hzOnVuc2lnbmVkQnl0ZScpIHtcbiAgICBjb252ZXJ0ZXJzLnB1c2gocGVyY2VudENvbnZlcnRlcik7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgndW5pdCcsICclJywgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWluJywgMCwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWF4JywgMTAwLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgfSBlbHNlIGlmIChpc1dyaXRhYmxlKSB7XG4gICAgaWYgKHR5cGUgIT0gbnVsbCkge1xuICAgICAgY29uc3QgeyBtaW5JbmNsdXNpdmUsIG1heEluY2x1c2l2ZSB9ID0gdHlwZTtcbiAgICAgIGlmIChtaW5JbmNsdXNpdmUpIHtcbiAgICAgICAgY29uc3QgdmFsID0gcGFyc2VGbG9hdChtaW5JbmNsdXNpdmUpO1xuICAgICAgICBtaW4gPSBtaW4gIT09IHVuZGVmaW5lZCA/IE1hdGgubWF4KG1pbiwgdmFsKSA6IHZhbDtcbiAgICAgIH1cbiAgICAgIGlmIChtYXhJbmNsdXNpdmUpIHtcbiAgICAgICAgY29uc3QgdmFsID0gcGFyc2VGbG9hdChtYXhJbmNsdXNpdmUpO1xuICAgICAgICBtYXggPSBtYXggIT09IHVuZGVmaW5lZCA/IE1hdGgubWluKG1heCwgdmFsKSA6IHZhbDtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG1pbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBtaW4gPSBjb252ZXJ0VG8oY29udmVydGVycykobWluKSBhcyBudW1iZXI7XG4gICAgICBjb252ZXJ0ZXJzLnB1c2gobWluSW5jbHVzaXZlQ29udmVydGVyKG1pbikpO1xuICAgICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWluJywgbWluLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgICB9XG4gICAgaWYgKG1heCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBtYXggPSBjb252ZXJ0VG8oY29udmVydGVycykobWF4KSBhcyBudW1iZXI7XG4gICAgICBjb252ZXJ0ZXJzLnB1c2gobWF4SW5jbHVzaXZlQ29udmVydGVyKG1heCkpO1xuICAgICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWF4JywgbWF4LCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgICB9XG4gIH1cbiAgaWYgKHR5cGUgIT0gbnVsbCkge1xuICAgIGNvbnN0IHsgYXBwaW5mbzogaW5mbyA9IHt9IH0gPSB0eXBlO1xuICAgIGVudW1lcmF0aW9uID0gdHlwZS5lbnVtZXJhdGlvbjtcbiAgICBjb25zdCB7IHVuaXRzLCBwcmVjaXNpb24sIHJlcHJlc2VudGF0aW9uIH0gPSBpbmZvO1xuICAgIGNvbnN0IHNpemUgPSBnZXRJbnRTaXplKHNpbXBsZVR5cGUpO1xuICAgIGlmICh1bml0cykge1xuICAgICAgY29udmVydGVycy5wdXNoKHVuaXRDb252ZXJ0ZXIodW5pdHMpKTtcbiAgICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ3VuaXQnLCB1bml0cywgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gICAgfVxuICAgIHByZWNpc2lvbiAmJiBjb252ZXJ0ZXJzLnB1c2gocHJlY2lzaW9uQ29udmVydGVyKHByZWNpc2lvbikpO1xuICAgIGlmIChlbnVtZXJhdGlvbikge1xuICAgICAgY29udmVydGVycy5wdXNoKGVudW1lcmF0aW9uQ29udmVydGVyKGVudW1lcmF0aW9uKSk7XG4gICAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdlbnVtJywgT2JqZWN0LmVudHJpZXMoZW51bWVyYXRpb24pXG4gICAgICAgIC5tYXAoKFtrZXksIHZhbF0pID0+IFtcbiAgICAgICAgICB2YWwhLmFubm90YXRpb24sXG4gICAgICAgICAgdG9JbnQoa2V5KSxcbiAgICAgICAgXSksIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICAgIH1cbiAgICByZXByZXNlbnRhdGlvbiAmJiBzaXplICYmIGNvbnZlcnRlcnMucHVzaChyZXByZXNlbnRhdGlvbkNvbnZlcnRlcihyZXByZXNlbnRhdGlvbiwgc2l6ZSkpO1xuICB9XG5cbiAgaWYgKHByb3AudHlwZSA9PT0gJ3ZlcnNpb25UeXBlJykge1xuICAgIGNvbnZlcnRlcnMucHVzaCh2ZXJzaW9uVHlwZUNvbnZlcnRlcik7XG4gIH1cbiAgaWYgKHNpbXBsZVR5cGUgPT09ICd4czpib29sZWFuJyAmJiAhZW51bWVyYXRpb24pIHtcbiAgICBjb252ZXJ0ZXJzLnB1c2goYm9vbGVhbkNvbnZlcnRlcik7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnZW51bScsIFtbJ9CU0LAnLCB0cnVlXSwgWyfQndC10YInLCBmYWxzZV1dLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgfVxuICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdpc1dyaXRhYmxlJywgaXNXcml0YWJsZSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2lzUmVhZGFibGUnLCBpc1JlYWRhYmxlLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgndHlwZScsIHByb3AudHlwZSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ3NpbXBsZVR5cGUnLCBzaW1wbGVUeXBlLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YShcbiAgICAnZGlzcGxheU5hbWUnLFxuICAgIHByb3AuYW5ub3RhdGlvbiA/IHByb3AuYW5ub3RhdGlvbiA6IG5hbWUsXG4gICAgdGFyZ2V0LFxuICAgIHByb3BlcnR5S2V5LFxuICApO1xuICBhcHBpbmZvLmNhdGVnb3J5ICYmIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2NhdGVnb3J5JywgYXBwaW5mby5jYXRlZ29yeSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ25tc1R5cGUnLCBnZXRObXNUeXBlKHNpbXBsZVR5cGUpLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgY29uc3QgYXR0cmlidXRlczogSVByb3BlcnR5RGVzY3JpcHRvcjxEZXZpY2VQcm90b3R5cGU+ID0ge1xuICAgIGVudW1lcmFibGU6IGlzUmVhZGFibGUsXG4gIH07XG4gIGNvbnN0IHRvID0gY29udmVydFRvKGNvbnZlcnRlcnMpO1xuICBjb25zdCBmcm9tID0gY29udmVydEZyb20oY29udmVydGVycyk7XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2NvbnZlcnRUbycsIHRvLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnY29udmVydEZyb20nLCBmcm9tLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgYXR0cmlidXRlcy5nZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgY29uc29sZS5hc3NlcnQoUmVmbGVjdC5nZXQodGhpcywgJyRjb3VudFJlZicpID4gMCwgJ0RldmljZSB3YXMgcmVsZWFzZWQnKTtcbiAgICBsZXQgdmFsdWU7XG4gICAgaWYgKCF0aGlzLmdldEVycm9yKGlkKSkge1xuICAgICAgdmFsdWUgPSB0byh0aGlzLmdldFJhd1ZhbHVlKGlkKSk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcbiAgaWYgKGlzV3JpdGFibGUpIHtcbiAgICBhdHRyaWJ1dGVzLnNldCA9IGZ1bmN0aW9uIChuZXdWYWx1ZTogYW55KSB7XG4gICAgICBjb25zb2xlLmFzc2VydChSZWZsZWN0LmdldCh0aGlzLCAnJGNvdW50UmVmJykgPiAwLCAnRGV2aWNlIHdhcyByZWxlYXNlZCcpO1xuICAgICAgY29uc3QgdmFsdWUgPSBmcm9tKG5ld1ZhbHVlKTtcbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IE51bWJlci5pc05hTih2YWx1ZSBhcyBudW1iZXIpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB2YWx1ZTogJHtKU09OLnN0cmluZ2lmeShuZXdWYWx1ZSl9YCk7XG4gICAgICB9XG4gICAgICB0aGlzLnNldFJhd1ZhbHVlKGlkLCB2YWx1ZSk7XG4gICAgfTtcbiAgfVxuICBSZWZsZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgcHJvcGVydHlLZXksIGF0dHJpYnV0ZXMpO1xuICByZXR1cm4gW2lkLCBwcm9wZXJ0eUtleV07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRNaWJGaWxlKG1pYm5hbWU6IHN0cmluZykge1xuICByZXR1cm4gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL21pYnMvJywgYCR7bWlibmFtZX0ubWliLmpzb25gKTtcbn1cblxuY2xhc3MgRGV2aWNlUHJvdG90eXBlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIGltcGxlbWVudHMgSURldmljZSB7XG4gIC8vIHdpbGwgYmUgb3ZlcnJpZGUgZm9yIGFuIGluc3RhbmNlXG4gICRjb3VudFJlZiA9IDE7XG5cbiAgLy8gcHJpdmF0ZSAkZGVib3VuY2VEcmFpbiA9IF8uZGVib3VuY2UodGhpcy5kcmFpbiwgMjUpO1xuXG4gIGNvbnN0cnVjdG9yKG1pYm5hbWU6IHN0cmluZykge1xuICAgIHN1cGVyKCk7XG4gICAgY29uc3QgbWliZmlsZSA9IGdldE1pYkZpbGUobWlibmFtZSk7XG4gICAgY29uc3QgbWliVmFsaWRhdGlvbiA9IE1pYkRldmljZVYuZGVjb2RlKHJlcXVpcmUobWliZmlsZSkpO1xuICAgIGlmIChtaWJWYWxpZGF0aW9uLmlzTGVmdCgpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgbWliIGZpbGUgJHttaWJmaWxlfSAke1BhdGhSZXBvcnRlci5yZXBvcnQobWliVmFsaWRhdGlvbil9YCk7XG4gICAgfVxuICAgIGNvbnN0IG1pYiA9IG1pYlZhbGlkYXRpb24udmFsdWU7XG4gICAgY29uc3QgeyB0eXBlcywgc3Vicm91dGluZXMgfSA9IG1pYjtcbiAgICBjb25zdCBkZXZpY2UgPSB0eXBlc1ttaWIuZGV2aWNlXSBhcyBJTWliRGV2aWNlVHlwZTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtaWInLCBtaWJuYW1lLCB0aGlzKTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtaWJmaWxlJywgbWliZmlsZSwgdGhpcyk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnYW5ub3RhdGlvbicsIGRldmljZS5hbm5vdGF0aW9uLCB0aGlzKTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtaWJWZXJzaW9uJywgZGV2aWNlLmFwcGluZm8ubWliX3ZlcnNpb24sIHRoaXMpO1xuICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2RldmljZVR5cGUnLCB0b0ludChkZXZpY2UuYXBwaW5mby5kZXZpY2VfdHlwZSksIHRoaXMpO1xuICAgIGRldmljZS5hcHBpbmZvLmxvYWRlcl90eXBlICYmIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2xvYWRlclR5cGUnLFxuICAgICAgdG9JbnQoZGV2aWNlLmFwcGluZm8ubG9hZGVyX3R5cGUpLCB0aGlzLFxuICAgICk7XG4gICAgZGV2aWNlLmFwcGluZm8uZmlybXdhcmUgJiYgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnZmlybXdhcmUnLFxuICAgICAgZGV2aWNlLmFwcGluZm8uZmlybXdhcmUsIHRoaXMsXG4gICAgKTtcbiAgICBkZXZpY2UuYXBwaW5mby5taW5fdmVyc2lvbiAmJiBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtaW5fdmVyc2lvbicsXG4gICAgICBkZXZpY2UuYXBwaW5mby5taW5fdmVyc2lvbiwgdGhpcyxcbiAgICApO1xuICAgIHR5cGVzLmVycm9yVHlwZSAmJiBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKFxuICAgICAgJ2Vycm9yVHlwZScsICh0eXBlcy5lcnJvclR5cGUgYXMgSU1pYlR5cGUpLmVudW1lcmF0aW9uLCB0aGlzKTtcblxuICAgIGlmIChzdWJyb3V0aW5lcykge1xuICAgICAgY29uc3QgbWV0YXN1YnMgPSBfLnRyYW5zZm9ybShcbiAgICAgICAgc3Vicm91dGluZXMsXG4gICAgICAgIChyZXN1bHQsIHN1YiwgbmFtZSkgPT4ge1xuICAgICAgICAgIHJlc3VsdFtuYW1lXSA9IHtcbiAgICAgICAgICAgIGlkOiB0b0ludChzdWIuYXBwaW5mby5ubXNfaWQpLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IHN1Yi5hbm5vdGF0aW9uLFxuICAgICAgICAgICAgYXJnczogc3ViLnByb3BlcnRpZXMgJiYgT2JqZWN0LmVudHJpZXMoc3ViLnByb3BlcnRpZXMpXG4gICAgICAgICAgICAgIC5tYXAoKFtuYW1lLCBwcm9wXSkgPT4gKHtcbiAgICAgICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgICAgIHR5cGU6IGdldE5tc1R5cGUocHJvcC50eXBlKSxcbiAgICAgICAgICAgICAgICBkZXNjOiBwcm9wLmFubm90YXRpb24sXG4gICAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICB9O1xuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0sXG4gICAgICAgIHt9IGFzIFJlY29yZDxzdHJpbmcsIElTdWJyb3V0aW5lRGVzYz4sXG4gICAgICApO1xuICAgICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnc3Vicm91dGluZXMnLCBtZXRhc3VicywgdGhpcyk7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogY2F0ZWdvcnlcbiAgICAvLyBjb25zdCBtaWJDYXRlZ29yeSA9IF8uZmluZChkZXRlY3Rvci5kZXRlY3Rpb24hLm1pYkNhdGVnb3JpZXMsIHsgbWliOiBtaWJuYW1lIH0pO1xuICAgIC8vIGlmIChtaWJDYXRlZ29yeSkge1xuICAgIC8vICAgY29uc3QgeyBjYXRlZ29yeSwgZGlzYWJsZUJhdGNoUmVhZGluZyB9ID0gbWliQ2F0ZWdvcnk7XG4gICAgLy8gICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdjYXRlZ29yeScsIGNhdGVnb3J5LCB0aGlzKTtcbiAgICAvLyAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2Rpc2FibGVCYXRjaFJlYWRpbmcnLCAhIWRpc2FibGVCYXRjaFJlYWRpbmcsIHRoaXMpO1xuICAgIC8vIH1cblxuICAgIGNvbnN0IGtleXMgPSBSZWZsZWN0Lm93bktleXMoZGV2aWNlLnByb3BlcnRpZXMpIGFzIHN0cmluZ1tdO1xuICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ21pYlByb3BlcnRpZXMnLCBrZXlzLm1hcCh2YWxpZEpzTmFtZSksIHRoaXMpO1xuICAgIGNvbnN0IG1hcDogeyBbaWQ6IG51bWJlcl06IHN0cmluZ1tdIH0gPSB7fTtcbiAgICBrZXlzLmZvckVhY2goKGtleTogc3RyaW5nKSA9PiB7XG4gICAgICBjb25zdCBbaWQsIHByb3BOYW1lXSA9IGRlZmluZU1pYlByb3BlcnR5KHRoaXMsIGtleSwgdHlwZXMsIGRldmljZS5wcm9wZXJ0aWVzW2tleV0pO1xuICAgICAgaWYgKCFtYXBbaWRdKSB7XG4gICAgICAgIG1hcFtpZF0gPSBbcHJvcE5hbWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWFwW2lkXS5wdXNoKHByb3BOYW1lKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtYXAnLCBtYXAsIHRoaXMpO1xuICB9XG5cbiAgcHVibGljIGdldCBjb25uZWN0aW9uKCk6IE5pYnVzQ29ubmVjdGlvbiB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgeyBbJHZhbHVlc106IHZhbHVlcyB9ID0gdGhpcztcbiAgICByZXR1cm4gdmFsdWVzW1ByaXZhdGVQcm9wcy5jb25uZWN0aW9uXTtcbiAgfVxuXG4gIHB1YmxpYyBzZXQgY29ubmVjdGlvbih2YWx1ZTogTmlidXNDb25uZWN0aW9uIHwgdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgeyBbJHZhbHVlc106IHZhbHVlcyB9ID0gdGhpcztcbiAgICBjb25zdCBwcmV2ID0gdmFsdWVzW1ByaXZhdGVQcm9wcy5jb25uZWN0aW9uXTtcbiAgICBpZiAocHJldiA9PT0gdmFsdWUpIHJldHVybjtcbiAgICB2YWx1ZXNbUHJpdmF0ZVByb3BzLmNvbm5lY3Rpb25dID0gdmFsdWU7XG4gICAgLyoqXG4gICAgICogRGV2aWNlIGNvbm5lY3RlZCBldmVudFxuICAgICAqIEBldmVudCBJRGV2aWNlI2Nvbm5lY3RlZFxuICAgICAqIEBldmVudCBJRGV2aWNlI2Rpc2Nvbm5lY3RlZFxuICAgICAqL1xuICAgIHRoaXMuZW1pdCh2YWx1ZSAhPSBudWxsID8gJ2Nvbm5lY3RlZCcgOiAnZGlzY29ubmVjdGVkJyk7XG4gICAgLy8gaWYgKHZhbHVlKSB7XG4gICAgLy8gICB0aGlzLmRyYWluKCkuY2F0Y2goKCkgPT4ge30pO1xuICAgIC8vIH1cbiAgfVxuXG4gIC8vIG5vaW5zcGVjdGlvbiBKU1VudXNlZEdsb2JhbFN5bWJvbHNcbiAgcHVibGljIHRvSlNPTigpOiBhbnkge1xuICAgIGNvbnN0IGpzb246IGFueSA9IHtcbiAgICAgIG1pYjogUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWliJywgdGhpcyksXG4gICAgfTtcbiAgICBjb25zdCBrZXlzOiBzdHJpbmdbXSA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21pYlByb3BlcnRpZXMnLCB0aGlzKTtcbiAgICBrZXlzLmZvckVhY2goKGtleSkgPT4ge1xuICAgICAgaWYgKHRoaXNba2V5XSAhPT0gdW5kZWZpbmVkKSBqc29uW2tleV0gPSB0aGlzW2tleV07XG4gICAgfSk7XG4gICAganNvbi5hZGRyZXNzID0gdGhpcy5hZGRyZXNzLnRvU3RyaW5nKCk7XG4gICAgcmV0dXJuIGpzb247XG4gIH1cblxuICBwdWJsaWMgZ2V0SWQoaWRPck5hbWU6IHN0cmluZyB8IG51bWJlcik6IG51bWJlciB7XG4gICAgbGV0IGlkOiBudW1iZXI7XG4gICAgaWYgKHR5cGVvZiBpZE9yTmFtZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGlkID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnaWQnLCB0aGlzLCBpZE9yTmFtZSk7XG4gICAgICBpZiAoTnVtYmVyLmlzSW50ZWdlcihpZCkpIHJldHVybiBpZDtcbiAgICAgIGlkID0gdG9JbnQoaWRPck5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZCA9IGlkT3JOYW1lO1xuICAgIH1cbiAgICBjb25zdCBtYXAgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBpZiAoIVJlZmxlY3QuaGFzKG1hcCwgaWQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gcHJvcGVydHkgJHtpZE9yTmFtZX1gKTtcbiAgICB9XG4gICAgcmV0dXJuIGlkO1xuICB9XG5cbiAgcHVibGljIGdldE5hbWUoaWRPck5hbWU6IHN0cmluZyB8IG51bWJlcik6IHN0cmluZyB7XG4gICAgY29uc3QgbWFwID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWFwJywgdGhpcyk7XG4gICAgaWYgKFJlZmxlY3QuaGFzKG1hcCwgaWRPck5hbWUpKSB7XG4gICAgICByZXR1cm4gbWFwW2lkT3JOYW1lXVswXTtcbiAgICB9XG4gICAgY29uc3Qga2V5czogc3RyaW5nW10gPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtaWJQcm9wZXJ0aWVzJywgdGhpcyk7XG4gICAgaWYgKHR5cGVvZiBpZE9yTmFtZSA9PT0gJ3N0cmluZycgJiYga2V5cy5pbmNsdWRlcyhpZE9yTmFtZSkpIHJldHVybiBpZE9yTmFtZTtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gcHJvcGVydHkgJHtpZE9yTmFtZX1gKTtcbiAgfVxuXG4gIC8qXG4gICAgcHVibGljIHRvSWRzKGlkc09yTmFtZXM6IChzdHJpbmcgfCBudW1iZXIpW10pOiBudW1iZXJbXSB7XG4gICAgICBjb25zdCBtYXAgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICAgIHJldHVybiBpZHNPck5hbWVzLm1hcCgoaWRPck5hbWUpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBpZE9yTmFtZSA9PT0gJ3N0cmluZycpXG4gICAgICB9KTtcbiAgICB9XG4gICovXG4gIHB1YmxpYyBnZXRSYXdWYWx1ZShpZE9yTmFtZTogbnVtYmVyIHwgc3RyaW5nKTogYW55IHtcbiAgICBjb25zdCBpZCA9IHRoaXMuZ2V0SWQoaWRPck5hbWUpO1xuICAgIGNvbnN0IHsgWyR2YWx1ZXNdOiB2YWx1ZXMgfSA9IHRoaXM7XG4gICAgcmV0dXJuIHZhbHVlc1tpZF07XG4gIH1cblxuICBwdWJsaWMgc2V0UmF3VmFsdWUoaWRPck5hbWU6IG51bWJlciB8IHN0cmluZywgdmFsdWU6IGFueSwgaXNEaXJ0eSA9IHRydWUpIHtcbiAgICAvLyBkZWJ1Zyhgc2V0UmF3VmFsdWUoJHtpZE9yTmFtZX0sICR7SlNPTi5zdHJpbmdpZnkoc2FmZU51bWJlcih2YWx1ZSkpfSlgKTtcbiAgICBjb25zdCBpZCA9IHRoaXMuZ2V0SWQoaWRPck5hbWUpO1xuICAgIGNvbnN0IHsgWyR2YWx1ZXNdOiB2YWx1ZXMsIFskZXJyb3JzXTogZXJyb3JzIH0gPSB0aGlzO1xuICAgIGNvbnN0IG5ld1ZhbCA9IHNhZmVOdW1iZXIodmFsdWUpO1xuICAgIGlmIChuZXdWYWwgIT09IHZhbHVlc1tpZF0gfHwgZXJyb3JzW2lkXSkge1xuICAgICAgdmFsdWVzW2lkXSA9IG5ld1ZhbDtcbiAgICAgIGRlbGV0ZSBlcnJvcnNbaWRdO1xuICAgICAgdGhpcy5zZXREaXJ0eShpZCwgaXNEaXJ0eSk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGdldEVycm9yKGlkT3JOYW1lOiBudW1iZXIgfCBzdHJpbmcpOiBhbnkge1xuICAgIGNvbnN0IGlkID0gdGhpcy5nZXRJZChpZE9yTmFtZSk7XG4gICAgY29uc3QgeyBbJGVycm9yc106IGVycm9ycyB9ID0gdGhpcztcbiAgICByZXR1cm4gZXJyb3JzW2lkXTtcbiAgfVxuXG4gIHB1YmxpYyBzZXRFcnJvcihpZE9yTmFtZTogbnVtYmVyIHwgc3RyaW5nLCBlcnJvcj86IEVycm9yKSB7XG4gICAgY29uc3QgaWQgPSB0aGlzLmdldElkKGlkT3JOYW1lKTtcbiAgICBjb25zdCB7IFskZXJyb3JzXTogZXJyb3JzIH0gPSB0aGlzO1xuICAgIGlmIChlcnJvciAhPSBudWxsKSB7XG4gICAgICBlcnJvcnNbaWRdID0gZXJyb3I7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlbGV0ZSBlcnJvcnNbaWRdO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBpc0RpcnR5KGlkT3JOYW1lOiBzdHJpbmcgfCBudW1iZXIpOiBib29sZWFuIHtcbiAgICBjb25zdCBpZCA9IHRoaXMuZ2V0SWQoaWRPck5hbWUpO1xuICAgIGNvbnN0IHsgWyRkaXJ0aWVzXTogZGlydGllcyB9ID0gdGhpcztcbiAgICByZXR1cm4gISFkaXJ0aWVzW2lkXTtcbiAgfVxuXG4gIHB1YmxpYyBzZXREaXJ0eShpZE9yTmFtZTogc3RyaW5nIHwgbnVtYmVyLCBpc0RpcnR5ID0gdHJ1ZSkge1xuICAgIGNvbnN0IGlkID0gdGhpcy5nZXRJZChpZE9yTmFtZSk7XG4gICAgY29uc3QgbWFwOiB7IFtpZDogbnVtYmVyXTogc3RyaW5nW10gfSA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21hcCcsIHRoaXMpO1xuICAgIGNvbnN0IHsgWyRkaXJ0aWVzXTogZGlydGllcyB9ID0gdGhpcztcbiAgICBpZiAoaXNEaXJ0eSkge1xuICAgICAgZGlydGllc1tpZF0gPSB0cnVlO1xuICAgICAgLy8gVE9ETzogaW1wbGVtZW50IGF1dG9zYXZlXG4gICAgICAvLyB0aGlzLndyaXRlKGlkKS5jYXRjaCgoKSA9PiB7fSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlbGV0ZSBkaXJ0aWVzW2lkXTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQGV2ZW50IElEZXZpY2UjY2hhbmdlZFxuICAgICAqIEBldmVudCBJRGV2aWNlI2NoYW5naW5nXG4gICAgICovXG4gICAgY29uc3QgbmFtZXMgPSBtYXBbaWRdIHx8IFtdO1xuICAgIHRoaXMuZW1pdChcbiAgICAgIGlzRGlydHkgPyAnY2hhbmdpbmcnIDogJ2NoYW5nZWQnLFxuICAgICAge1xuICAgICAgICBpZCxcbiAgICAgICAgbmFtZXMsXG4gICAgICB9LFxuICAgICk7XG4gIH1cblxuICBwdWJsaWMgYWRkcmVmKCkge1xuICAgIHRoaXMuJGNvdW50UmVmICs9IDE7XG4gICAgZGVidWcoJ2FkZHJlZicsIG5ldyBFcnJvcignYWRkcmVmJykuc3RhY2spO1xuICAgIHJldHVybiB0aGlzLiRjb3VudFJlZjtcbiAgfVxuXG4gIHB1YmxpYyByZWxlYXNlKCkge1xuICAgIHRoaXMuJGNvdW50UmVmIC09IDE7XG4gICAgaWYgKHRoaXMuJGNvdW50UmVmIDw9IDApIHtcbiAgICAgIGRlbGV0ZSBkZXZpY2VNYXBbdGhpcy5hZGRyZXNzLnRvU3RyaW5nKCldO1xuICAgICAgLyoqXG4gICAgICAgKiBAZXZlbnQgRGV2aWNlcyNkZWxldGVcbiAgICAgICAqL1xuICAgICAgZGV2aWNlcy5lbWl0KCdkZWxldGUnLCB0aGlzKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuJGNvdW50UmVmO1xuICB9XG5cbiAgcHVibGljIGRyYWluKCk6IFByb21pc2U8bnVtYmVyW10+IHtcbiAgICBkZWJ1ZyhgZHJhaW4gWyR7dGhpcy5hZGRyZXNzfV1gKTtcbiAgICBjb25zdCB7IFskZGlydGllc106IGRpcnRpZXMgfSA9IHRoaXM7XG4gICAgY29uc3QgaWRzID0gT2JqZWN0LmtleXMoZGlydGllcykubWFwKE51bWJlcikuZmlsdGVyKGlkID0+IGRpcnRpZXNbaWRdKTtcbiAgICByZXR1cm4gaWRzLmxlbmd0aCA+IDAgPyB0aGlzLndyaXRlKC4uLmlkcykuY2F0Y2goKCkgPT4gW10pIDogUHJvbWlzZS5yZXNvbHZlKFtdKTtcbiAgfVxuXG4gIHByaXZhdGUgd3JpdGVBbGwoKSB7XG4gICAgY29uc3QgeyBbJHZhbHVlc106IHZhbHVlcyB9ID0gdGhpcztcbiAgICBjb25zdCBtYXAgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBjb25zdCBpZHMgPSBPYmplY3QuZW50cmllcyh2YWx1ZXMpXG4gICAgICAuZmlsdGVyKChbLCB2YWx1ZV0pID0+IHZhbHVlICE9IG51bGwpXG4gICAgICAubWFwKChbaWRdKSA9PiBOdW1iZXIoaWQpKVxuICAgICAgLmZpbHRlcigoaWQgPT4gUmVmbGVjdC5nZXRNZXRhZGF0YSgnaXNXcml0YWJsZScsIHRoaXMsIG1hcFtpZF1bMF0pKSk7XG4gICAgcmV0dXJuIGlkcy5sZW5ndGggPiAwID8gdGhpcy53cml0ZSguLi5pZHMpIDogUHJvbWlzZS5yZXNvbHZlKFtdKTtcbiAgfVxuXG4gIHB1YmxpYyB3cml0ZSguLi5pZHM6IG51bWJlcltdKTogUHJvbWlzZTxudW1iZXJbXT4ge1xuICAgIGNvbnN0IHsgY29ubmVjdGlvbiB9ID0gdGhpcztcbiAgICBpZiAoIWNvbm5lY3Rpb24pIHJldHVybiBQcm9taXNlLnJlamVjdChgJHt0aGlzLmFkZHJlc3N9IGlzIGRpc2Nvbm5lY3RlZGApO1xuICAgIGlmIChpZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gdGhpcy53cml0ZUFsbCgpO1xuICAgIH1cbiAgICBkZWJ1Zyhgd3JpdGluZyAke2lkcy5qb2luKCl9IHRvIFske3RoaXMuYWRkcmVzc31dYCk7XG4gICAgY29uc3QgbWFwID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWFwJywgdGhpcyk7XG4gICAgY29uc3QgcmVxdWVzdHMgPSBpZHMucmVkdWNlKFxuICAgICAgKGFjYzogTm1zRGF0YWdyYW1bXSwgaWQpID0+IHtcbiAgICAgICAgY29uc3QgW25hbWVdID0gbWFwW2lkXTtcbiAgICAgICAgaWYgKCFuYW1lKSB7XG4gICAgICAgICAgZGVidWcoYFVua25vd24gaWQ6ICR7aWR9IGZvciAke1JlZmxlY3QuZ2V0TWV0YWRhdGEoJ21pYicsIHRoaXMpfWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGFjYy5wdXNoKGNyZWF0ZU5tc1dyaXRlKFxuICAgICAgICAgICAgdGhpcy5hZGRyZXNzLFxuICAgICAgICAgICAgaWQsXG4gICAgICAgICAgICBSZWZsZWN0LmdldE1ldGFkYXRhKCdubXNUeXBlJywgdGhpcywgbmFtZSksXG4gICAgICAgICAgICB0aGlzLmdldFJhd1ZhbHVlKGlkKSxcbiAgICAgICAgICApKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgfSxcbiAgICAgIFtdLFxuICAgICk7XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKFxuICAgICAgcmVxdWVzdHNcbiAgICAgICAgLm1hcChkYXRhZ3JhbSA9PiBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShkYXRhZ3JhbSlcbiAgICAgICAgICAudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHsgc3RhdHVzIH0gPSByZXNwb25zZSBhcyBObXNEYXRhZ3JhbTtcbiAgICAgICAgICAgIGlmIChzdGF0dXMgPT09IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5zZXREaXJ0eShkYXRhZ3JhbS5pZCwgZmFsc2UpO1xuICAgICAgICAgICAgICByZXR1cm4gZGF0YWdyYW0uaWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnNldEVycm9yKGRhdGFncmFtLmlkLCBuZXcgTmlidXNFcnJvcihzdGF0dXMhLCB0aGlzKSk7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgfSwgKHJlYXNvbikgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXRFcnJvcihkYXRhZ3JhbS5pZCwgcmVhc29uKTtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICB9KSkpXG4gICAgICAudGhlbihpZHMgPT4gaWRzLmZpbHRlcihpZCA9PiBpZCA+IDApKTtcbiAgfVxuXG4gIHB1YmxpYyB3cml0ZVZhbHVlcyhzb3VyY2U6IG9iamVjdCwgc3Ryb25nID0gdHJ1ZSk6IFByb21pc2U8bnVtYmVyW10+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgaWRzID0gT2JqZWN0LmtleXMoc291cmNlKS5tYXAobmFtZSA9PiB0aGlzLmdldElkKG5hbWUpKTtcbiAgICAgIGlmIChpZHMubGVuZ3RoID09PSAwKSByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IFR5cGVFcnJvcigndmFsdWUgaXMgZW1wdHknKSk7XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMsIHNvdXJjZSk7XG4gICAgICByZXR1cm4gdGhpcy53cml0ZSguLi5pZHMpXG4gICAgICAgIC50aGVuKCh3cml0dGVuKSA9PiB7XG4gICAgICAgICAgaWYgKHdyaXR0ZW4ubGVuZ3RoID09PSAwIHx8IChzdHJvbmcgJiYgd3JpdHRlbi5sZW5ndGggIT09IGlkcy5sZW5ndGgpKSB7XG4gICAgICAgICAgICB0aHJvdyB0aGlzLmdldEVycm9yKGlkc1swXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB3cml0dGVuO1xuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcmVhZEFsbCgpOiBQcm9taXNlPGFueT4ge1xuICAgIGlmICh0aGlzLiRyZWFkKSByZXR1cm4gdGhpcy4kcmVhZDtcbiAgICBjb25zdCBtYXA6IHsgW2lkOiBzdHJpbmddOiBzdHJpbmdbXSB9ID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWFwJywgdGhpcyk7XG4gICAgY29uc3QgaWRzID0gT2JqZWN0LmVudHJpZXMobWFwKVxuICAgICAgLmZpbHRlcigoWywgbmFtZXNdKSA9PiBSZWZsZWN0LmdldE1ldGFkYXRhKCdpc1JlYWRhYmxlJywgdGhpcywgbmFtZXNbMF0pKVxuICAgICAgLm1hcCgoW2lkXSkgPT4gTnVtYmVyKGlkKSlcbiAgICAgIC5zb3J0KCk7XG4gICAgdGhpcy4kcmVhZCA9IGlkcy5sZW5ndGggPiAwID8gdGhpcy5yZWFkKC4uLmlkcykgOiBQcm9taXNlLnJlc29sdmUoW10pO1xuICAgIGNvbnN0IGNsZWFyID0gKCkgPT4gZGVsZXRlIHRoaXMuJHJlYWQ7XG4gICAgcmV0dXJuIHRoaXMuJHJlYWQuZmluYWxseShjbGVhcik7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcmVhZCguLi5pZHM6IG51bWJlcltdKTogUHJvbWlzZTx7IFtuYW1lOiBzdHJpbmddOiBhbnkgfT4ge1xuICAgIGNvbnN0IHsgY29ubmVjdGlvbiB9ID0gdGhpcztcbiAgICBpZiAoIWNvbm5lY3Rpb24pIHJldHVybiBQcm9taXNlLnJlamVjdCgnZGlzY29ubmVjdGVkJyk7XG4gICAgaWYgKGlkcy5sZW5ndGggPT09IDApIHJldHVybiB0aGlzLnJlYWRBbGwoKTtcbiAgICAvLyBkZWJ1ZyhgcmVhZCAke2lkcy5qb2luKCl9IGZyb20gWyR7dGhpcy5hZGRyZXNzfV1gKTtcbiAgICBjb25zdCBkaXNhYmxlQmF0Y2hSZWFkaW5nID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnZGlzYWJsZUJhdGNoUmVhZGluZycsIHRoaXMpO1xuICAgIGNvbnN0IG1hcDogeyBbaWQ6IHN0cmluZ106IHN0cmluZ1tdIH0gPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBjb25zdCBjaHVua3MgPSBjaHVua0FycmF5KGlkcywgZGlzYWJsZUJhdGNoUmVhZGluZyA/IDEgOiAyMSk7XG4gICAgZGVidWcoYHJlYWQgWyR7Y2h1bmtzLm1hcChjaHVuayA9PiBgWyR7Y2h1bmsuam9pbigpfV1gKS5qb2luKCl9XSBmcm9tIFske3RoaXMuYWRkcmVzc31dYCk7XG4gICAgY29uc3QgcmVxdWVzdHMgPSBjaHVua3MubWFwKGNodW5rID0+IGNyZWF0ZU5tc1JlYWQodGhpcy5hZGRyZXNzLCAuLi5jaHVuaykpO1xuICAgIHJldHVybiByZXF1ZXN0cy5yZWR1Y2UoXG4gICAgICBhc3luYyAocHJvbWlzZSwgZGF0YWdyYW0pID0+IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvbWlzZTtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShkYXRhZ3JhbSk7XG4gICAgICAgIGNvbnN0IGRhdGFncmFtczogTm1zRGF0YWdyYW1bXSA9IEFycmF5LmlzQXJyYXkocmVzcG9uc2UpXG4gICAgICAgICAgPyByZXNwb25zZSBhcyBObXNEYXRhZ3JhbVtdXG4gICAgICAgICAgOiBbcmVzcG9uc2UgYXMgTm1zRGF0YWdyYW1dO1xuICAgICAgICBkYXRhZ3JhbXMuZm9yRWFjaCgoeyBpZCwgdmFsdWUsIHN0YXR1cyB9KSA9PiB7XG4gICAgICAgICAgaWYgKHN0YXR1cyA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5zZXRSYXdWYWx1ZShpZCwgdmFsdWUsIGZhbHNlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zZXRFcnJvcihpZCwgbmV3IE5pYnVzRXJyb3Ioc3RhdHVzISwgdGhpcykpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBuYW1lcyA9IG1hcFtpZF07XG4gICAgICAgICAgY29uc29sZS5hc3NlcnQobmFtZXMgJiYgbmFtZXMubGVuZ3RoID4gMCwgYEludmFsaWQgaWQgJHtpZH1gKTtcbiAgICAgICAgICBuYW1lcy5mb3JFYWNoKChwcm9wTmFtZSkgPT4ge1xuICAgICAgICAgICAgcmVzdWx0W3Byb3BOYW1lXSA9IHN0YXR1cyA9PT0gMFxuICAgICAgICAgICAgICA/IHRoaXNbcHJvcE5hbWVdXG4gICAgICAgICAgICAgIDogeyBlcnJvcjogKHRoaXMuZ2V0RXJyb3IoaWQpIHx8IHt9KS5tZXNzYWdlIHx8ICdlcnJvcicgfTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9LFxuICAgICAgUHJvbWlzZS5yZXNvbHZlKHt9IGFzIHsgW25hbWU6IHN0cmluZ106IGFueSB9KSxcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgdXBsb2FkKGRvbWFpbjogc3RyaW5nLCBvZmZzZXQgPSAwLCBzaXplPzogbnVtYmVyKTogUHJvbWlzZTxCdWZmZXI+IHtcbiAgICBjb25zdCB7IGNvbm5lY3Rpb24gfSA9IHRoaXM7XG4gICAgdHJ5IHtcbiAgICAgIGlmICghY29ubmVjdGlvbikgdGhyb3cgbmV3IEVycm9yKCdkaXNjb25uZWN0ZWQnKTtcbiAgICAgIGNvbnN0IHJlcVVwbG9hZCA9IGNyZWF0ZU5tc1JlcXVlc3REb21haW5VcGxvYWQodGhpcy5hZGRyZXNzLCBkb21haW4ucGFkRW5kKDgsICdcXDAnKSk7XG4gICAgICBjb25zdCB7IGlkLCB2YWx1ZTogZG9tYWluU2l6ZSwgc3RhdHVzIH0gPVxuICAgICAgICBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShyZXFVcGxvYWQpIGFzIE5tc0RhdGFncmFtO1xuICAgICAgaWYgKHN0YXR1cyAhPT0gMCkge1xuICAgICAgICAvLyBkZWJ1ZygnPGVycm9yPicsIHN0YXR1cyk7XG4gICAgICAgIHRocm93IG5ldyBOaWJ1c0Vycm9yKHN0YXR1cyEsIHRoaXMsICdSZXF1ZXN0IHVwbG9hZCBkb21haW4gZXJyb3InKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGluaXRVcGxvYWQgPSBjcmVhdGVObXNJbml0aWF0ZVVwbG9hZFNlcXVlbmNlKHRoaXMuYWRkcmVzcywgaWQpO1xuICAgICAgY29uc3QgeyBzdGF0dXM6IGluaXRTdGF0IH0gPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShpbml0VXBsb2FkKSBhcyBObXNEYXRhZ3JhbTtcbiAgICAgIGlmIChpbml0U3RhdCAhPT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgTmlidXNFcnJvcihpbml0U3RhdCEsIHRoaXMsICdJbml0aWF0ZSB1cGxvYWQgZG9tYWluIGVycm9yJyk7XG4gICAgICB9XG4gICAgICBjb25zdCB0b3RhbCA9IHNpemUgfHwgKGRvbWFpblNpemUgLSBvZmZzZXQpO1xuICAgICAgbGV0IHJlc3QgPSB0b3RhbDtcbiAgICAgIGxldCBwb3MgPSBvZmZzZXQ7XG4gICAgICB0aGlzLmVtaXQoXG4gICAgICAgICd1cGxvYWRTdGFydCcsXG4gICAgICAgIHtcbiAgICAgICAgICBkb21haW4sXG4gICAgICAgICAgZG9tYWluU2l6ZSxcbiAgICAgICAgICBvZmZzZXQsXG4gICAgICAgICAgc2l6ZTogdG90YWwsXG4gICAgICAgIH0sXG4gICAgICApO1xuICAgICAgY29uc3QgYnVmczogQnVmZmVyW10gPSBbXTtcbiAgICAgIHdoaWxlIChyZXN0ID4gMCkge1xuICAgICAgICBjb25zdCBsZW5ndGggPSBNYXRoLm1pbigyNTUsIHJlc3QpO1xuICAgICAgICBjb25zdCB1cGxvYWRTZWdtZW50ID0gY3JlYXRlTm1zVXBsb2FkU2VnbWVudCh0aGlzLmFkZHJlc3MsIGlkLCBwb3MsIGxlbmd0aCk7XG4gICAgICAgIGNvbnN0IHsgc3RhdHVzOiB1cGxvYWRTdGF0dXMsIHZhbHVlOiByZXN1bHQgfSA9XG4gICAgICAgICAgYXdhaXQgY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0odXBsb2FkU2VnbWVudCkgYXMgTm1zRGF0YWdyYW07XG4gICAgICAgIGlmICh1cGxvYWRTdGF0dXMgIT09IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgTmlidXNFcnJvcih1cGxvYWRTdGF0dXMhLCB0aGlzLCAnVXBsb2FkIHNlZ21lbnQgZXJyb3InKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVzdWx0LmRhdGEubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgYnVmcy5wdXNoKHJlc3VsdC5kYXRhKTtcbiAgICAgICAgdGhpcy5lbWl0KFxuICAgICAgICAgICd1cGxvYWREYXRhJyxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBkb21haW4sXG4gICAgICAgICAgICBwb3MsXG4gICAgICAgICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgICAgICB9LFxuICAgICAgICApO1xuICAgICAgICByZXN0IC09IHJlc3VsdC5kYXRhLmxlbmd0aDtcbiAgICAgICAgcG9zICs9IHJlc3VsdC5kYXRhLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHJlc3VsdCA9IEJ1ZmZlci5jb25jYXQoYnVmcyk7XG4gICAgICB0aGlzLmVtaXQoXG4gICAgICAgICd1cGxvYWRGaW5pc2gnLFxuICAgICAgICB7XG4gICAgICAgICAgZG9tYWluLFxuICAgICAgICAgIG9mZnNldCxcbiAgICAgICAgICBkYXRhOiByZXN1bHQsXG4gICAgICAgIH0sXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLmVtaXQoJ3VwbG9hZEVycm9yJywgZSk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGRvd25sb2FkKGRvbWFpbjogc3RyaW5nLCBidWZmZXI6IEJ1ZmZlciwgb2Zmc2V0ID0gMCwgbm9UZXJtID0gZmFsc2UpIHtcbiAgICBjb25zdCB7IGNvbm5lY3Rpb24gfSA9IHRoaXM7XG4gICAgaWYgKCFjb25uZWN0aW9uKSB0aHJvdyBuZXcgRXJyb3IoJ2Rpc2Nvbm5lY3RlZCcpO1xuICAgIGNvbnN0IHJlcURvd25sb2FkID0gY3JlYXRlTm1zUmVxdWVzdERvbWFpbkRvd25sb2FkKHRoaXMuYWRkcmVzcywgZG9tYWluLnBhZEVuZCg4LCAnXFwwJykpO1xuICAgIGNvbnN0IHsgaWQsIHZhbHVlOiBtYXgsIHN0YXR1cyB9ID0gYXdhaXQgY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0ocmVxRG93bmxvYWQpIGFzIE5tc0RhdGFncmFtO1xuICAgIGlmIChzdGF0dXMgIT09IDApIHtcbiAgICAgIC8vIGRlYnVnKCc8ZXJyb3I+Jywgc3RhdHVzKTtcbiAgICAgIHRocm93IG5ldyBOaWJ1c0Vycm9yKHN0YXR1cyEsIHRoaXMsICdSZXF1ZXN0IGRvd25sb2FkIGRvbWFpbiBlcnJvcicpO1xuICAgIH1cbiAgICBjb25zdCB0ZXJtaW5hdGUgPSBhc3luYyAoZXJyPzogRXJyb3IpID0+IHtcbiAgICAgIGxldCB0ZXJtU3RhdCA9IDA7XG4gICAgICBpZiAoIW5vVGVybSkge1xuICAgICAgICBjb25zdCByZXEgPSBjcmVhdGVObXNUZXJtaW5hdGVEb3dubG9hZFNlcXVlbmNlKHRoaXMuYWRkcmVzcywgaWQpO1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShyZXEpIGFzIE5tc0RhdGFncmFtO1xuICAgICAgICB0ZXJtU3RhdCA9IHJlcy5zdGF0dXMhO1xuICAgICAgfVxuICAgICAgaWYgKGVycikgdGhyb3cgZXJyO1xuICAgICAgaWYgKHRlcm1TdGF0ICE9PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBOaWJ1c0Vycm9yKFxuICAgICAgICAgIHRlcm1TdGF0ISxcbiAgICAgICAgICB0aGlzLFxuICAgICAgICAgICdUZXJtaW5hdGUgZG93bmxvYWQgc2VxdWVuY2UgZXJyb3IsIG1heWJlIG5lZWQgLS1uby10ZXJtJyxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGlmIChidWZmZXIubGVuZ3RoID4gbWF4IC0gb2Zmc2V0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEJ1ZmZlciB0byBsYXJnZS4gRXhwZWN0ZWQgJHttYXggLSBvZmZzZXR9IGJ5dGVzYCk7XG4gICAgfVxuICAgIGNvbnN0IGluaXREb3dubG9hZCA9IGNyZWF0ZU5tc0luaXRpYXRlRG93bmxvYWRTZXF1ZW5jZSh0aGlzLmFkZHJlc3MsIGlkKTtcbiAgICBjb25zdCB7IHN0YXR1czogaW5pdFN0YXQgfSA9IGF3YWl0IGNvbm5lY3Rpb24uc2VuZERhdGFncmFtKGluaXREb3dubG9hZCkgYXMgTm1zRGF0YWdyYW07XG4gICAgaWYgKGluaXRTdGF0ICE9PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgTmlidXNFcnJvcihpbml0U3RhdCEsIHRoaXMsICdJbml0aWF0ZSBkb3dubG9hZCBkb21haW4gZXJyb3InKTtcbiAgICB9XG4gICAgdGhpcy5lbWl0KFxuICAgICAgJ2Rvd25sb2FkU3RhcnQnLFxuICAgICAge1xuICAgICAgICBkb21haW4sXG4gICAgICAgIG9mZnNldCxcbiAgICAgICAgZG9tYWluU2l6ZTogbWF4LFxuICAgICAgICBzaXplOiBidWZmZXIubGVuZ3RoLFxuICAgICAgfSxcbiAgICApO1xuICAgIGNvbnN0IGNyYyA9IGNyYzE2Y2NpdHQoYnVmZmVyLCAwKTtcbiAgICBjb25zdCBjaHVua1NpemUgPSBOTVNfTUFYX0RBVEFfTEVOR1RIIC0gNDtcbiAgICBjb25zdCBjaHVua3MgPSBjaHVua0FycmF5KGJ1ZmZlciwgY2h1bmtTaXplKTtcbiAgICBhd2FpdCBjaHVua3MucmVkdWNlKGFzeW5jIChwcmV2LCBjaHVuazogQnVmZmVyLCBpKSA9PiB7XG4gICAgICBhd2FpdCBwcmV2O1xuICAgICAgY29uc3QgcG9zID0gaSAqIGNodW5rU2l6ZSArIG9mZnNldDtcbiAgICAgIGNvbnN0IHNlZ21lbnREb3dubG9hZCA9XG4gICAgICAgIGNyZWF0ZU5tc0Rvd25sb2FkU2VnbWVudCh0aGlzLmFkZHJlc3MsIGlkISwgcG9zLCBjaHVuayk7XG4gICAgICBjb25zdCB7IHN0YXR1czogZG93bmxvYWRTdGF0IH0gPVxuICAgICAgICBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShzZWdtZW50RG93bmxvYWQpIGFzIE5tc0RhdGFncmFtO1xuICAgICAgaWYgKGRvd25sb2FkU3RhdCAhPT0gMCkge1xuICAgICAgICBhd2FpdCB0ZXJtaW5hdGUobmV3IE5pYnVzRXJyb3IoZG93bmxvYWRTdGF0ISwgdGhpcywgJ0Rvd25sb2FkIHNlZ21lbnQgZXJyb3InKSk7XG4gICAgICB9XG4gICAgICB0aGlzLmVtaXQoXG4gICAgICAgICdkb3dubG9hZERhdGEnLFxuICAgICAgICB7XG4gICAgICAgICAgZG9tYWluLFxuICAgICAgICAgIGxlbmd0aDogY2h1bmsubGVuZ3RoLFxuICAgICAgICB9LFxuICAgICAgKTtcbiAgICB9LCBQcm9taXNlLnJlc29sdmUoKSk7XG4gICAgY29uc3QgdmVyaWZ5ID0gY3JlYXRlTm1zVmVyaWZ5RG9tYWluQ2hlY2tzdW0odGhpcy5hZGRyZXNzLCBpZCwgb2Zmc2V0LCBidWZmZXIubGVuZ3RoLCBjcmMpO1xuICAgIGNvbnN0IHsgc3RhdHVzOiB2ZXJpZnlTdGF0IH0gPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbSh2ZXJpZnkpIGFzIE5tc0RhdGFncmFtO1xuICAgIGlmICh2ZXJpZnlTdGF0ICE9PSAwKSB7XG4gICAgICBhd2FpdCB0ZXJtaW5hdGUobmV3IE5pYnVzRXJyb3IodmVyaWZ5U3RhdCEsIHRoaXMsICdEb3dubG9hZCBzZWdtZW50IGVycm9yJykpO1xuICAgIH1cbiAgICBhd2FpdCB0ZXJtaW5hdGUoKTtcbiAgICB0aGlzLmVtaXQoXG4gICAgICAnZG93bmxvYWRGaW5pc2gnLFxuICAgICAge1xuICAgICAgICBkb21haW4sXG4gICAgICAgIG9mZnNldCxcbiAgICAgICAgc2l6ZTogYnVmZmVyLmxlbmd0aCxcbiAgICAgIH0sXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIGV4ZWN1dGUocHJvZ3JhbTogc3RyaW5nLCBhcmdzPzogUmVjb3JkPHN0cmluZywgYW55Pikge1xuICAgIGNvbnN0IHsgY29ubmVjdGlvbiB9ID0gdGhpcztcbiAgICBpZiAoIWNvbm5lY3Rpb24pIHRocm93IG5ldyBFcnJvcignZGlzY29ubmVjdGVkJyk7XG4gICAgY29uc3Qgc3Vicm91dGluZXMgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdzdWJyb3V0aW5lcycsIHRoaXMpIGFzIFJlY29yZDxzdHJpbmcsIElTdWJyb3V0aW5lRGVzYz47XG4gICAgaWYgKCFzdWJyb3V0aW5lcyB8fCAhUmVmbGVjdC5oYXMoc3Vicm91dGluZXMsIHByb2dyYW0pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gcHJvZ3JhbSAke3Byb2dyYW19YCk7XG4gICAgfVxuICAgIGNvbnN0IHN1YnJvdXRpbmUgPSBzdWJyb3V0aW5lc1twcm9ncmFtXTtcbiAgICBjb25zdCBwcm9wczogVHlwZWRWYWx1ZVtdID0gW107XG4gICAgaWYgKHN1YnJvdXRpbmUuYXJncykge1xuICAgICAgT2JqZWN0LmVudHJpZXMoc3Vicm91dGluZS5hcmdzKS5mb3JFYWNoKChbbmFtZSwgZGVzY10pID0+IHtcbiAgICAgICAgY29uc3QgYXJnID0gYXJncyAmJiBhcmdzW25hbWVdO1xuICAgICAgICBpZiAoIWFyZykgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBhcmcgJHtuYW1lfSBpbiBwcm9ncmFtICR7cHJvZ3JhbX1gKTtcbiAgICAgICAgcHJvcHMucHVzaChbZGVzYy50eXBlLCBhcmddKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBjb25zdCByZXEgPSBjcmVhdGVFeGVjdXRlUHJvZ3JhbUludm9jYXRpb24oXG4gICAgICB0aGlzLmFkZHJlc3MsXG4gICAgICBzdWJyb3V0aW5lLmlkLFxuICAgICAgc3Vicm91dGluZS5ub3RSZXBseSxcbiAgICAgIC4uLnByb3BzLFxuICAgICk7XG4gICAgcmV0dXJuIGNvbm5lY3Rpb24uc2VuZERhdGFncmFtKHJlcSk7XG4gIH1cbn1cblxuLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lXG5pbnRlcmZhY2UgRGV2aWNlUHJvdG90eXBlIHtcbiAgcmVhZG9ubHkgaWQ6IERldmljZUlkO1xuICByZWFkb25seSBhZGRyZXNzOiBBZGRyZXNzO1xuICBbbWliUHJvcGVydHk6IHN0cmluZ106IGFueTtcbiAgJGNvdW50UmVmOiBudW1iZXI7XG4gICRyZWFkPzogUHJvbWlzZTxhbnk+O1xuICBbJHZhbHVlc106IHsgW2lkOiBudW1iZXJdOiBhbnkgfTtcbiAgWyRlcnJvcnNdOiB7IFtpZDogbnVtYmVyXTogRXJyb3IgfTtcbiAgWyRkaXJ0aWVzXTogeyBbaWQ6IG51bWJlcl06IGJvb2xlYW4gfTtcbn1cblxuZnVuY3Rpb24gZmluZE1pYkJ5VHlwZSh0eXBlOiBudW1iZXIsIHZlcnNpb24/OiBudW1iZXIpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBjb25zdCBjb25mID0gcGF0aC5yZXNvbHZlKGNvbmZpZ0RpciB8fCAnL3RtcCcsICdjb25maWdzdG9yZScsIHBrZ05hbWUpO1xuICBjb25zdCB2YWxpZGF0ZSA9IENvbmZpZ1YuZGVjb2RlKHJlcXVpcmUoY29uZikpO1xuICBpZiAodmFsaWRhdGUuaXNMZWZ0KCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgY29uZmlnIGZpbGUgJHtjb25mfVxuICAke1BhdGhSZXBvcnRlci5yZXBvcnQodmFsaWRhdGUpfWApO1xuICB9XG4gIGNvbnN0IHsgbWliVHlwZXMgfSA9IHZhbGlkYXRlLnZhbHVlO1xuICBjb25zdCBtaWJzID0gbWliVHlwZXMhW3R5cGVdO1xuICBpZiAobWlicyAmJiBtaWJzLmxlbmd0aCkge1xuICAgIGxldCBtaWJUeXBlID0gbWlic1swXTtcbiAgICBpZiAodmVyc2lvbiAmJiBtaWJzLmxlbmd0aCA+IDEpIHtcbiAgICAgIG1pYlR5cGUgPSBfLmZpbmRMYXN0KG1pYnMsICh7IG1pblZlcnNpb24gPSAwIH0pID0+IG1pblZlcnNpb24gPD0gdmVyc2lvbikgfHwgbWliVHlwZTtcbiAgICB9XG4gICAgcmV0dXJuIG1pYlR5cGUubWliO1xuICB9XG4gIC8vIGNvbnN0IGNhY2hlTWlicyA9IE9iamVjdC5rZXlzKG1pYlR5cGVzQ2FjaGUpO1xuICAvLyBjb25zdCBjYWNoZWQgPSBjYWNoZU1pYnMuZmluZChtaWIgPT5cbiAgLy8gICBSZWZsZWN0LmdldE1ldGFkYXRhKCdkZXZpY2VUeXBlJywgbWliVHlwZXNDYWNoZVttaWJdLnByb3RvdHlwZSkgPT09IHR5cGUpO1xuICAvLyBpZiAoY2FjaGVkKSByZXR1cm4gY2FjaGVkO1xuICAvLyBjb25zdCBtaWJzID0gZ2V0TWlic1N5bmMoKTtcbiAgLy8gcmV0dXJuIF8uZGlmZmVyZW5jZShtaWJzLCBjYWNoZU1pYnMpLmZpbmQoKG1pYk5hbWUpID0+IHtcbiAgLy8gICBjb25zdCBtaWJmaWxlID0gZ2V0TWliRmlsZShtaWJOYW1lKTtcbiAgLy8gICBjb25zdCBtaWI6IElNaWJEZXZpY2UgPSByZXF1aXJlKG1pYmZpbGUpO1xuICAvLyAgIGNvbnN0IHsgdHlwZXMgfSA9IG1pYjtcbiAgLy8gICBjb25zdCBkZXZpY2UgPSB0eXBlc1ttaWIuZGV2aWNlXSBhcyBJTWliRGV2aWNlVHlwZTtcbiAgLy8gICByZXR1cm4gdG9JbnQoZGV2aWNlLmFwcGluZm8uZGV2aWNlX3R5cGUpID09PSB0eXBlO1xuICAvLyB9KTtcbn1cblxuZXhwb3J0IGRlY2xhcmUgaW50ZXJmYWNlIERldmljZXMge1xuICBvbihldmVudDogJ25ldycgfCAnZGVsZXRlJywgZGV2aWNlTGlzdGVuZXI6IChkZXZpY2U6IElEZXZpY2UpID0+IHZvaWQpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnbmV3JyB8ICdkZWxldGUnLCBkZXZpY2VMaXN0ZW5lcjogKGRldmljZTogSURldmljZSkgPT4gdm9pZCk6IHRoaXM7XG4gIGFkZExpc3RlbmVyKGV2ZW50OiAnbmV3JyB8ICdkZWxldGUnLCBkZXZpY2VMaXN0ZW5lcjogKGRldmljZTogSURldmljZSkgPT4gdm9pZCk6IHRoaXM7XG59XG5cbmZ1bmN0aW9uIGdldENvbnN0cnVjdG9yKG1pYjogc3RyaW5nKTogRnVuY3Rpb24ge1xuICBsZXQgY29uc3RydWN0b3IgPSBtaWJUeXBlc0NhY2hlW21pYl07XG4gIGlmICghY29uc3RydWN0b3IpIHtcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmVcbiAgICBmdW5jdGlvbiBEZXZpY2UodGhpczogRGV2aWNlUHJvdG90eXBlLCBhZGRyZXNzOiBBZGRyZXNzKSB7XG4gICAgICBFdmVudEVtaXR0ZXIuYXBwbHkodGhpcyk7XG4gICAgICB0aGlzWyR2YWx1ZXNdID0ge307XG4gICAgICB0aGlzWyRlcnJvcnNdID0ge307XG4gICAgICB0aGlzWyRkaXJ0aWVzXSA9IHt9O1xuICAgICAgUmVmbGVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnYWRkcmVzcycsIHdpdGhWYWx1ZShhZGRyZXNzKSk7XG4gICAgICB0aGlzLiRjb3VudFJlZiA9IDE7XG4gICAgICAodGhpcyBhcyBhbnkpLmlkID0gdGltZWlkKCkgYXMgRGV2aWNlSWQ7XG4gICAgICAvLyBkZWJ1ZyhuZXcgRXJyb3IoJ0NSRUFURScpLnN0YWNrKTtcbiAgICB9XG5cbiAgICBjb25zdCBwcm90b3R5cGUgPSBuZXcgRGV2aWNlUHJvdG90eXBlKG1pYik7XG4gICAgRGV2aWNlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUocHJvdG90eXBlKTtcbiAgICAoRGV2aWNlIGFzIGFueSkuZGlzcGxheU5hbWUgPSBgJHttaWJbMF0udG9VcHBlckNhc2UoKX0ke21pYi5zbGljZSgxKX1gO1xuICAgIGNvbnN0cnVjdG9yID0gRGV2aWNlO1xuICAgIG1pYlR5cGVzQ2FjaGVbbWliXSA9IGNvbnN0cnVjdG9yO1xuICB9XG4gIHJldHVybiBjb25zdHJ1Y3Rvcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE1pYlByb3RvdHlwZShtaWI6IHN0cmluZyk6IE9iamVjdCB7XG4gIHJldHVybiBnZXRDb25zdHJ1Y3RvcihtaWIpLnByb3RvdHlwZTtcbn1cblxuZXhwb3J0IGNsYXNzIERldmljZXMgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICBnZXQgPSAoKTogSURldmljZVtdID0+IF8udmFsdWVzKGRldmljZU1hcCk7XG5cbiAgZmluZCA9IChhZGRyZXNzOiBBZGRyZXNzUGFyYW0pOiBJRGV2aWNlIHwgdW5kZWZpbmVkID0+IHtcbiAgICBjb25zdCB0YXJnZXRBZGRyZXNzID0gbmV3IEFkZHJlc3MoYWRkcmVzcyk7XG4gICAgcmV0dXJuIGRldmljZU1hcFt0YXJnZXRBZGRyZXNzLnRvU3RyaW5nKCldO1xuICB9O1xuXG4gIGNyZWF0ZShhZGRyZXNzOiBBZGRyZXNzUGFyYW0sIG1pYjogc3RyaW5nKTogSURldmljZTtcbiAgY3JlYXRlKGFkZHJlc3M6IEFkZHJlc3NQYXJhbSwgdHlwZTogbnVtYmVyLCB2ZXJzaW9uPzogbnVtYmVyKTogSURldmljZTtcbiAgY3JlYXRlKGFkZHJlc3M6IEFkZHJlc3NQYXJhbSwgbWliT3JUeXBlOiBhbnksIHZlcnNpb24/OiBudW1iZXIpOiBJRGV2aWNlIHtcbiAgICBsZXQgbWliOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgaWYgKHR5cGVvZiBtaWJPclR5cGUgPT09ICdudW1iZXInKSB7XG4gICAgICBtaWIgPSBmaW5kTWliQnlUeXBlKG1pYk9yVHlwZSwgdmVyc2lvbik7XG4gICAgICBpZiAobWliID09PSB1bmRlZmluZWQpIHRocm93IG5ldyBFcnJvcignVW5rbm93biBtaWIgdHlwZScpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1pYk9yVHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG1pYiA9IFN0cmluZyhtaWJPclR5cGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1pYiBvciB0eXBlIGV4cGVjdGVkLCBnb3QgJHttaWJPclR5cGV9YCk7XG4gICAgfVxuICAgIGNvbnN0IHRhcmdldEFkZHJlc3MgPSBuZXcgQWRkcmVzcyhhZGRyZXNzKTtcbiAgICBsZXQgZGV2aWNlID0gZGV2aWNlTWFwW3RhcmdldEFkZHJlc3MudG9TdHJpbmcoKV07XG4gICAgaWYgKGRldmljZSkge1xuICAgICAgY29uc29sZS5hc3NlcnQoXG4gICAgICAgIFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21pYicsIGRldmljZSkgPT09IG1pYixcbiAgICAgICAgYG1pYnMgYXJlIGRpZmZlcmVudCwgZXhwZWN0ZWQgJHttaWJ9YCxcbiAgICAgICk7XG4gICAgICBkZXZpY2UuYWRkcmVmKCk7XG4gICAgICByZXR1cm4gZGV2aWNlO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnN0cnVjdG9yID0gZ2V0Q29uc3RydWN0b3IobWliKTtcbiAgICBkZXZpY2UgPSBSZWZsZWN0LmNvbnN0cnVjdChjb25zdHJ1Y3RvciwgW3RhcmdldEFkZHJlc3NdKTtcbiAgICBpZiAoIXRhcmdldEFkZHJlc3MuaXNFbXB0eSkge1xuICAgICAgZGV2aWNlTWFwW3RhcmdldEFkZHJlc3MudG9TdHJpbmcoKV0gPSBkZXZpY2U7XG4gICAgICBwcm9jZXNzLm5leHRUaWNrKCgpID0+IHRoaXMuZW1pdCgnbmV3JywgZGV2aWNlKSk7XG4gICAgfVxuICAgIHJldHVybiBkZXZpY2U7XG4gIH1cbn1cblxuY29uc3QgZGV2aWNlcyA9IG5ldyBEZXZpY2VzKCk7XG5cbmV4cG9ydCBkZWZhdWx0IGRldmljZXM7XG4iXX0=