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
    values[id] = safeNumber(value);
    delete errors[id];
    this.setDirty(id, isDirty);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taWIvZGV2aWNlcy50cyJdLCJuYW1lcyI6WyJwa2dOYW1lIiwiZGVidWciLCIkdmFsdWVzIiwiU3ltYm9sIiwiJGVycm9ycyIsIiRkaXJ0aWVzIiwic2FmZU51bWJlciIsInZhbCIsIm51bSIsInBhcnNlRmxvYXQiLCJOdW1iZXIiLCJpc05hTiIsIlByaXZhdGVQcm9wcyIsImRldmljZU1hcCIsIm1pYlR5cGVzQ2FjaGUiLCJNaWJQcm9wZXJ0eUFwcEluZm9WIiwidCIsImludGVyc2VjdGlvbiIsInR5cGUiLCJubXNfaWQiLCJ1bmlvbiIsInN0cmluZyIsIkludCIsImFjY2VzcyIsInBhcnRpYWwiLCJjYXRlZ29yeSIsIk1pYlByb3BlcnR5ViIsImFubm90YXRpb24iLCJhcHBpbmZvIiwiTWliRGV2aWNlQXBwSW5mb1YiLCJtaWJfdmVyc2lvbiIsImRldmljZV90eXBlIiwibG9hZGVyX3R5cGUiLCJmaXJtd2FyZSIsIm1pbl92ZXJzaW9uIiwiTWliRGV2aWNlVHlwZVYiLCJwcm9wZXJ0aWVzIiwicmVjb3JkIiwiTWliVHlwZVYiLCJiYXNlIiwiemVybyIsInVuaXRzIiwicHJlY2lzaW9uIiwicmVwcmVzZW50YXRpb24iLCJtaW5JbmNsdXNpdmUiLCJtYXhJbmNsdXNpdmUiLCJlbnVtZXJhdGlvbiIsIk1pYlN1YnJvdXRpbmVWIiwicmVzcG9uc2UiLCJTdWJyb3V0aW5lVHlwZVYiLCJpZCIsImxpdGVyYWwiLCJNaWJEZXZpY2VWIiwiZGV2aWNlIiwidHlwZXMiLCJzdWJyb3V0aW5lcyIsImdldEJhc2VUeXBlIiwic3VwZXJUeXBlIiwiZGVmaW5lTWliUHJvcGVydHkiLCJ0YXJnZXQiLCJrZXkiLCJwcm9wIiwicHJvcGVydHlLZXkiLCJSZWZsZWN0IiwiZGVmaW5lTWV0YWRhdGEiLCJzaW1wbGVUeXBlIiwiY29udmVydGVycyIsImlzUmVhZGFibGUiLCJpbmRleE9mIiwiaXNXcml0YWJsZSIsIm1pbiIsIm1heCIsIk5tc1ZhbHVlVHlwZSIsIkludDgiLCJJbnQxNiIsIkludDMyIiwiVUludDgiLCJVSW50MTYiLCJVSW50MzIiLCJwdXNoIiwiZml4ZWRQb2ludE51bWJlcjRDb252ZXJ0ZXIiLCJwZXJjZW50Q29udmVydGVyIiwidW5kZWZpbmVkIiwiTWF0aCIsImluZm8iLCJzaXplIiwiT2JqZWN0IiwiZW50cmllcyIsIm1hcCIsInZlcnNpb25UeXBlQ29udmVydGVyIiwiYm9vbGVhbkNvbnZlcnRlciIsIm5hbWUiLCJhdHRyaWJ1dGVzIiwiZW51bWVyYWJsZSIsInRvIiwiZnJvbSIsImdldCIsImNvbnNvbGUiLCJhc3NlcnQiLCJ2YWx1ZSIsImdldEVycm9yIiwiZ2V0UmF3VmFsdWUiLCJzZXQiLCJuZXdWYWx1ZSIsIkVycm9yIiwiSlNPTiIsInN0cmluZ2lmeSIsInNldFJhd1ZhbHVlIiwiZGVmaW5lUHJvcGVydHkiLCJnZXRNaWJGaWxlIiwibWlibmFtZSIsInBhdGgiLCJyZXNvbHZlIiwiX19kaXJuYW1lIiwiRGV2aWNlUHJvdG90eXBlIiwiRXZlbnRFbWl0dGVyIiwiY29uc3RydWN0b3IiLCJtaWJmaWxlIiwibWliVmFsaWRhdGlvbiIsImRlY29kZSIsInJlcXVpcmUiLCJpc0xlZnQiLCJQYXRoUmVwb3J0ZXIiLCJyZXBvcnQiLCJtaWIiLCJlcnJvclR5cGUiLCJtZXRhc3VicyIsIl8iLCJ0cmFuc2Zvcm0iLCJyZXN1bHQiLCJzdWIiLCJkZXNjcmlwdGlvbiIsImFyZ3MiLCJkZXNjIiwia2V5cyIsIm93bktleXMiLCJ2YWxpZEpzTmFtZSIsImZvckVhY2giLCJwcm9wTmFtZSIsImNvbm5lY3Rpb24iLCJ2YWx1ZXMiLCJwcmV2IiwiZW1pdCIsInRvSlNPTiIsImpzb24iLCJnZXRNZXRhZGF0YSIsImFkZHJlc3MiLCJ0b1N0cmluZyIsImdldElkIiwiaWRPck5hbWUiLCJpc0ludGVnZXIiLCJoYXMiLCJnZXROYW1lIiwiaW5jbHVkZXMiLCJpc0RpcnR5IiwiZXJyb3JzIiwic2V0RGlydHkiLCJzZXRFcnJvciIsImVycm9yIiwiZGlydGllcyIsIm5hbWVzIiwiYWRkcmVmIiwiJGNvdW50UmVmIiwic3RhY2siLCJyZWxlYXNlIiwiZGV2aWNlcyIsImRyYWluIiwiaWRzIiwiZmlsdGVyIiwibGVuZ3RoIiwid3JpdGUiLCJjYXRjaCIsIlByb21pc2UiLCJ3cml0ZUFsbCIsInJlamVjdCIsImpvaW4iLCJyZXF1ZXN0cyIsInJlZHVjZSIsImFjYyIsImFsbCIsImRhdGFncmFtIiwic2VuZERhdGFncmFtIiwidGhlbiIsInN0YXR1cyIsIk5pYnVzRXJyb3IiLCJyZWFzb24iLCJ3cml0ZVZhbHVlcyIsInNvdXJjZSIsInN0cm9uZyIsIlR5cGVFcnJvciIsImFzc2lnbiIsIndyaXR0ZW4iLCJlcnIiLCJyZWFkQWxsIiwiJHJlYWQiLCJzb3J0IiwicmVhZCIsImNsZWFyIiwiZmluYWxseSIsImRpc2FibGVCYXRjaFJlYWRpbmciLCJjaHVua3MiLCJjaHVuayIsInByb21pc2UiLCJkYXRhZ3JhbXMiLCJBcnJheSIsImlzQXJyYXkiLCJtZXNzYWdlIiwidXBsb2FkIiwiZG9tYWluIiwib2Zmc2V0IiwicmVxVXBsb2FkIiwicGFkRW5kIiwiZG9tYWluU2l6ZSIsImluaXRVcGxvYWQiLCJpbml0U3RhdCIsInRvdGFsIiwicmVzdCIsInBvcyIsImJ1ZnMiLCJ1cGxvYWRTZWdtZW50IiwidXBsb2FkU3RhdHVzIiwiZGF0YSIsIkJ1ZmZlciIsImNvbmNhdCIsImUiLCJkb3dubG9hZCIsImJ1ZmZlciIsIm5vVGVybSIsInJlcURvd25sb2FkIiwidGVybWluYXRlIiwidGVybVN0YXQiLCJyZXEiLCJyZXMiLCJpbml0RG93bmxvYWQiLCJjcmMiLCJjaHVua1NpemUiLCJOTVNfTUFYX0RBVEFfTEVOR1RIIiwiaSIsInNlZ21lbnREb3dubG9hZCIsImRvd25sb2FkU3RhdCIsInZlcmlmeSIsInZlcmlmeVN0YXQiLCJleGVjdXRlIiwicHJvZ3JhbSIsInN1YnJvdXRpbmUiLCJwcm9wcyIsImFyZyIsIm5vdFJlcGx5IiwiZmluZE1pYkJ5VHlwZSIsInZlcnNpb24iLCJjb25mIiwiY29uZmlnRGlyIiwidmFsaWRhdGUiLCJDb25maWdWIiwibWliVHlwZXMiLCJtaWJzIiwibWliVHlwZSIsImZpbmRMYXN0IiwibWluVmVyc2lvbiIsImdldENvbnN0cnVjdG9yIiwiRGV2aWNlIiwiYXBwbHkiLCJwcm90b3R5cGUiLCJjcmVhdGUiLCJkaXNwbGF5TmFtZSIsInRvVXBwZXJDYXNlIiwic2xpY2UiLCJnZXRNaWJQcm90b3R5cGUiLCJEZXZpY2VzIiwidGFyZ2V0QWRkcmVzcyIsIkFkZHJlc3MiLCJtaWJPclR5cGUiLCJTdHJpbmciLCJjb25zdHJ1Y3QiLCJpc0VtcHR5IiwicHJvY2VzcyIsIm5leHRUaWNrIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQVdBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUVBOztBQUNBOztBQWdCQTs7QUFDQTs7QUFDQTs7QUFDQTs7Ozs7Ozs7QUFvQkE7QUFDQTtBQUVBLE1BQU1BLE9BQU8sR0FBRyxnQkFBaEIsQyxDQUFrQzs7QUFFbEMsTUFBTUMsS0FBSyxHQUFHLG9CQUFhLGVBQWIsQ0FBZDtBQUVBLE1BQU1DLE9BQU8sR0FBR0MsTUFBTSxDQUFDLFFBQUQsQ0FBdEI7QUFDQSxNQUFNQyxPQUFPLEdBQUdELE1BQU0sQ0FBQyxRQUFELENBQXRCO0FBQ0EsTUFBTUUsUUFBUSxHQUFHRixNQUFNLENBQUMsU0FBRCxDQUF2Qjs7QUFFQSxTQUFTRyxVQUFULENBQW9CQyxHQUFwQixFQUE4QjtBQUM1QixRQUFNQyxHQUFHLEdBQUdDLFVBQVUsQ0FBQ0YsR0FBRCxDQUF0QjtBQUNBLFNBQVFHLE1BQU0sQ0FBQ0MsS0FBUCxDQUFhSCxHQUFiLEtBQXNCLEdBQUVBLEdBQUksRUFBUCxLQUFhRCxHQUFuQyxHQUEwQ0EsR0FBMUMsR0FBZ0RDLEdBQXZEO0FBQ0Q7O0lBRUlJLFk7O1dBQUFBLFk7QUFBQUEsRUFBQUEsWSxDQUFBQSxZO0dBQUFBLFksS0FBQUEsWTs7QUFJTCxNQUFNQyxTQUFpRCxHQUFHLEVBQTFEO0FBRUEsTUFBTUMsYUFBOEMsR0FBRyxFQUF2RDtBQUVBLE1BQU1DLG1CQUFtQixHQUFHQyxDQUFDLENBQUNDLFlBQUYsQ0FBZSxDQUN6Q0QsQ0FBQyxDQUFDRSxJQUFGLENBQU87QUFDTEMsRUFBQUEsTUFBTSxFQUFFSCxDQUFDLENBQUNJLEtBQUYsQ0FBUSxDQUFDSixDQUFDLENBQUNLLE1BQUgsRUFBV0wsQ0FBQyxDQUFDTSxHQUFiLENBQVIsQ0FESDtBQUVMQyxFQUFBQSxNQUFNLEVBQUVQLENBQUMsQ0FBQ0s7QUFGTCxDQUFQLENBRHlDLEVBS3pDTCxDQUFDLENBQUNRLE9BQUYsQ0FBVTtBQUNSQyxFQUFBQSxRQUFRLEVBQUVULENBQUMsQ0FBQ0s7QUFESixDQUFWLENBTHlDLENBQWYsQ0FBNUIsQyxDQVVBOztBQUVBLE1BQU1LLFlBQVksR0FBR1YsQ0FBQyxDQUFDRSxJQUFGLENBQU87QUFDMUJBLEVBQUFBLElBQUksRUFBRUYsQ0FBQyxDQUFDSyxNQURrQjtBQUUxQk0sRUFBQUEsVUFBVSxFQUFFWCxDQUFDLENBQUNLLE1BRlk7QUFHMUJPLEVBQUFBLE9BQU8sRUFBRWI7QUFIaUIsQ0FBUCxDQUFyQjtBQVVBLE1BQU1jLGlCQUFpQixHQUFHYixDQUFDLENBQUNDLFlBQUYsQ0FBZSxDQUN2Q0QsQ0FBQyxDQUFDRSxJQUFGLENBQU87QUFDTFksRUFBQUEsV0FBVyxFQUFFZCxDQUFDLENBQUNLO0FBRFYsQ0FBUCxDQUR1QyxFQUl2Q0wsQ0FBQyxDQUFDUSxPQUFGLENBQVU7QUFDUk8sRUFBQUEsV0FBVyxFQUFFZixDQUFDLENBQUNLLE1BRFA7QUFFUlcsRUFBQUEsV0FBVyxFQUFFaEIsQ0FBQyxDQUFDSyxNQUZQO0FBR1JZLEVBQUFBLFFBQVEsRUFBRWpCLENBQUMsQ0FBQ0ssTUFISjtBQUlSYSxFQUFBQSxXQUFXLEVBQUVsQixDQUFDLENBQUNLO0FBSlAsQ0FBVixDQUp1QyxDQUFmLENBQTFCO0FBWUEsTUFBTWMsY0FBYyxHQUFHbkIsQ0FBQyxDQUFDRSxJQUFGLENBQU87QUFDNUJTLEVBQUFBLFVBQVUsRUFBRVgsQ0FBQyxDQUFDSyxNQURjO0FBRTVCTyxFQUFBQSxPQUFPLEVBQUVDLGlCQUZtQjtBQUc1Qk8sRUFBQUEsVUFBVSxFQUFFcEIsQ0FBQyxDQUFDcUIsTUFBRixDQUFTckIsQ0FBQyxDQUFDSyxNQUFYLEVBQW1CSyxZQUFuQjtBQUhnQixDQUFQLENBQXZCO0FBUUEsTUFBTVksUUFBUSxHQUFHdEIsQ0FBQyxDQUFDQyxZQUFGLENBQWUsQ0FDOUJELENBQUMsQ0FBQ0UsSUFBRixDQUFPO0FBQ0xxQixFQUFBQSxJQUFJLEVBQUV2QixDQUFDLENBQUNLO0FBREgsQ0FBUCxDQUQ4QixFQUk5QkwsQ0FBQyxDQUFDUSxPQUFGLENBQVU7QUFDUkksRUFBQUEsT0FBTyxFQUFFWixDQUFDLENBQUNRLE9BQUYsQ0FBVTtBQUNqQmdCLElBQUFBLElBQUksRUFBRXhCLENBQUMsQ0FBQ0ssTUFEUztBQUVqQm9CLElBQUFBLEtBQUssRUFBRXpCLENBQUMsQ0FBQ0ssTUFGUTtBQUdqQnFCLElBQUFBLFNBQVMsRUFBRTFCLENBQUMsQ0FBQ0ssTUFISTtBQUlqQnNCLElBQUFBLGNBQWMsRUFBRTNCLENBQUMsQ0FBQ0s7QUFKRCxHQUFWLENBREQ7QUFPUnVCLEVBQUFBLFlBQVksRUFBRTVCLENBQUMsQ0FBQ0ssTUFQUjtBQVFSd0IsRUFBQUEsWUFBWSxFQUFFN0IsQ0FBQyxDQUFDSyxNQVJSO0FBU1J5QixFQUFBQSxXQUFXLEVBQUU5QixDQUFDLENBQUNxQixNQUFGLENBQVNyQixDQUFDLENBQUNLLE1BQVgsRUFBbUJMLENBQUMsQ0FBQ0UsSUFBRixDQUFPO0FBQUVTLElBQUFBLFVBQVUsRUFBRVgsQ0FBQyxDQUFDSztBQUFoQixHQUFQLENBQW5CO0FBVEwsQ0FBVixDQUo4QixDQUFmLENBQWpCO0FBbUJBLE1BQU0wQixjQUFjLEdBQUcvQixDQUFDLENBQUNDLFlBQUYsQ0FBZSxDQUNwQ0QsQ0FBQyxDQUFDRSxJQUFGLENBQU87QUFDTFMsRUFBQUEsVUFBVSxFQUFFWCxDQUFDLENBQUNLLE1BRFQ7QUFFTE8sRUFBQUEsT0FBTyxFQUFFWixDQUFDLENBQUNDLFlBQUYsQ0FBZSxDQUN0QkQsQ0FBQyxDQUFDRSxJQUFGLENBQU87QUFBRUMsSUFBQUEsTUFBTSxFQUFFSCxDQUFDLENBQUNJLEtBQUYsQ0FBUSxDQUFDSixDQUFDLENBQUNLLE1BQUgsRUFBV0wsQ0FBQyxDQUFDTSxHQUFiLENBQVI7QUFBVixHQUFQLENBRHNCLEVBRXRCTixDQUFDLENBQUNRLE9BQUYsQ0FBVTtBQUFFd0IsSUFBQUEsUUFBUSxFQUFFaEMsQ0FBQyxDQUFDSztBQUFkLEdBQVYsQ0FGc0IsQ0FBZjtBQUZKLENBQVAsQ0FEb0MsRUFRcENMLENBQUMsQ0FBQ1EsT0FBRixDQUFVO0FBQ1JZLEVBQUFBLFVBQVUsRUFBRXBCLENBQUMsQ0FBQ3FCLE1BQUYsQ0FBU3JCLENBQUMsQ0FBQ0ssTUFBWCxFQUFtQkwsQ0FBQyxDQUFDRSxJQUFGLENBQU87QUFDcENBLElBQUFBLElBQUksRUFBRUYsQ0FBQyxDQUFDSyxNQUQ0QjtBQUVwQ00sSUFBQUEsVUFBVSxFQUFFWCxDQUFDLENBQUNLO0FBRnNCLEdBQVAsQ0FBbkI7QUFESixDQUFWLENBUm9DLENBQWYsQ0FBdkI7QUFnQkEsTUFBTTRCLGVBQWUsR0FBR2pDLENBQUMsQ0FBQ0UsSUFBRixDQUFPO0FBQzdCUyxFQUFBQSxVQUFVLEVBQUVYLENBQUMsQ0FBQ0ssTUFEZTtBQUU3QmUsRUFBQUEsVUFBVSxFQUFFcEIsQ0FBQyxDQUFDRSxJQUFGLENBQU87QUFDakJnQyxJQUFBQSxFQUFFLEVBQUVsQyxDQUFDLENBQUNFLElBQUYsQ0FBTztBQUNUQSxNQUFBQSxJQUFJLEVBQUVGLENBQUMsQ0FBQ21DLE9BQUYsQ0FBVSxrQkFBVixDQURHO0FBRVR4QixNQUFBQSxVQUFVLEVBQUVYLENBQUMsQ0FBQ0s7QUFGTCxLQUFQO0FBRGEsR0FBUDtBQUZpQixDQUFQLENBQXhCO0FBVU8sTUFBTStCLFVBQVUsR0FBR3BDLENBQUMsQ0FBQ0MsWUFBRixDQUFlLENBQ3ZDRCxDQUFDLENBQUNFLElBQUYsQ0FBTztBQUNMbUMsRUFBQUEsTUFBTSxFQUFFckMsQ0FBQyxDQUFDSyxNQURMO0FBRUxpQyxFQUFBQSxLQUFLLEVBQUV0QyxDQUFDLENBQUNxQixNQUFGLENBQVNyQixDQUFDLENBQUNLLE1BQVgsRUFBbUJMLENBQUMsQ0FBQ0ksS0FBRixDQUFRLENBQUNlLGNBQUQsRUFBaUJHLFFBQWpCLEVBQTJCVyxlQUEzQixDQUFSLENBQW5CO0FBRkYsQ0FBUCxDQUR1QyxFQUt2Q2pDLENBQUMsQ0FBQ1EsT0FBRixDQUFVO0FBQ1IrQixFQUFBQSxXQUFXLEVBQUV2QyxDQUFDLENBQUNxQixNQUFGLENBQVNyQixDQUFDLENBQUNLLE1BQVgsRUFBbUIwQixjQUFuQjtBQURMLENBQVYsQ0FMdUMsQ0FBZixDQUFuQjs7O0FBMkhQLFNBQVNTLFdBQVQsQ0FBcUJGLEtBQXJCLEVBQWlEcEMsSUFBakQsRUFBdUU7QUFDckUsTUFBSXFCLElBQUksR0FBR3JCLElBQVg7O0FBQ0EsT0FBSyxJQUFJdUMsU0FBbUIsR0FBR0gsS0FBSyxDQUFDZixJQUFELENBQXBDLEVBQXdEa0IsU0FBUyxJQUFJLElBQXJFLEVBQ0tBLFNBQVMsR0FBR0gsS0FBSyxDQUFDRyxTQUFTLENBQUNsQixJQUFYLENBRHRCLEVBQ29EO0FBQ2xEQSxJQUFBQSxJQUFJLEdBQUdrQixTQUFTLENBQUNsQixJQUFqQjtBQUNEOztBQUNELFNBQU9BLElBQVA7QUFDRDs7QUFFRCxTQUFTbUIsaUJBQVQsQ0FDRUMsTUFERixFQUVFQyxHQUZGLEVBR0VOLEtBSEYsRUFJRU8sSUFKRixFQUl3QztBQUN0QyxRQUFNQyxXQUFXLEdBQUcsc0JBQVlGLEdBQVosQ0FBcEI7QUFDQSxRQUFNO0FBQUVoQyxJQUFBQTtBQUFGLE1BQWNpQyxJQUFwQjtBQUNBLFFBQU1YLEVBQUUsR0FBRyxnQkFBTXRCLE9BQU8sQ0FBQ1QsTUFBZCxDQUFYO0FBQ0E0QyxFQUFBQSxPQUFPLENBQUNDLGNBQVIsQ0FBdUIsSUFBdkIsRUFBNkJkLEVBQTdCLEVBQWlDUyxNQUFqQyxFQUF5Q0csV0FBekM7QUFDQSxRQUFNRyxVQUFVLEdBQUdULFdBQVcsQ0FBQ0YsS0FBRCxFQUFRTyxJQUFJLENBQUMzQyxJQUFiLENBQTlCO0FBQ0EsUUFBTUEsSUFBSSxHQUFHb0MsS0FBSyxDQUFDTyxJQUFJLENBQUMzQyxJQUFOLENBQWxCO0FBQ0EsUUFBTWdELFVBQXdCLEdBQUcsRUFBakM7QUFDQSxRQUFNQyxVQUFVLEdBQUd2QyxPQUFPLENBQUNMLE1BQVIsQ0FBZTZDLE9BQWYsQ0FBdUIsR0FBdkIsSUFBOEIsQ0FBQyxDQUFsRDtBQUNBLFFBQU1DLFVBQVUsR0FBR3pDLE9BQU8sQ0FBQ0wsTUFBUixDQUFlNkMsT0FBZixDQUF1QixHQUF2QixJQUE4QixDQUFDLENBQWxEO0FBQ0EsTUFBSXRCLFdBQUo7QUFDQSxNQUFJd0IsR0FBSjtBQUNBLE1BQUlDLEdBQUo7O0FBQ0EsVUFBUSxxQkFBV04sVUFBWCxDQUFSO0FBQ0UsU0FBS08sc0JBQWFDLElBQWxCO0FBQ0VILE1BQUFBLEdBQUcsR0FBRyxDQUFDLEdBQVA7QUFDQUMsTUFBQUEsR0FBRyxHQUFHLEdBQU47QUFDQTs7QUFDRixTQUFLQyxzQkFBYUUsS0FBbEI7QUFDRUosTUFBQUEsR0FBRyxHQUFHLENBQUMsS0FBUDtBQUNBQyxNQUFBQSxHQUFHLEdBQUcsS0FBTjtBQUNBOztBQUNGLFNBQUtDLHNCQUFhRyxLQUFsQjtBQUNFTCxNQUFBQSxHQUFHLEdBQUcsQ0FBQyxVQUFQO0FBQ0FDLE1BQUFBLEdBQUcsR0FBRyxVQUFOO0FBQ0E7O0FBQ0YsU0FBS0Msc0JBQWFJLEtBQWxCO0FBQ0VOLE1BQUFBLEdBQUcsR0FBRyxDQUFOO0FBQ0FDLE1BQUFBLEdBQUcsR0FBRyxHQUFOO0FBQ0E7O0FBQ0YsU0FBS0Msc0JBQWFLLE1BQWxCO0FBQ0VQLE1BQUFBLEdBQUcsR0FBRyxDQUFOO0FBQ0FDLE1BQUFBLEdBQUcsR0FBRyxLQUFOO0FBQ0E7O0FBQ0YsU0FBS0Msc0JBQWFNLE1BQWxCO0FBQ0VSLE1BQUFBLEdBQUcsR0FBRyxDQUFOO0FBQ0FDLE1BQUFBLEdBQUcsR0FBRyxVQUFOO0FBQ0E7QUF4Qko7O0FBMEJBLFVBQVFOLFVBQVI7QUFDRSxTQUFLLGNBQUw7QUFDRUMsTUFBQUEsVUFBVSxDQUFDYSxJQUFYLENBQWdCLGdDQUFzQjdELElBQXRCLENBQWhCO0FBQ0E7O0FBQ0YsU0FBSyxtQkFBTDtBQUNFZ0QsTUFBQUEsVUFBVSxDQUFDYSxJQUFYLENBQWdCQywrQkFBaEI7QUFDQTs7QUFDRjtBQUNFO0FBUko7O0FBVUEsTUFBSXBCLEdBQUcsS0FBSyxZQUFSLElBQXdCQyxJQUFJLENBQUMzQyxJQUFMLEtBQWMsaUJBQTFDLEVBQTZEO0FBQzNEZ0QsSUFBQUEsVUFBVSxDQUFDYSxJQUFYLENBQWdCRSxxQkFBaEI7QUFDQWxCLElBQUFBLE9BQU8sQ0FBQ0MsY0FBUixDQUF1QixNQUF2QixFQUErQixHQUEvQixFQUFvQ0wsTUFBcEMsRUFBNENHLFdBQTVDO0FBQ0FDLElBQUFBLE9BQU8sQ0FBQ0MsY0FBUixDQUF1QixLQUF2QixFQUE4QixDQUE5QixFQUFpQ0wsTUFBakMsRUFBeUNHLFdBQXpDO0FBQ0FDLElBQUFBLE9BQU8sQ0FBQ0MsY0FBUixDQUF1QixLQUF2QixFQUE4QixHQUE5QixFQUFtQ0wsTUFBbkMsRUFBMkNHLFdBQTNDO0FBQ0QsR0FMRCxNQUtPLElBQUlPLFVBQUosRUFBZ0I7QUFDckIsUUFBSW5ELElBQUksSUFBSSxJQUFaLEVBQWtCO0FBQ2hCLFlBQU07QUFBRTBCLFFBQUFBLFlBQUY7QUFBZ0JDLFFBQUFBO0FBQWhCLFVBQWlDM0IsSUFBdkM7O0FBQ0EsVUFBSTBCLFlBQUosRUFBa0I7QUFDaEIsY0FBTXJDLEdBQUcsR0FBR0UsVUFBVSxDQUFDbUMsWUFBRCxDQUF0QjtBQUNBMEIsUUFBQUEsR0FBRyxHQUFHQSxHQUFHLEtBQUtZLFNBQVIsR0FBb0JDLElBQUksQ0FBQ1osR0FBTCxDQUFTRCxHQUFULEVBQWMvRCxHQUFkLENBQXBCLEdBQXlDQSxHQUEvQztBQUNEOztBQUNELFVBQUlzQyxZQUFKLEVBQWtCO0FBQ2hCLGNBQU10QyxHQUFHLEdBQUdFLFVBQVUsQ0FBQ29DLFlBQUQsQ0FBdEI7QUFDQTBCLFFBQUFBLEdBQUcsR0FBR0EsR0FBRyxLQUFLVyxTQUFSLEdBQW9CQyxJQUFJLENBQUNiLEdBQUwsQ0FBU0MsR0FBVCxFQUFjaEUsR0FBZCxDQUFwQixHQUF5Q0EsR0FBL0M7QUFDRDtBQUNGOztBQUNELFFBQUkrRCxHQUFHLEtBQUtZLFNBQVosRUFBdUI7QUFDckJaLE1BQUFBLEdBQUcsR0FBRyxvQkFBVUosVUFBVixFQUFzQkksR0FBdEIsQ0FBTjtBQUNBSixNQUFBQSxVQUFVLENBQUNhLElBQVgsQ0FBZ0IsZ0NBQXNCVCxHQUF0QixDQUFoQjtBQUNBUCxNQUFBQSxPQUFPLENBQUNDLGNBQVIsQ0FBdUIsS0FBdkIsRUFBOEJNLEdBQTlCLEVBQW1DWCxNQUFuQyxFQUEyQ0csV0FBM0M7QUFDRDs7QUFDRCxRQUFJUyxHQUFHLEtBQUtXLFNBQVosRUFBdUI7QUFDckJYLE1BQUFBLEdBQUcsR0FBRyxvQkFBVUwsVUFBVixFQUFzQkssR0FBdEIsQ0FBTjtBQUNBTCxNQUFBQSxVQUFVLENBQUNhLElBQVgsQ0FBZ0IsZ0NBQXNCUixHQUF0QixDQUFoQjtBQUNBUixNQUFBQSxPQUFPLENBQUNDLGNBQVIsQ0FBdUIsS0FBdkIsRUFBOEJPLEdBQTlCLEVBQW1DWixNQUFuQyxFQUEyQ0csV0FBM0M7QUFDRDtBQUNGOztBQUNELE1BQUk1QyxJQUFJLElBQUksSUFBWixFQUFrQjtBQUNoQixVQUFNO0FBQUVVLE1BQUFBLE9BQU8sRUFBRXdELElBQUksR0FBRztBQUFsQixRQUF5QmxFLElBQS9CO0FBQ0E0QixJQUFBQSxXQUFXLEdBQUc1QixJQUFJLENBQUM0QixXQUFuQjtBQUNBLFVBQU07QUFBRUwsTUFBQUEsS0FBRjtBQUFTQyxNQUFBQSxTQUFUO0FBQW9CQyxNQUFBQTtBQUFwQixRQUF1Q3lDLElBQTdDO0FBQ0EsVUFBTUMsSUFBSSxHQUFHLHFCQUFXcEIsVUFBWCxDQUFiOztBQUNBLFFBQUl4QixLQUFKLEVBQVc7QUFDVHlCLE1BQUFBLFVBQVUsQ0FBQ2EsSUFBWCxDQUFnQix3QkFBY3RDLEtBQWQsQ0FBaEI7QUFDQXNCLE1BQUFBLE9BQU8sQ0FBQ0MsY0FBUixDQUF1QixNQUF2QixFQUErQnZCLEtBQS9CLEVBQXNDa0IsTUFBdEMsRUFBOENHLFdBQTlDO0FBQ0Q7O0FBQ0RwQixJQUFBQSxTQUFTLElBQUl3QixVQUFVLENBQUNhLElBQVgsQ0FBZ0IsNkJBQW1CckMsU0FBbkIsQ0FBaEIsQ0FBYjs7QUFDQSxRQUFJSSxXQUFKLEVBQWlCO0FBQ2ZvQixNQUFBQSxVQUFVLENBQUNhLElBQVgsQ0FBZ0IsK0JBQXFCakMsV0FBckIsQ0FBaEI7QUFDQWlCLE1BQUFBLE9BQU8sQ0FBQ0MsY0FBUixDQUF1QixNQUF2QixFQUErQnNCLE1BQU0sQ0FBQ0MsT0FBUCxDQUFlekMsV0FBZixFQUM1QjBDLEdBRDRCLENBQ3hCLENBQUMsQ0FBQzVCLEdBQUQsRUFBTXJELEdBQU4sQ0FBRCxLQUFnQixDQUNuQkEsR0FBRyxDQUFFb0IsVUFEYyxFQUVuQixnQkFBTWlDLEdBQU4sQ0FGbUIsQ0FEUSxDQUEvQixFQUlNRCxNQUpOLEVBSWNHLFdBSmQ7QUFLRDs7QUFDRG5CLElBQUFBLGNBQWMsSUFBSTBDLElBQWxCLElBQTBCbkIsVUFBVSxDQUFDYSxJQUFYLENBQWdCLGtDQUF3QnBDLGNBQXhCLEVBQXdDMEMsSUFBeEMsQ0FBaEIsQ0FBMUI7QUFDRDs7QUFFRCxNQUFJeEIsSUFBSSxDQUFDM0MsSUFBTCxLQUFjLGFBQWxCLEVBQWlDO0FBQy9CZ0QsSUFBQUEsVUFBVSxDQUFDYSxJQUFYLENBQWdCVSx5QkFBaEI7QUFDRDs7QUFDRCxNQUFJeEIsVUFBVSxLQUFLLFlBQWYsSUFBK0IsQ0FBQ25CLFdBQXBDLEVBQWlEO0FBQy9Db0IsSUFBQUEsVUFBVSxDQUFDYSxJQUFYLENBQWdCVyxxQkFBaEI7QUFDQTNCLElBQUFBLE9BQU8sQ0FBQ0MsY0FBUixDQUF1QixNQUF2QixFQUErQixDQUFDLENBQUMsSUFBRCxFQUFPLElBQVAsQ0FBRCxFQUFlLENBQUMsS0FBRCxFQUFRLEtBQVIsQ0FBZixDQUEvQixFQUErREwsTUFBL0QsRUFBdUVHLFdBQXZFO0FBQ0Q7O0FBQ0RDLEVBQUFBLE9BQU8sQ0FBQ0MsY0FBUixDQUF1QixZQUF2QixFQUFxQ0ssVUFBckMsRUFBaURWLE1BQWpELEVBQXlERyxXQUF6RDtBQUNBQyxFQUFBQSxPQUFPLENBQUNDLGNBQVIsQ0FBdUIsWUFBdkIsRUFBcUNHLFVBQXJDLEVBQWlEUixNQUFqRCxFQUF5REcsV0FBekQ7QUFDQUMsRUFBQUEsT0FBTyxDQUFDQyxjQUFSLENBQXVCLE1BQXZCLEVBQStCSCxJQUFJLENBQUMzQyxJQUFwQyxFQUEwQ3lDLE1BQTFDLEVBQWtERyxXQUFsRDtBQUNBQyxFQUFBQSxPQUFPLENBQUNDLGNBQVIsQ0FBdUIsWUFBdkIsRUFBcUNDLFVBQXJDLEVBQWlETixNQUFqRCxFQUF5REcsV0FBekQ7QUFDQUMsRUFBQUEsT0FBTyxDQUFDQyxjQUFSLENBQ0UsYUFERixFQUVFSCxJQUFJLENBQUNsQyxVQUFMLEdBQWtCa0MsSUFBSSxDQUFDbEMsVUFBdkIsR0FBb0NnRSxJQUZ0QyxFQUdFaEMsTUFIRixFQUlFRyxXQUpGO0FBTUFsQyxFQUFBQSxPQUFPLENBQUNILFFBQVIsSUFBb0JzQyxPQUFPLENBQUNDLGNBQVIsQ0FBdUIsVUFBdkIsRUFBbUNwQyxPQUFPLENBQUNILFFBQTNDLEVBQXFEa0MsTUFBckQsRUFBNkRHLFdBQTdELENBQXBCO0FBQ0FDLEVBQUFBLE9BQU8sQ0FBQ0MsY0FBUixDQUF1QixTQUF2QixFQUFrQyxxQkFBV0MsVUFBWCxDQUFsQyxFQUEwRE4sTUFBMUQsRUFBa0VHLFdBQWxFO0FBQ0EsUUFBTThCLFVBQWdELEdBQUc7QUFDdkRDLElBQUFBLFVBQVUsRUFBRTFCO0FBRDJDLEdBQXpEO0FBR0EsUUFBTTJCLEVBQUUsR0FBRyxvQkFBVTVCLFVBQVYsQ0FBWDtBQUNBLFFBQU02QixJQUFJLEdBQUcsc0JBQVk3QixVQUFaLENBQWI7QUFDQUgsRUFBQUEsT0FBTyxDQUFDQyxjQUFSLENBQXVCLFdBQXZCLEVBQW9DOEIsRUFBcEMsRUFBd0NuQyxNQUF4QyxFQUFnREcsV0FBaEQ7QUFDQUMsRUFBQUEsT0FBTyxDQUFDQyxjQUFSLENBQXVCLGFBQXZCLEVBQXNDK0IsSUFBdEMsRUFBNENwQyxNQUE1QyxFQUFvREcsV0FBcEQ7O0FBQ0E4QixFQUFBQSxVQUFVLENBQUNJLEdBQVgsR0FBaUIsWUFBWTtBQUMzQkMsSUFBQUEsT0FBTyxDQUFDQyxNQUFSLENBQWVuQyxPQUFPLENBQUNpQyxHQUFSLENBQVksSUFBWixFQUFrQixXQUFsQixJQUFpQyxDQUFoRCxFQUFtRCxxQkFBbkQ7QUFDQSxRQUFJRyxLQUFKOztBQUNBLFFBQUksQ0FBQyxLQUFLQyxRQUFMLENBQWNsRCxFQUFkLENBQUwsRUFBd0I7QUFDdEJpRCxNQUFBQSxLQUFLLEdBQUdMLEVBQUUsQ0FBQyxLQUFLTyxXQUFMLENBQWlCbkQsRUFBakIsQ0FBRCxDQUFWO0FBQ0Q7O0FBQ0QsV0FBT2lELEtBQVA7QUFDRCxHQVBEOztBQVFBLE1BQUk5QixVQUFKLEVBQWdCO0FBQ2R1QixJQUFBQSxVQUFVLENBQUNVLEdBQVgsR0FBaUIsVUFBVUMsUUFBVixFQUF5QjtBQUN4Q04sTUFBQUEsT0FBTyxDQUFDQyxNQUFSLENBQWVuQyxPQUFPLENBQUNpQyxHQUFSLENBQVksSUFBWixFQUFrQixXQUFsQixJQUFpQyxDQUFoRCxFQUFtRCxxQkFBbkQ7QUFDQSxZQUFNRyxLQUFLLEdBQUdKLElBQUksQ0FBQ1EsUUFBRCxDQUFsQjs7QUFDQSxVQUFJSixLQUFLLEtBQUtqQixTQUFWLElBQXVCeEUsTUFBTSxDQUFDQyxLQUFQLENBQWF3RixLQUFiLENBQTNCLEVBQTBEO0FBQ3hELGNBQU0sSUFBSUssS0FBSixDQUFXLGtCQUFpQkMsSUFBSSxDQUFDQyxTQUFMLENBQWVILFFBQWYsQ0FBeUIsRUFBckQsQ0FBTjtBQUNEOztBQUNELFdBQUtJLFdBQUwsQ0FBaUJ6RCxFQUFqQixFQUFxQmlELEtBQXJCO0FBQ0QsS0FQRDtBQVFEOztBQUNEcEMsRUFBQUEsT0FBTyxDQUFDNkMsY0FBUixDQUF1QmpELE1BQXZCLEVBQStCRyxXQUEvQixFQUE0QzhCLFVBQTVDO0FBQ0EsU0FBTyxDQUFDMUMsRUFBRCxFQUFLWSxXQUFMLENBQVA7QUFDRDs7QUFFTSxTQUFTK0MsVUFBVCxDQUFvQkMsT0FBcEIsRUFBcUM7QUFDMUMsU0FBT0MsY0FBS0MsT0FBTCxDQUFhQyxTQUFiLEVBQXdCLGFBQXhCLEVBQXdDLEdBQUVILE9BQVEsV0FBbEQsQ0FBUDtBQUNEOztBQUVELE1BQU1JLGVBQU4sU0FBOEJDLG9CQUE5QixDQUE4RDtBQUM1RDtBQUdBO0FBRUFDLEVBQUFBLFdBQVcsQ0FBQ04sT0FBRCxFQUFrQjtBQUMzQjs7QUFEMkIsdUNBSmpCLENBSWlCOztBQUUzQixVQUFNTyxPQUFPLEdBQUdSLFVBQVUsQ0FBQ0MsT0FBRCxDQUExQjtBQUNBLFVBQU1RLGFBQWEsR0FBR2xFLFVBQVUsQ0FBQ21FLE1BQVgsQ0FBa0JDLE9BQU8sQ0FBQ0gsT0FBRCxDQUF6QixDQUF0Qjs7QUFDQSxRQUFJQyxhQUFhLENBQUNHLE1BQWQsRUFBSixFQUE0QjtBQUMxQixZQUFNLElBQUlqQixLQUFKLENBQVcsb0JBQW1CYSxPQUFRLElBQUdLLDJCQUFhQyxNQUFiLENBQW9CTCxhQUFwQixDQUFtQyxFQUE1RSxDQUFOO0FBQ0Q7O0FBQ0QsVUFBTU0sR0FBRyxHQUFHTixhQUFhLENBQUNuQixLQUExQjtBQUNBLFVBQU07QUFBRTdDLE1BQUFBLEtBQUY7QUFBU0MsTUFBQUE7QUFBVCxRQUF5QnFFLEdBQS9CO0FBQ0EsVUFBTXZFLE1BQU0sR0FBR0MsS0FBSyxDQUFDc0UsR0FBRyxDQUFDdkUsTUFBTCxDQUFwQjtBQUNBVSxJQUFBQSxPQUFPLENBQUNDLGNBQVIsQ0FBdUIsS0FBdkIsRUFBOEI4QyxPQUE5QixFQUF1QyxJQUF2QztBQUNBL0MsSUFBQUEsT0FBTyxDQUFDQyxjQUFSLENBQXVCLFNBQXZCLEVBQWtDcUQsT0FBbEMsRUFBMkMsSUFBM0M7QUFDQXRELElBQUFBLE9BQU8sQ0FBQ0MsY0FBUixDQUF1QixZQUF2QixFQUFxQ1gsTUFBTSxDQUFDMUIsVUFBNUMsRUFBd0QsSUFBeEQ7QUFDQW9DLElBQUFBLE9BQU8sQ0FBQ0MsY0FBUixDQUF1QixZQUF2QixFQUFxQ1gsTUFBTSxDQUFDekIsT0FBUCxDQUFlRSxXQUFwRCxFQUFpRSxJQUFqRTtBQUNBaUMsSUFBQUEsT0FBTyxDQUFDQyxjQUFSLENBQXVCLFlBQXZCLEVBQXFDLGdCQUFNWCxNQUFNLENBQUN6QixPQUFQLENBQWVHLFdBQXJCLENBQXJDLEVBQXdFLElBQXhFO0FBQ0FzQixJQUFBQSxNQUFNLENBQUN6QixPQUFQLENBQWVJLFdBQWYsSUFBOEIrQixPQUFPLENBQUNDLGNBQVIsQ0FBdUIsWUFBdkIsRUFDNUIsZ0JBQU1YLE1BQU0sQ0FBQ3pCLE9BQVAsQ0FBZUksV0FBckIsQ0FENEIsRUFDTyxJQURQLENBQTlCO0FBR0FxQixJQUFBQSxNQUFNLENBQUN6QixPQUFQLENBQWVLLFFBQWYsSUFBMkI4QixPQUFPLENBQUNDLGNBQVIsQ0FBdUIsVUFBdkIsRUFDekJYLE1BQU0sQ0FBQ3pCLE9BQVAsQ0FBZUssUUFEVSxFQUNBLElBREEsQ0FBM0I7QUFHQW9CLElBQUFBLE1BQU0sQ0FBQ3pCLE9BQVAsQ0FBZU0sV0FBZixJQUE4QjZCLE9BQU8sQ0FBQ0MsY0FBUixDQUF1QixhQUF2QixFQUM1QlgsTUFBTSxDQUFDekIsT0FBUCxDQUFlTSxXQURhLEVBQ0EsSUFEQSxDQUE5QjtBQUdBb0IsSUFBQUEsS0FBSyxDQUFDdUUsU0FBTixJQUFtQjlELE9BQU8sQ0FBQ0MsY0FBUixDQUNqQixXQURpQixFQUNIVixLQUFLLENBQUN1RSxTQUFQLENBQThCL0UsV0FEMUIsRUFDdUMsSUFEdkMsQ0FBbkI7O0FBR0EsUUFBSVMsV0FBSixFQUFpQjtBQUNmLFlBQU11RSxRQUFRLEdBQUdDLGdCQUFFQyxTQUFGLENBQ2Z6RSxXQURlLEVBRWYsQ0FBQzBFLE1BQUQsRUFBU0MsR0FBVCxFQUFjdkMsSUFBZCxLQUF1QjtBQUNyQnNDLFFBQUFBLE1BQU0sQ0FBQ3RDLElBQUQsQ0FBTixHQUFlO0FBQ2J6QyxVQUFBQSxFQUFFLEVBQUUsZ0JBQU1nRixHQUFHLENBQUN0RyxPQUFKLENBQVlULE1BQWxCLENBRFM7QUFFYmdILFVBQUFBLFdBQVcsRUFBRUQsR0FBRyxDQUFDdkcsVUFGSjtBQUdieUcsVUFBQUEsSUFBSSxFQUFFRixHQUFHLENBQUM5RixVQUFKLElBQWtCa0QsTUFBTSxDQUFDQyxPQUFQLENBQWUyQyxHQUFHLENBQUM5RixVQUFuQixFQUNyQm9ELEdBRHFCLENBQ2pCLENBQUMsQ0FBQ0csSUFBRCxFQUFPOUIsSUFBUCxDQUFELE1BQW1CO0FBQ3RCOEIsWUFBQUEsSUFEc0I7QUFFdEJ6RSxZQUFBQSxJQUFJLEVBQUUscUJBQVcyQyxJQUFJLENBQUMzQyxJQUFoQixDQUZnQjtBQUd0Qm1ILFlBQUFBLElBQUksRUFBRXhFLElBQUksQ0FBQ2xDO0FBSFcsV0FBbkIsQ0FEaUI7QUFIWCxTQUFmO0FBVUEsZUFBT3NHLE1BQVA7QUFDRCxPQWRjLEVBZWYsRUFmZSxDQUFqQjs7QUFpQkFsRSxNQUFBQSxPQUFPLENBQUNDLGNBQVIsQ0FBdUIsYUFBdkIsRUFBc0M4RCxRQUF0QyxFQUFnRCxJQUFoRDtBQUNELEtBOUMwQixDQWdEM0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQUVBLFVBQU1RLElBQUksR0FBR3ZFLE9BQU8sQ0FBQ3dFLE9BQVIsQ0FBZ0JsRixNQUFNLENBQUNqQixVQUF2QixDQUFiO0FBQ0EyQixJQUFBQSxPQUFPLENBQUNDLGNBQVIsQ0FBdUIsZUFBdkIsRUFBd0NzRSxJQUFJLENBQUM5QyxHQUFMLENBQVNnRCxnQkFBVCxDQUF4QyxFQUErRCxJQUEvRDtBQUNBLFVBQU1oRCxHQUErQixHQUFHLEVBQXhDO0FBQ0E4QyxJQUFBQSxJQUFJLENBQUNHLE9BQUwsQ0FBYzdFLEdBQUQsSUFBaUI7QUFDNUIsWUFBTSxDQUFDVixFQUFELEVBQUt3RixRQUFMLElBQWlCaEYsaUJBQWlCLENBQUMsSUFBRCxFQUFPRSxHQUFQLEVBQVlOLEtBQVosRUFBbUJELE1BQU0sQ0FBQ2pCLFVBQVAsQ0FBa0J3QixHQUFsQixDQUFuQixDQUF4Qzs7QUFDQSxVQUFJLENBQUM0QixHQUFHLENBQUN0QyxFQUFELENBQVIsRUFBYztBQUNac0MsUUFBQUEsR0FBRyxDQUFDdEMsRUFBRCxDQUFILEdBQVUsQ0FBQ3dGLFFBQUQsQ0FBVjtBQUNELE9BRkQsTUFFTztBQUNMbEQsUUFBQUEsR0FBRyxDQUFDdEMsRUFBRCxDQUFILENBQVE2QixJQUFSLENBQWEyRCxRQUFiO0FBQ0Q7QUFDRixLQVBEO0FBUUEzRSxJQUFBQSxPQUFPLENBQUNDLGNBQVIsQ0FBdUIsS0FBdkIsRUFBOEJ3QixHQUE5QixFQUFtQyxJQUFuQztBQUNEOztBQUVELE1BQVdtRCxVQUFYLEdBQXFEO0FBQ25ELFVBQU07QUFBRSxPQUFDekksT0FBRCxHQUFXMEk7QUFBYixRQUF3QixJQUE5QjtBQUNBLFdBQU9BLE1BQU0sQ0FBQ2hJLFlBQVksQ0FBQytILFVBQWQsQ0FBYjtBQUNEOztBQUVELE1BQVdBLFVBQVgsQ0FBc0J4QyxLQUF0QixFQUEwRDtBQUN4RCxVQUFNO0FBQUUsT0FBQ2pHLE9BQUQsR0FBVzBJO0FBQWIsUUFBd0IsSUFBOUI7QUFDQSxVQUFNQyxJQUFJLEdBQUdELE1BQU0sQ0FBQ2hJLFlBQVksQ0FBQytILFVBQWQsQ0FBbkI7QUFDQSxRQUFJRSxJQUFJLEtBQUsxQyxLQUFiLEVBQW9CO0FBQ3BCeUMsSUFBQUEsTUFBTSxDQUFDaEksWUFBWSxDQUFDK0gsVUFBZCxDQUFOLEdBQWtDeEMsS0FBbEM7QUFDQTs7Ozs7O0FBS0EsU0FBSzJDLElBQUwsQ0FBVTNDLEtBQUssSUFBSSxJQUFULEdBQWdCLFdBQWhCLEdBQThCLGNBQXhDLEVBVndELENBV3hEO0FBQ0E7QUFDQTtBQUNELEdBL0YyRCxDQWlHNUQ7OztBQUNPNEMsRUFBQUEsTUFBUCxHQUFxQjtBQUNuQixVQUFNQyxJQUFTLEdBQUc7QUFDaEJwQixNQUFBQSxHQUFHLEVBQUU3RCxPQUFPLENBQUNrRixXQUFSLENBQW9CLEtBQXBCLEVBQTJCLElBQTNCO0FBRFcsS0FBbEI7QUFHQSxVQUFNWCxJQUFjLEdBQUd2RSxPQUFPLENBQUNrRixXQUFSLENBQW9CLGVBQXBCLEVBQXFDLElBQXJDLENBQXZCO0FBQ0FYLElBQUFBLElBQUksQ0FBQ0csT0FBTCxDQUFjN0UsR0FBRCxJQUFTO0FBQ3BCLFVBQUksS0FBS0EsR0FBTCxNQUFjc0IsU0FBbEIsRUFBNkI4RCxJQUFJLENBQUNwRixHQUFELENBQUosR0FBWSxLQUFLQSxHQUFMLENBQVo7QUFDOUIsS0FGRDtBQUdBb0YsSUFBQUEsSUFBSSxDQUFDRSxPQUFMLEdBQWUsS0FBS0EsT0FBTCxDQUFhQyxRQUFiLEVBQWY7QUFDQSxXQUFPSCxJQUFQO0FBQ0Q7O0FBRU1JLEVBQUFBLEtBQVAsQ0FBYUMsUUFBYixFQUFnRDtBQUM5QyxRQUFJbkcsRUFBSjs7QUFDQSxRQUFJLE9BQU9tRyxRQUFQLEtBQW9CLFFBQXhCLEVBQWtDO0FBQ2hDbkcsTUFBQUEsRUFBRSxHQUFHYSxPQUFPLENBQUNrRixXQUFSLENBQW9CLElBQXBCLEVBQTBCLElBQTFCLEVBQWdDSSxRQUFoQyxDQUFMO0FBQ0EsVUFBSTNJLE1BQU0sQ0FBQzRJLFNBQVAsQ0FBaUJwRyxFQUFqQixDQUFKLEVBQTBCLE9BQU9BLEVBQVA7QUFDMUJBLE1BQUFBLEVBQUUsR0FBRyxnQkFBTW1HLFFBQU4sQ0FBTDtBQUNELEtBSkQsTUFJTztBQUNMbkcsTUFBQUEsRUFBRSxHQUFHbUcsUUFBTDtBQUNEOztBQUNELFVBQU03RCxHQUFHLEdBQUd6QixPQUFPLENBQUNrRixXQUFSLENBQW9CLEtBQXBCLEVBQTJCLElBQTNCLENBQVo7O0FBQ0EsUUFBSSxDQUFDbEYsT0FBTyxDQUFDd0YsR0FBUixDQUFZL0QsR0FBWixFQUFpQnRDLEVBQWpCLENBQUwsRUFBMkI7QUFDekIsWUFBTSxJQUFJc0QsS0FBSixDQUFXLG9CQUFtQjZDLFFBQVMsRUFBdkMsQ0FBTjtBQUNEOztBQUNELFdBQU9uRyxFQUFQO0FBQ0Q7O0FBRU1zRyxFQUFBQSxPQUFQLENBQWVILFFBQWYsRUFBa0Q7QUFDaEQsVUFBTTdELEdBQUcsR0FBR3pCLE9BQU8sQ0FBQ2tGLFdBQVIsQ0FBb0IsS0FBcEIsRUFBMkIsSUFBM0IsQ0FBWjs7QUFDQSxRQUFJbEYsT0FBTyxDQUFDd0YsR0FBUixDQUFZL0QsR0FBWixFQUFpQjZELFFBQWpCLENBQUosRUFBZ0M7QUFDOUIsYUFBTzdELEdBQUcsQ0FBQzZELFFBQUQsQ0FBSCxDQUFjLENBQWQsQ0FBUDtBQUNEOztBQUNELFVBQU1mLElBQWMsR0FBR3ZFLE9BQU8sQ0FBQ2tGLFdBQVIsQ0FBb0IsZUFBcEIsRUFBcUMsSUFBckMsQ0FBdkI7QUFDQSxRQUFJLE9BQU9JLFFBQVAsS0FBb0IsUUFBcEIsSUFBZ0NmLElBQUksQ0FBQ21CLFFBQUwsQ0FBY0osUUFBZCxDQUFwQyxFQUE2RCxPQUFPQSxRQUFQO0FBQzdELFVBQU0sSUFBSTdDLEtBQUosQ0FBVyxvQkFBbUI2QyxRQUFTLEVBQXZDLENBQU47QUFDRDtBQUVEOzs7Ozs7Ozs7O0FBUU9oRCxFQUFBQSxXQUFQLENBQW1CZ0QsUUFBbkIsRUFBbUQ7QUFDakQsVUFBTW5HLEVBQUUsR0FBRyxLQUFLa0csS0FBTCxDQUFXQyxRQUFYLENBQVg7QUFDQSxVQUFNO0FBQUUsT0FBQ25KLE9BQUQsR0FBVzBJO0FBQWIsUUFBd0IsSUFBOUI7QUFDQSxXQUFPQSxNQUFNLENBQUMxRixFQUFELENBQWI7QUFDRDs7QUFFTXlELEVBQUFBLFdBQVAsQ0FBbUIwQyxRQUFuQixFQUE4Q2xELEtBQTlDLEVBQTBEdUQsT0FBTyxHQUFHLElBQXBFLEVBQTBFO0FBQ3hFO0FBQ0EsVUFBTXhHLEVBQUUsR0FBRyxLQUFLa0csS0FBTCxDQUFXQyxRQUFYLENBQVg7QUFDQSxVQUFNO0FBQUUsT0FBQ25KLE9BQUQsR0FBVzBJLE1BQWI7QUFBcUIsT0FBQ3hJLE9BQUQsR0FBV3VKO0FBQWhDLFFBQTJDLElBQWpEO0FBQ0FmLElBQUFBLE1BQU0sQ0FBQzFGLEVBQUQsQ0FBTixHQUFhNUMsVUFBVSxDQUFDNkYsS0FBRCxDQUF2QjtBQUNBLFdBQU93RCxNQUFNLENBQUN6RyxFQUFELENBQWI7QUFDQSxTQUFLMEcsUUFBTCxDQUFjMUcsRUFBZCxFQUFrQndHLE9BQWxCO0FBQ0Q7O0FBRU10RCxFQUFBQSxRQUFQLENBQWdCaUQsUUFBaEIsRUFBZ0Q7QUFDOUMsVUFBTW5HLEVBQUUsR0FBRyxLQUFLa0csS0FBTCxDQUFXQyxRQUFYLENBQVg7QUFDQSxVQUFNO0FBQUUsT0FBQ2pKLE9BQUQsR0FBV3VKO0FBQWIsUUFBd0IsSUFBOUI7QUFDQSxXQUFPQSxNQUFNLENBQUN6RyxFQUFELENBQWI7QUFDRDs7QUFFTTJHLEVBQUFBLFFBQVAsQ0FBZ0JSLFFBQWhCLEVBQTJDUyxLQUEzQyxFQUEwRDtBQUN4RCxVQUFNNUcsRUFBRSxHQUFHLEtBQUtrRyxLQUFMLENBQVdDLFFBQVgsQ0FBWDtBQUNBLFVBQU07QUFBRSxPQUFDakosT0FBRCxHQUFXdUo7QUFBYixRQUF3QixJQUE5Qjs7QUFDQSxRQUFJRyxLQUFLLElBQUksSUFBYixFQUFtQjtBQUNqQkgsTUFBQUEsTUFBTSxDQUFDekcsRUFBRCxDQUFOLEdBQWE0RyxLQUFiO0FBQ0QsS0FGRCxNQUVPO0FBQ0wsYUFBT0gsTUFBTSxDQUFDekcsRUFBRCxDQUFiO0FBQ0Q7QUFDRjs7QUFFTXdHLEVBQUFBLE9BQVAsQ0FBZUwsUUFBZixFQUFtRDtBQUNqRCxVQUFNbkcsRUFBRSxHQUFHLEtBQUtrRyxLQUFMLENBQVdDLFFBQVgsQ0FBWDtBQUNBLFVBQU07QUFBRSxPQUFDaEosUUFBRCxHQUFZMEo7QUFBZCxRQUEwQixJQUFoQztBQUNBLFdBQU8sQ0FBQyxDQUFDQSxPQUFPLENBQUM3RyxFQUFELENBQWhCO0FBQ0Q7O0FBRU0wRyxFQUFBQSxRQUFQLENBQWdCUCxRQUFoQixFQUEyQ0ssT0FBTyxHQUFHLElBQXJELEVBQTJEO0FBQ3pELFVBQU14RyxFQUFFLEdBQUcsS0FBS2tHLEtBQUwsQ0FBV0MsUUFBWCxDQUFYO0FBQ0EsVUFBTTdELEdBQStCLEdBQUd6QixPQUFPLENBQUNrRixXQUFSLENBQW9CLEtBQXBCLEVBQTJCLElBQTNCLENBQXhDO0FBQ0EsVUFBTTtBQUFFLE9BQUM1SSxRQUFELEdBQVkwSjtBQUFkLFFBQTBCLElBQWhDOztBQUNBLFFBQUlMLE9BQUosRUFBYTtBQUNYSyxNQUFBQSxPQUFPLENBQUM3RyxFQUFELENBQVAsR0FBYyxJQUFkLENBRFcsQ0FFWDtBQUNBO0FBQ0QsS0FKRCxNQUlPO0FBQ0wsYUFBTzZHLE9BQU8sQ0FBQzdHLEVBQUQsQ0FBZDtBQUNEO0FBQ0Q7Ozs7OztBQUlBLFVBQU04RyxLQUFLLEdBQUd4RSxHQUFHLENBQUN0QyxFQUFELENBQUgsSUFBVyxFQUF6QjtBQUNBLFNBQUs0RixJQUFMLENBQ0VZLE9BQU8sR0FBRyxVQUFILEdBQWdCLFNBRHpCLEVBRUU7QUFDRXhHLE1BQUFBLEVBREY7QUFFRThHLE1BQUFBO0FBRkYsS0FGRjtBQU9EOztBQUVNQyxFQUFBQSxNQUFQLEdBQWdCO0FBQ2QsU0FBS0MsU0FBTCxJQUFrQixDQUFsQjtBQUNBakssSUFBQUEsS0FBSyxDQUFDLFFBQUQsRUFBVyxJQUFJdUcsS0FBSixDQUFVLFFBQVYsRUFBb0IyRCxLQUEvQixDQUFMO0FBQ0EsV0FBTyxLQUFLRCxTQUFaO0FBQ0Q7O0FBRU1FLEVBQUFBLE9BQVAsR0FBaUI7QUFDZixTQUFLRixTQUFMLElBQWtCLENBQWxCOztBQUNBLFFBQUksS0FBS0EsU0FBTCxJQUFrQixDQUF0QixFQUF5QjtBQUN2QixhQUFPckosU0FBUyxDQUFDLEtBQUtxSSxPQUFMLENBQWFDLFFBQWIsRUFBRCxDQUFoQjtBQUNBOzs7O0FBR0FrQixNQUFBQSxPQUFPLENBQUN2QixJQUFSLENBQWEsUUFBYixFQUF1QixJQUF2QjtBQUNEOztBQUNELFdBQU8sS0FBS29CLFNBQVo7QUFDRDs7QUFFTUksRUFBQUEsS0FBUCxHQUFrQztBQUNoQ3JLLElBQUFBLEtBQUssQ0FBRSxVQUFTLEtBQUtpSixPQUFRLEdBQXhCLENBQUw7QUFDQSxVQUFNO0FBQUUsT0FBQzdJLFFBQUQsR0FBWTBKO0FBQWQsUUFBMEIsSUFBaEM7QUFDQSxVQUFNUSxHQUFHLEdBQUdqRixNQUFNLENBQUNnRCxJQUFQLENBQVl5QixPQUFaLEVBQXFCdkUsR0FBckIsQ0FBeUI5RSxNQUF6QixFQUFpQzhKLE1BQWpDLENBQXdDdEgsRUFBRSxJQUFJNkcsT0FBTyxDQUFDN0csRUFBRCxDQUFyRCxDQUFaO0FBQ0EsV0FBT3FILEdBQUcsQ0FBQ0UsTUFBSixHQUFhLENBQWIsR0FBaUIsS0FBS0MsS0FBTCxDQUFXLEdBQUdILEdBQWQsRUFBbUJJLEtBQW5CLENBQXlCLE1BQU0sRUFBL0IsQ0FBakIsR0FBc0RDLE9BQU8sQ0FBQzVELE9BQVIsQ0FBZ0IsRUFBaEIsQ0FBN0Q7QUFDRDs7QUFFTzZELEVBQUFBLFFBQVIsR0FBbUI7QUFDakIsVUFBTTtBQUFFLE9BQUMzSyxPQUFELEdBQVcwSTtBQUFiLFFBQXdCLElBQTlCO0FBQ0EsVUFBTXBELEdBQUcsR0FBR3pCLE9BQU8sQ0FBQ2tGLFdBQVIsQ0FBb0IsS0FBcEIsRUFBMkIsSUFBM0IsQ0FBWjtBQUNBLFVBQU1zQixHQUFHLEdBQUdqRixNQUFNLENBQUNDLE9BQVAsQ0FBZXFELE1BQWYsRUFDVDRCLE1BRFMsQ0FDRixDQUFDLEdBQUdyRSxLQUFILENBQUQsS0FBZUEsS0FBSyxJQUFJLElBRHRCLEVBRVRYLEdBRlMsQ0FFTCxDQUFDLENBQUN0QyxFQUFELENBQUQsS0FBVXhDLE1BQU0sQ0FBQ3dDLEVBQUQsQ0FGWCxFQUdUc0gsTUFIUyxDQUdEdEgsRUFBRSxJQUFJYSxPQUFPLENBQUNrRixXQUFSLENBQW9CLFlBQXBCLEVBQWtDLElBQWxDLEVBQXdDekQsR0FBRyxDQUFDdEMsRUFBRCxDQUFILENBQVEsQ0FBUixDQUF4QyxDQUhMLENBQVo7QUFJQSxXQUFPcUgsR0FBRyxDQUFDRSxNQUFKLEdBQWEsQ0FBYixHQUFpQixLQUFLQyxLQUFMLENBQVcsR0FBR0gsR0FBZCxDQUFqQixHQUFzQ0ssT0FBTyxDQUFDNUQsT0FBUixDQUFnQixFQUFoQixDQUE3QztBQUNEOztBQUVNMEQsRUFBQUEsS0FBUCxDQUFhLEdBQUdILEdBQWhCLEVBQWtEO0FBQ2hELFVBQU07QUFBRTVCLE1BQUFBO0FBQUYsUUFBaUIsSUFBdkI7QUFDQSxRQUFJLENBQUNBLFVBQUwsRUFBaUIsT0FBT2lDLE9BQU8sQ0FBQ0UsTUFBUixDQUFnQixHQUFFLEtBQUs1QixPQUFRLGtCQUEvQixDQUFQOztBQUNqQixRQUFJcUIsR0FBRyxDQUFDRSxNQUFKLEtBQWUsQ0FBbkIsRUFBc0I7QUFDcEIsYUFBTyxLQUFLSSxRQUFMLEVBQVA7QUFDRDs7QUFDRDVLLElBQUFBLEtBQUssQ0FBRSxXQUFVc0ssR0FBRyxDQUFDUSxJQUFKLEVBQVcsUUFBTyxLQUFLN0IsT0FBUSxHQUEzQyxDQUFMO0FBQ0EsVUFBTTFELEdBQUcsR0FBR3pCLE9BQU8sQ0FBQ2tGLFdBQVIsQ0FBb0IsS0FBcEIsRUFBMkIsSUFBM0IsQ0FBWjtBQUNBLFVBQU0rQixRQUFRLEdBQUdULEdBQUcsQ0FBQ1UsTUFBSixDQUNmLENBQUNDLEdBQUQsRUFBcUJoSSxFQUFyQixLQUE0QjtBQUMxQixZQUFNLENBQUN5QyxJQUFELElBQVNILEdBQUcsQ0FBQ3RDLEVBQUQsQ0FBbEI7O0FBQ0EsVUFBSSxDQUFDeUMsSUFBTCxFQUFXO0FBQ1QxRixRQUFBQSxLQUFLLENBQUUsZUFBY2lELEVBQUcsUUFBT2EsT0FBTyxDQUFDa0YsV0FBUixDQUFvQixLQUFwQixFQUEyQixJQUEzQixDQUFpQyxFQUEzRCxDQUFMO0FBQ0QsT0FGRCxNQUVPO0FBQ0xpQyxRQUFBQSxHQUFHLENBQUNuRyxJQUFKLENBQVMseUJBQ1AsS0FBS21FLE9BREUsRUFFUGhHLEVBRk8sRUFHUGEsT0FBTyxDQUFDa0YsV0FBUixDQUFvQixTQUFwQixFQUErQixJQUEvQixFQUFxQ3RELElBQXJDLENBSE8sRUFJUCxLQUFLVSxXQUFMLENBQWlCbkQsRUFBakIsQ0FKTyxDQUFUO0FBTUQ7O0FBQ0QsYUFBT2dJLEdBQVA7QUFDRCxLQWRjLEVBZWYsRUFmZSxDQUFqQjtBQWlCQSxXQUFPTixPQUFPLENBQUNPLEdBQVIsQ0FDTEgsUUFBUSxDQUNMeEYsR0FESCxDQUNPNEYsUUFBUSxJQUFJekMsVUFBVSxDQUFDMEMsWUFBWCxDQUF3QkQsUUFBeEIsRUFDZEUsSUFEYyxDQUNSdEksUUFBRCxJQUFjO0FBQ2xCLFlBQU07QUFBRXVJLFFBQUFBO0FBQUYsVUFBYXZJLFFBQW5COztBQUNBLFVBQUl1SSxNQUFNLEtBQUssQ0FBZixFQUFrQjtBQUNoQixhQUFLM0IsUUFBTCxDQUFjd0IsUUFBUSxDQUFDbEksRUFBdkIsRUFBMkIsS0FBM0I7QUFDQSxlQUFPa0ksUUFBUSxDQUFDbEksRUFBaEI7QUFDRDs7QUFDRCxXQUFLMkcsUUFBTCxDQUFjdUIsUUFBUSxDQUFDbEksRUFBdkIsRUFBMkIsSUFBSXNJLGtCQUFKLENBQWVELE1BQWYsRUFBd0IsSUFBeEIsQ0FBM0I7QUFDQSxhQUFPLENBQUMsQ0FBUjtBQUNELEtBVGMsRUFTWEUsTUFBRCxJQUFZO0FBQ2IsV0FBSzVCLFFBQUwsQ0FBY3VCLFFBQVEsQ0FBQ2xJLEVBQXZCLEVBQTJCdUksTUFBM0I7QUFDQSxhQUFPLENBQUMsQ0FBUjtBQUNELEtBWmMsQ0FEbkIsQ0FESyxFQWVKSCxJQWZJLENBZUNmLEdBQUcsSUFBSUEsR0FBRyxDQUFDQyxNQUFKLENBQVd0SCxFQUFFLElBQUlBLEVBQUUsR0FBRyxDQUF0QixDQWZSLENBQVA7QUFnQkQ7O0FBRU13SSxFQUFBQSxXQUFQLENBQW1CQyxNQUFuQixFQUFtQ0MsTUFBTSxHQUFHLElBQTVDLEVBQXFFO0FBQ25FLFFBQUk7QUFDRixZQUFNckIsR0FBRyxHQUFHakYsTUFBTSxDQUFDZ0QsSUFBUCxDQUFZcUQsTUFBWixFQUFvQm5HLEdBQXBCLENBQXdCRyxJQUFJLElBQUksS0FBS3lELEtBQUwsQ0FBV3pELElBQVgsQ0FBaEMsQ0FBWjtBQUNBLFVBQUk0RSxHQUFHLENBQUNFLE1BQUosS0FBZSxDQUFuQixFQUFzQixPQUFPRyxPQUFPLENBQUNFLE1BQVIsQ0FBZSxJQUFJZSxTQUFKLENBQWMsZ0JBQWQsQ0FBZixDQUFQO0FBQ3RCdkcsTUFBQUEsTUFBTSxDQUFDd0csTUFBUCxDQUFjLElBQWQsRUFBb0JILE1BQXBCO0FBQ0EsYUFBTyxLQUFLakIsS0FBTCxDQUFXLEdBQUdILEdBQWQsRUFDSmUsSUFESSxDQUNFUyxPQUFELElBQWE7QUFDakIsWUFBSUEsT0FBTyxDQUFDdEIsTUFBUixLQUFtQixDQUFuQixJQUF5Qm1CLE1BQU0sSUFBSUcsT0FBTyxDQUFDdEIsTUFBUixLQUFtQkYsR0FBRyxDQUFDRSxNQUE5RCxFQUF1RTtBQUNyRSxnQkFBTSxLQUFLckUsUUFBTCxDQUFjbUUsR0FBRyxDQUFDLENBQUQsQ0FBakIsQ0FBTjtBQUNEOztBQUNELGVBQU93QixPQUFQO0FBQ0QsT0FOSSxDQUFQO0FBT0QsS0FYRCxDQVdFLE9BQU9DLEdBQVAsRUFBWTtBQUNaLGFBQU9wQixPQUFPLENBQUNFLE1BQVIsQ0FBZWtCLEdBQWYsQ0FBUDtBQUNEO0FBQ0Y7O0FBRU9DLEVBQUFBLE9BQVIsR0FBZ0M7QUFDOUIsUUFBSSxLQUFLQyxLQUFULEVBQWdCLE9BQU8sS0FBS0EsS0FBWjtBQUNoQixVQUFNMUcsR0FBK0IsR0FBR3pCLE9BQU8sQ0FBQ2tGLFdBQVIsQ0FBb0IsS0FBcEIsRUFBMkIsSUFBM0IsQ0FBeEM7QUFDQSxVQUFNc0IsR0FBRyxHQUFHakYsTUFBTSxDQUFDQyxPQUFQLENBQWVDLEdBQWYsRUFDVGdGLE1BRFMsQ0FDRixDQUFDLEdBQUdSLEtBQUgsQ0FBRCxLQUFlakcsT0FBTyxDQUFDa0YsV0FBUixDQUFvQixZQUFwQixFQUFrQyxJQUFsQyxFQUF3Q2UsS0FBSyxDQUFDLENBQUQsQ0FBN0MsQ0FEYixFQUVUeEUsR0FGUyxDQUVMLENBQUMsQ0FBQ3RDLEVBQUQsQ0FBRCxLQUFVeEMsTUFBTSxDQUFDd0MsRUFBRCxDQUZYLEVBR1RpSixJQUhTLEVBQVo7QUFJQSxTQUFLRCxLQUFMLEdBQWEzQixHQUFHLENBQUNFLE1BQUosR0FBYSxDQUFiLEdBQWlCLEtBQUsyQixJQUFMLENBQVUsR0FBRzdCLEdBQWIsQ0FBakIsR0FBcUNLLE9BQU8sQ0FBQzVELE9BQVIsQ0FBZ0IsRUFBaEIsQ0FBbEQ7O0FBQ0EsVUFBTXFGLEtBQUssR0FBRyxNQUFNLE9BQU8sS0FBS0gsS0FBaEM7O0FBQ0EsV0FBTyxLQUFLQSxLQUFMLENBQVdJLE9BQVgsQ0FBbUJELEtBQW5CLENBQVA7QUFDRDs7QUFFRCxRQUFhRCxJQUFiLENBQWtCLEdBQUc3QixHQUFyQixFQUFzRTtBQUNwRSxVQUFNO0FBQUU1QixNQUFBQTtBQUFGLFFBQWlCLElBQXZCO0FBQ0EsUUFBSSxDQUFDQSxVQUFMLEVBQWlCLE9BQU9pQyxPQUFPLENBQUNFLE1BQVIsQ0FBZSxjQUFmLENBQVA7QUFDakIsUUFBSVAsR0FBRyxDQUFDRSxNQUFKLEtBQWUsQ0FBbkIsRUFBc0IsT0FBTyxLQUFLd0IsT0FBTCxFQUFQLENBSDhDLENBSXBFOztBQUNBLFVBQU1NLG1CQUFtQixHQUFHeEksT0FBTyxDQUFDa0YsV0FBUixDQUFvQixxQkFBcEIsRUFBMkMsSUFBM0MsQ0FBNUI7QUFDQSxVQUFNekQsR0FBK0IsR0FBR3pCLE9BQU8sQ0FBQ2tGLFdBQVIsQ0FBb0IsS0FBcEIsRUFBMkIsSUFBM0IsQ0FBeEM7QUFDQSxVQUFNdUQsTUFBTSxHQUFHLHdCQUFXakMsR0FBWCxFQUFnQmdDLG1CQUFtQixHQUFHLENBQUgsR0FBTyxFQUExQyxDQUFmO0FBQ0F0TSxJQUFBQSxLQUFLLENBQUUsU0FBUXVNLE1BQU0sQ0FBQ2hILEdBQVAsQ0FBV2lILEtBQUssSUFBSyxJQUFHQSxLQUFLLENBQUMxQixJQUFOLEVBQWEsR0FBckMsRUFBeUNBLElBQXpDLEVBQWdELFdBQVUsS0FBSzdCLE9BQVEsR0FBakYsQ0FBTDtBQUNBLFVBQU04QixRQUFRLEdBQUd3QixNQUFNLENBQUNoSCxHQUFQLENBQVdpSCxLQUFLLElBQUksd0JBQWMsS0FBS3ZELE9BQW5CLEVBQTRCLEdBQUd1RCxLQUEvQixDQUFwQixDQUFqQjtBQUNBLFdBQU96QixRQUFRLENBQUNDLE1BQVQsQ0FDTCxPQUFPeUIsT0FBUCxFQUFnQnRCLFFBQWhCLEtBQTZCO0FBQzNCLFlBQU1uRCxNQUFNLEdBQUcsTUFBTXlFLE9BQXJCO0FBQ0EsWUFBTTFKLFFBQVEsR0FBRyxNQUFNMkYsVUFBVSxDQUFDMEMsWUFBWCxDQUF3QkQsUUFBeEIsQ0FBdkI7QUFDQSxZQUFNdUIsU0FBd0IsR0FBR0MsS0FBSyxDQUFDQyxPQUFOLENBQWM3SixRQUFkLElBQzdCQSxRQUQ2QixHQUU3QixDQUFDQSxRQUFELENBRko7QUFHQTJKLE1BQUFBLFNBQVMsQ0FBQ2xFLE9BQVYsQ0FBa0IsQ0FBQztBQUFFdkYsUUFBQUEsRUFBRjtBQUFNaUQsUUFBQUEsS0FBTjtBQUFhb0YsUUFBQUE7QUFBYixPQUFELEtBQTJCO0FBQzNDLFlBQUlBLE1BQU0sS0FBSyxDQUFmLEVBQWtCO0FBQ2hCLGVBQUs1RSxXQUFMLENBQWlCekQsRUFBakIsRUFBcUJpRCxLQUFyQixFQUE0QixLQUE1QjtBQUNELFNBRkQsTUFFTztBQUNMLGVBQUswRCxRQUFMLENBQWMzRyxFQUFkLEVBQWtCLElBQUlzSSxrQkFBSixDQUFlRCxNQUFmLEVBQXdCLElBQXhCLENBQWxCO0FBQ0Q7O0FBQ0QsY0FBTXZCLEtBQUssR0FBR3hFLEdBQUcsQ0FBQ3RDLEVBQUQsQ0FBakI7QUFDQStDLFFBQUFBLE9BQU8sQ0FBQ0MsTUFBUixDQUFlOEQsS0FBSyxJQUFJQSxLQUFLLENBQUNTLE1BQU4sR0FBZSxDQUF2QyxFQUEyQyxjQUFhdkgsRUFBRyxFQUEzRDtBQUNBOEcsUUFBQUEsS0FBSyxDQUFDdkIsT0FBTixDQUFlQyxRQUFELElBQWM7QUFDMUJULFVBQUFBLE1BQU0sQ0FBQ1MsUUFBRCxDQUFOLEdBQW1CNkMsTUFBTSxLQUFLLENBQVgsR0FDZixLQUFLN0MsUUFBTCxDQURlLEdBRWY7QUFBRW9CLFlBQUFBLEtBQUssRUFBRSxDQUFDLEtBQUsxRCxRQUFMLENBQWNsRCxFQUFkLEtBQXFCLEVBQXRCLEVBQTBCNEosT0FBMUIsSUFBcUM7QUFBOUMsV0FGSjtBQUdELFNBSkQ7QUFLRCxPQWJEO0FBY0EsYUFBTzdFLE1BQVA7QUFDRCxLQXRCSSxFQXVCTDJDLE9BQU8sQ0FBQzVELE9BQVIsQ0FBZ0IsRUFBaEIsQ0F2QkssQ0FBUDtBQXlCRDs7QUFFRCxRQUFNK0YsTUFBTixDQUFhQyxNQUFiLEVBQTZCQyxNQUFNLEdBQUcsQ0FBdEMsRUFBeUM1SCxJQUF6QyxFQUF5RTtBQUN2RSxVQUFNO0FBQUVzRCxNQUFBQTtBQUFGLFFBQWlCLElBQXZCOztBQUNBLFFBQUk7QUFDRixVQUFJLENBQUNBLFVBQUwsRUFBaUIsTUFBTSxJQUFJbkMsS0FBSixDQUFVLGNBQVYsQ0FBTjtBQUNqQixZQUFNMEcsU0FBUyxHQUFHLHVDQUE2QixLQUFLaEUsT0FBbEMsRUFBMkM4RCxNQUFNLENBQUNHLE1BQVAsQ0FBYyxDQUFkLEVBQWlCLElBQWpCLENBQTNDLENBQWxCO0FBQ0EsWUFBTTtBQUFFakssUUFBQUEsRUFBRjtBQUFNaUQsUUFBQUEsS0FBSyxFQUFFaUgsVUFBYjtBQUF5QjdCLFFBQUFBO0FBQXpCLFVBQ0osTUFBTTVDLFVBQVUsQ0FBQzBDLFlBQVgsQ0FBd0I2QixTQUF4QixDQURSOztBQUVBLFVBQUkzQixNQUFNLEtBQUssQ0FBZixFQUFrQjtBQUNoQjtBQUNBLGNBQU0sSUFBSUMsa0JBQUosQ0FBZUQsTUFBZixFQUF3QixJQUF4QixFQUE4Qiw2QkFBOUIsQ0FBTjtBQUNEOztBQUNELFlBQU04QixVQUFVLEdBQUcsMENBQWdDLEtBQUtuRSxPQUFyQyxFQUE4Q2hHLEVBQTlDLENBQW5CO0FBQ0EsWUFBTTtBQUFFcUksUUFBQUEsTUFBTSxFQUFFK0I7QUFBVixVQUF1QixNQUFNM0UsVUFBVSxDQUFDMEMsWUFBWCxDQUF3QmdDLFVBQXhCLENBQW5DOztBQUNBLFVBQUlDLFFBQVEsS0FBSyxDQUFqQixFQUFvQjtBQUNsQixjQUFNLElBQUk5QixrQkFBSixDQUFlOEIsUUFBZixFQUEwQixJQUExQixFQUFnQyw4QkFBaEMsQ0FBTjtBQUNEOztBQUNELFlBQU1DLEtBQUssR0FBR2xJLElBQUksSUFBSytILFVBQVUsR0FBR0gsTUFBcEM7QUFDQSxVQUFJTyxJQUFJLEdBQUdELEtBQVg7QUFDQSxVQUFJRSxHQUFHLEdBQUdSLE1BQVY7QUFDQSxXQUFLbkUsSUFBTCxDQUNFLGFBREYsRUFFRTtBQUNFa0UsUUFBQUEsTUFERjtBQUVFSSxRQUFBQSxVQUZGO0FBR0VILFFBQUFBLE1BSEY7QUFJRTVILFFBQUFBLElBQUksRUFBRWtJO0FBSlIsT0FGRjtBQVNBLFlBQU1HLElBQWMsR0FBRyxFQUF2Qjs7QUFDQSxhQUFPRixJQUFJLEdBQUcsQ0FBZCxFQUFpQjtBQUNmLGNBQU0vQyxNQUFNLEdBQUd0RixJQUFJLENBQUNiLEdBQUwsQ0FBUyxHQUFULEVBQWNrSixJQUFkLENBQWY7QUFDQSxjQUFNRyxhQUFhLEdBQUcsaUNBQXVCLEtBQUt6RSxPQUE1QixFQUFxQ2hHLEVBQXJDLEVBQXlDdUssR0FBekMsRUFBOENoRCxNQUE5QyxDQUF0QjtBQUNBLGNBQU07QUFBRWMsVUFBQUEsTUFBTSxFQUFFcUMsWUFBVjtBQUF3QnpILFVBQUFBLEtBQUssRUFBRThCO0FBQS9CLFlBQ0osTUFBTVUsVUFBVSxDQUFDMEMsWUFBWCxDQUF3QnNDLGFBQXhCLENBRFI7O0FBRUEsWUFBSUMsWUFBWSxLQUFLLENBQXJCLEVBQXdCO0FBQ3RCLGdCQUFNLElBQUlwQyxrQkFBSixDQUFlb0MsWUFBZixFQUE4QixJQUE5QixFQUFvQyxzQkFBcEMsQ0FBTjtBQUNEOztBQUNELFlBQUkzRixNQUFNLENBQUM0RixJQUFQLENBQVlwRCxNQUFaLEtBQXVCLENBQTNCLEVBQThCO0FBQzVCO0FBQ0Q7O0FBQ0RpRCxRQUFBQSxJQUFJLENBQUMzSSxJQUFMLENBQVVrRCxNQUFNLENBQUM0RixJQUFqQjtBQUNBLGFBQUsvRSxJQUFMLENBQ0UsWUFERixFQUVFO0FBQ0VrRSxVQUFBQSxNQURGO0FBRUVTLFVBQUFBLEdBRkY7QUFHRUksVUFBQUEsSUFBSSxFQUFFNUYsTUFBTSxDQUFDNEY7QUFIZixTQUZGO0FBUUFMLFFBQUFBLElBQUksSUFBSXZGLE1BQU0sQ0FBQzRGLElBQVAsQ0FBWXBELE1BQXBCO0FBQ0FnRCxRQUFBQSxHQUFHLElBQUl4RixNQUFNLENBQUM0RixJQUFQLENBQVlwRCxNQUFuQjtBQUNEOztBQUNELFlBQU14QyxNQUFNLEdBQUc2RixNQUFNLENBQUNDLE1BQVAsQ0FBY0wsSUFBZCxDQUFmO0FBQ0EsV0FBSzVFLElBQUwsQ0FDRSxjQURGLEVBRUU7QUFDRWtFLFFBQUFBLE1BREY7QUFFRUMsUUFBQUEsTUFGRjtBQUdFWSxRQUFBQSxJQUFJLEVBQUU1RjtBQUhSLE9BRkY7QUFRQSxhQUFPQSxNQUFQO0FBQ0QsS0E1REQsQ0E0REUsT0FBTytGLENBQVAsRUFBVTtBQUNWLFdBQUtsRixJQUFMLENBQVUsYUFBVixFQUF5QmtGLENBQXpCO0FBQ0EsWUFBTUEsQ0FBTjtBQUNEO0FBQ0Y7O0FBRUQsUUFBTUMsUUFBTixDQUFlakIsTUFBZixFQUErQmtCLE1BQS9CLEVBQStDakIsTUFBTSxHQUFHLENBQXhELEVBQTJEa0IsTUFBTSxHQUFHLEtBQXBFLEVBQTJFO0FBQ3pFLFVBQU07QUFBRXhGLE1BQUFBO0FBQUYsUUFBaUIsSUFBdkI7QUFDQSxRQUFJLENBQUNBLFVBQUwsRUFBaUIsTUFBTSxJQUFJbkMsS0FBSixDQUFVLGNBQVYsQ0FBTjtBQUNqQixVQUFNNEgsV0FBVyxHQUFHLHlDQUErQixLQUFLbEYsT0FBcEMsRUFBNkM4RCxNQUFNLENBQUNHLE1BQVAsQ0FBYyxDQUFkLEVBQWlCLElBQWpCLENBQTdDLENBQXBCO0FBQ0EsVUFBTTtBQUFFakssTUFBQUEsRUFBRjtBQUFNaUQsTUFBQUEsS0FBSyxFQUFFNUIsR0FBYjtBQUFrQmdILE1BQUFBO0FBQWxCLFFBQTZCLE1BQU01QyxVQUFVLENBQUMwQyxZQUFYLENBQXdCK0MsV0FBeEIsQ0FBekM7O0FBQ0EsUUFBSTdDLE1BQU0sS0FBSyxDQUFmLEVBQWtCO0FBQ2hCO0FBQ0EsWUFBTSxJQUFJQyxrQkFBSixDQUFlRCxNQUFmLEVBQXdCLElBQXhCLEVBQThCLCtCQUE5QixDQUFOO0FBQ0Q7O0FBQ0QsVUFBTThDLFNBQVMsR0FBRyxNQUFPckMsR0FBUCxJQUF1QjtBQUN2QyxVQUFJc0MsUUFBUSxHQUFHLENBQWY7O0FBQ0EsVUFBSSxDQUFDSCxNQUFMLEVBQWE7QUFDWCxjQUFNSSxHQUFHLEdBQUcsNkNBQW1DLEtBQUtyRixPQUF4QyxFQUFpRGhHLEVBQWpELENBQVo7QUFDQSxjQUFNc0wsR0FBRyxHQUFHLE1BQU03RixVQUFVLENBQUMwQyxZQUFYLENBQXdCa0QsR0FBeEIsQ0FBbEI7QUFDQUQsUUFBQUEsUUFBUSxHQUFHRSxHQUFHLENBQUNqRCxNQUFmO0FBQ0Q7O0FBQ0QsVUFBSVMsR0FBSixFQUFTLE1BQU1BLEdBQU47O0FBQ1QsVUFBSXNDLFFBQVEsS0FBSyxDQUFqQixFQUFvQjtBQUNsQixjQUFNLElBQUk5QyxrQkFBSixDQUNKOEMsUUFESSxFQUVKLElBRkksRUFHSix5REFISSxDQUFOO0FBS0Q7QUFDRixLQWZEOztBQWdCQSxRQUFJSixNQUFNLENBQUN6RCxNQUFQLEdBQWdCbEcsR0FBRyxHQUFHMEksTUFBMUIsRUFBa0M7QUFDaEMsWUFBTSxJQUFJekcsS0FBSixDQUFXLDZCQUE0QmpDLEdBQUcsR0FBRzBJLE1BQU8sUUFBcEQsQ0FBTjtBQUNEOztBQUNELFVBQU13QixZQUFZLEdBQUcsNENBQWtDLEtBQUt2RixPQUF2QyxFQUFnRGhHLEVBQWhELENBQXJCO0FBQ0EsVUFBTTtBQUFFcUksTUFBQUEsTUFBTSxFQUFFK0I7QUFBVixRQUF1QixNQUFNM0UsVUFBVSxDQUFDMEMsWUFBWCxDQUF3Qm9ELFlBQXhCLENBQW5DOztBQUNBLFFBQUluQixRQUFRLEtBQUssQ0FBakIsRUFBb0I7QUFDbEIsWUFBTSxJQUFJOUIsa0JBQUosQ0FBZThCLFFBQWYsRUFBMEIsSUFBMUIsRUFBZ0MsZ0NBQWhDLENBQU47QUFDRDs7QUFDRCxTQUFLeEUsSUFBTCxDQUNFLGVBREYsRUFFRTtBQUNFa0UsTUFBQUEsTUFERjtBQUVFQyxNQUFBQSxNQUZGO0FBR0VHLE1BQUFBLFVBQVUsRUFBRTdJLEdBSGQ7QUFJRWMsTUFBQUEsSUFBSSxFQUFFNkksTUFBTSxDQUFDekQ7QUFKZixLQUZGO0FBU0EsVUFBTWlFLEdBQUcsR0FBRyxxQkFBV1IsTUFBWCxFQUFtQixDQUFuQixDQUFaO0FBQ0EsVUFBTVMsU0FBUyxHQUFHQywrQkFBc0IsQ0FBeEM7QUFDQSxVQUFNcEMsTUFBTSxHQUFHLHdCQUFXMEIsTUFBWCxFQUFtQlMsU0FBbkIsQ0FBZjtBQUNBLFVBQU1uQyxNQUFNLENBQUN2QixNQUFQLENBQWMsT0FBT3BDLElBQVAsRUFBYTRELEtBQWIsRUFBNEJvQyxDQUE1QixLQUFrQztBQUNwRCxZQUFNaEcsSUFBTjtBQUNBLFlBQU00RSxHQUFHLEdBQUdvQixDQUFDLEdBQUdGLFNBQUosR0FBZ0IxQixNQUE1QjtBQUNBLFlBQU02QixlQUFlLEdBQ25CLG1DQUF5QixLQUFLNUYsT0FBOUIsRUFBdUNoRyxFQUF2QyxFQUE0Q3VLLEdBQTVDLEVBQWlEaEIsS0FBakQsQ0FERjtBQUVBLFlBQU07QUFBRWxCLFFBQUFBLE1BQU0sRUFBRXdEO0FBQVYsVUFDSixNQUFNcEcsVUFBVSxDQUFDMEMsWUFBWCxDQUF3QnlELGVBQXhCLENBRFI7O0FBRUEsVUFBSUMsWUFBWSxLQUFLLENBQXJCLEVBQXdCO0FBQ3RCLGNBQU1WLFNBQVMsQ0FBQyxJQUFJN0Msa0JBQUosQ0FBZXVELFlBQWYsRUFBOEIsSUFBOUIsRUFBb0Msd0JBQXBDLENBQUQsQ0FBZjtBQUNEOztBQUNELFdBQUtqRyxJQUFMLENBQ0UsY0FERixFQUVFO0FBQ0VrRSxRQUFBQSxNQURGO0FBRUV2QyxRQUFBQSxNQUFNLEVBQUVnQyxLQUFLLENBQUNoQztBQUZoQixPQUZGO0FBT0QsS0FqQkssRUFpQkhHLE9BQU8sQ0FBQzVELE9BQVIsRUFqQkcsQ0FBTjtBQWtCQSxVQUFNZ0ksTUFBTSxHQUFHLHdDQUE4QixLQUFLOUYsT0FBbkMsRUFBNENoRyxFQUE1QyxFQUFnRCtKLE1BQWhELEVBQXdEaUIsTUFBTSxDQUFDekQsTUFBL0QsRUFBdUVpRSxHQUF2RSxDQUFmO0FBQ0EsVUFBTTtBQUFFbkQsTUFBQUEsTUFBTSxFQUFFMEQ7QUFBVixRQUF5QixNQUFNdEcsVUFBVSxDQUFDMEMsWUFBWCxDQUF3QjJELE1BQXhCLENBQXJDOztBQUNBLFFBQUlDLFVBQVUsS0FBSyxDQUFuQixFQUFzQjtBQUNwQixZQUFNWixTQUFTLENBQUMsSUFBSTdDLGtCQUFKLENBQWV5RCxVQUFmLEVBQTRCLElBQTVCLEVBQWtDLHdCQUFsQyxDQUFELENBQWY7QUFDRDs7QUFDRCxVQUFNWixTQUFTLEVBQWY7QUFDQSxTQUFLdkYsSUFBTCxDQUNFLGdCQURGLEVBRUU7QUFDRWtFLE1BQUFBLE1BREY7QUFFRUMsTUFBQUEsTUFGRjtBQUdFNUgsTUFBQUEsSUFBSSxFQUFFNkksTUFBTSxDQUFDekQ7QUFIZixLQUZGO0FBUUQ7O0FBRUQsUUFBTXlFLE9BQU4sQ0FBY0MsT0FBZCxFQUErQi9HLElBQS9CLEVBQTJEO0FBQ3pELFVBQU07QUFBRU8sTUFBQUE7QUFBRixRQUFpQixJQUF2QjtBQUNBLFFBQUksQ0FBQ0EsVUFBTCxFQUFpQixNQUFNLElBQUluQyxLQUFKLENBQVUsY0FBVixDQUFOO0FBQ2pCLFVBQU1qRCxXQUFXLEdBQUdRLE9BQU8sQ0FBQ2tGLFdBQVIsQ0FBb0IsYUFBcEIsRUFBbUMsSUFBbkMsQ0FBcEI7O0FBQ0EsUUFBSSxDQUFDMUYsV0FBRCxJQUFnQixDQUFDUSxPQUFPLENBQUN3RixHQUFSLENBQVloRyxXQUFaLEVBQXlCNEwsT0FBekIsQ0FBckIsRUFBd0Q7QUFDdEQsWUFBTSxJQUFJM0ksS0FBSixDQUFXLG1CQUFrQjJJLE9BQVEsRUFBckMsQ0FBTjtBQUNEOztBQUNELFVBQU1DLFVBQVUsR0FBRzdMLFdBQVcsQ0FBQzRMLE9BQUQsQ0FBOUI7QUFDQSxVQUFNRSxLQUFtQixHQUFHLEVBQTVCOztBQUNBLFFBQUlELFVBQVUsQ0FBQ2hILElBQWYsRUFBcUI7QUFDbkI5QyxNQUFBQSxNQUFNLENBQUNDLE9BQVAsQ0FBZTZKLFVBQVUsQ0FBQ2hILElBQTFCLEVBQWdDSyxPQUFoQyxDQUF3QyxDQUFDLENBQUM5QyxJQUFELEVBQU8wQyxJQUFQLENBQUQsS0FBa0I7QUFDeEQsY0FBTWlILEdBQUcsR0FBR2xILElBQUksSUFBSUEsSUFBSSxDQUFDekMsSUFBRCxDQUF4QjtBQUNBLFlBQUksQ0FBQzJKLEdBQUwsRUFBVSxNQUFNLElBQUk5SSxLQUFKLENBQVcsZ0JBQWViLElBQUssZUFBY3dKLE9BQVEsRUFBckQsQ0FBTjtBQUNWRSxRQUFBQSxLQUFLLENBQUN0SyxJQUFOLENBQVcsQ0FBQ3NELElBQUksQ0FBQ25ILElBQU4sRUFBWW9PLEdBQVosQ0FBWDtBQUNELE9BSkQ7QUFLRDs7QUFDRCxVQUFNZixHQUFHLEdBQUcseUNBQ1YsS0FBS3JGLE9BREssRUFFVmtHLFVBQVUsQ0FBQ2xNLEVBRkQsRUFHVmtNLFVBQVUsQ0FBQ0csUUFIRCxFQUlWLEdBQUdGLEtBSk8sQ0FBWjtBQU1BLFdBQU8xRyxVQUFVLENBQUMwQyxZQUFYLENBQXdCa0QsR0FBeEIsQ0FBUDtBQUNEOztBQXhnQjJELEMsQ0EyZ0I5RDs7O0FBWUEsU0FBU2lCLGFBQVQsQ0FBdUJ0TyxJQUF2QixFQUFxQ3VPLE9BQXJDLEVBQTJFO0FBQ3pFLFFBQU1DLElBQUksR0FBRzNJLGNBQUtDLE9BQUwsQ0FBYTJJLHNCQUFhLE1BQTFCLEVBQWtDLGFBQWxDLEVBQWlEM1AsT0FBakQsQ0FBYjs7QUFDQSxRQUFNNFAsUUFBUSxHQUFHQyxnQkFBUXRJLE1BQVIsQ0FBZUMsT0FBTyxDQUFDa0ksSUFBRCxDQUF0QixDQUFqQjs7QUFDQSxNQUFJRSxRQUFRLENBQUNuSSxNQUFULEVBQUosRUFBdUI7QUFDckIsVUFBTSxJQUFJakIsS0FBSixDQUFXLHVCQUFzQmtKLElBQUs7SUFDNUNoSSwyQkFBYUMsTUFBYixDQUFvQmlJLFFBQXBCLENBQThCLEVBRHhCLENBQU47QUFFRDs7QUFDRCxRQUFNO0FBQUVFLElBQUFBO0FBQUYsTUFBZUYsUUFBUSxDQUFDekosS0FBOUI7QUFDQSxRQUFNNEosSUFBSSxHQUFHRCxRQUFRLENBQUU1TyxJQUFGLENBQXJCOztBQUNBLE1BQUk2TyxJQUFJLElBQUlBLElBQUksQ0FBQ3RGLE1BQWpCLEVBQXlCO0FBQ3ZCLFFBQUl1RixPQUFPLEdBQUdELElBQUksQ0FBQyxDQUFELENBQWxCOztBQUNBLFFBQUlOLE9BQU8sSUFBSU0sSUFBSSxDQUFDdEYsTUFBTCxHQUFjLENBQTdCLEVBQWdDO0FBQzlCdUYsTUFBQUEsT0FBTyxHQUFHakksZ0JBQUVrSSxRQUFGLENBQVdGLElBQVgsRUFBaUIsQ0FBQztBQUFFRyxRQUFBQSxVQUFVLEdBQUc7QUFBZixPQUFELEtBQXdCQSxVQUFVLElBQUlULE9BQXZELEtBQW1FTyxPQUE3RTtBQUNEOztBQUNELFdBQU9BLE9BQU8sQ0FBQ3BJLEdBQWY7QUFDRCxHQWZ3RSxDQWdCekU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUNEOztBQVFELFNBQVN1SSxjQUFULENBQXdCdkksR0FBeEIsRUFBK0M7QUFDN0MsTUFBSVIsV0FBVyxHQUFHdEcsYUFBYSxDQUFDOEcsR0FBRCxDQUEvQjs7QUFDQSxNQUFJLENBQUNSLFdBQUwsRUFBa0I7QUFDaEI7QUFDQSxhQUFTZ0osTUFBVCxDQUF1Q2xILE9BQXZDLEVBQXlEO0FBQ3ZEL0IsMkJBQWFrSixLQUFiLENBQW1CLElBQW5COztBQUNBLFdBQUtuUSxPQUFMLElBQWdCLEVBQWhCO0FBQ0EsV0FBS0UsT0FBTCxJQUFnQixFQUFoQjtBQUNBLFdBQUtDLFFBQUwsSUFBaUIsRUFBakI7QUFDQTBELE1BQUFBLE9BQU8sQ0FBQzZDLGNBQVIsQ0FBdUIsSUFBdkIsRUFBNkIsU0FBN0IsRUFBd0Msb0JBQVVzQyxPQUFWLENBQXhDO0FBQ0EsV0FBS2dCLFNBQUwsR0FBaUIsQ0FBakI7QUFDQyxVQUFELENBQWNoSCxFQUFkLEdBQW1CLHNCQUFuQixDQVB1RCxDQVF2RDtBQUNEOztBQUVELFVBQU1vTixTQUFTLEdBQUcsSUFBSXBKLGVBQUosQ0FBb0JVLEdBQXBCLENBQWxCO0FBQ0F3SSxJQUFBQSxNQUFNLENBQUNFLFNBQVAsR0FBbUJoTCxNQUFNLENBQUNpTCxNQUFQLENBQWNELFNBQWQsQ0FBbkI7QUFDQ0YsSUFBQUEsTUFBRCxDQUFnQkksV0FBaEIsR0FBK0IsR0FBRTVJLEdBQUcsQ0FBQyxDQUFELENBQUgsQ0FBTzZJLFdBQVAsRUFBcUIsR0FBRTdJLEdBQUcsQ0FBQzhJLEtBQUosQ0FBVSxDQUFWLENBQWEsRUFBckU7QUFDQXRKLElBQUFBLFdBQVcsR0FBR2dKLE1BQWQ7QUFDQXRQLElBQUFBLGFBQWEsQ0FBQzhHLEdBQUQsQ0FBYixHQUFxQlIsV0FBckI7QUFDRDs7QUFDRCxTQUFPQSxXQUFQO0FBQ0Q7O0FBRU0sU0FBU3VKLGVBQVQsQ0FBeUIvSSxHQUF6QixFQUE4QztBQUNuRCxTQUFPdUksY0FBYyxDQUFDdkksR0FBRCxDQUFkLENBQW9CMEksU0FBM0I7QUFDRDs7QUFFTSxNQUFNTSxPQUFOLFNBQXNCekosb0JBQXRCLENBQW1DO0FBQUE7QUFBQTs7QUFBQSxpQ0FDbEMsTUFBaUJZLGdCQUFFYSxNQUFGLENBQVMvSCxTQUFULENBRGlCOztBQUFBLGtDQUdoQ3FJLE9BQUQsSUFBZ0Q7QUFDckQsWUFBTTJILGFBQWEsR0FBRyxJQUFJQyxnQkFBSixDQUFZNUgsT0FBWixDQUF0QjtBQUNBLGFBQU9ySSxTQUFTLENBQUNnUSxhQUFhLENBQUMxSCxRQUFkLEVBQUQsQ0FBaEI7QUFDRCxLQU51QztBQUFBOztBQVV4Q29ILEVBQUFBLE1BQU0sQ0FBQ3JILE9BQUQsRUFBd0I2SCxTQUF4QixFQUF3Q3RCLE9BQXhDLEVBQW1FO0FBQ3ZFLFFBQUk3SCxHQUFKOztBQUNBLFFBQUksT0FBT21KLFNBQVAsS0FBcUIsUUFBekIsRUFBbUM7QUFDakNuSixNQUFBQSxHQUFHLEdBQUc0SCxhQUFhLENBQUN1QixTQUFELEVBQVl0QixPQUFaLENBQW5CO0FBQ0EsVUFBSTdILEdBQUcsS0FBSzFDLFNBQVosRUFBdUIsTUFBTSxJQUFJc0IsS0FBSixDQUFVLGtCQUFWLENBQU47QUFDeEIsS0FIRCxNQUdPLElBQUksT0FBT3VLLFNBQVAsS0FBcUIsUUFBekIsRUFBbUM7QUFDeENuSixNQUFBQSxHQUFHLEdBQUdvSixNQUFNLENBQUNELFNBQUQsQ0FBWjtBQUNELEtBRk0sTUFFQTtBQUNMLFlBQU0sSUFBSXZLLEtBQUosQ0FBVyw2QkFBNEJ1SyxTQUFVLEVBQWpELENBQU47QUFDRDs7QUFDRCxVQUFNRixhQUFhLEdBQUcsSUFBSUMsZ0JBQUosQ0FBWTVILE9BQVosQ0FBdEI7QUFDQSxRQUFJN0YsTUFBTSxHQUFHeEMsU0FBUyxDQUFDZ1EsYUFBYSxDQUFDMUgsUUFBZCxFQUFELENBQXRCOztBQUNBLFFBQUk5RixNQUFKLEVBQVk7QUFDVjRDLE1BQUFBLE9BQU8sQ0FBQ0MsTUFBUixDQUNFbkMsT0FBTyxDQUFDa0YsV0FBUixDQUFvQixLQUFwQixFQUEyQjVGLE1BQTNCLE1BQXVDdUUsR0FEekMsRUFFRyxnQ0FBK0JBLEdBQUksRUFGdEM7QUFJQXZFLE1BQUFBLE1BQU0sQ0FBQzRHLE1BQVA7QUFDQSxhQUFPNUcsTUFBUDtBQUNEOztBQUVELFVBQU0rRCxXQUFXLEdBQUcrSSxjQUFjLENBQUN2SSxHQUFELENBQWxDO0FBQ0F2RSxJQUFBQSxNQUFNLEdBQUdVLE9BQU8sQ0FBQ2tOLFNBQVIsQ0FBa0I3SixXQUFsQixFQUErQixDQUFDeUosYUFBRCxDQUEvQixDQUFUOztBQUNBLFFBQUksQ0FBQ0EsYUFBYSxDQUFDSyxPQUFuQixFQUE0QjtBQUMxQnJRLE1BQUFBLFNBQVMsQ0FBQ2dRLGFBQWEsQ0FBQzFILFFBQWQsRUFBRCxDQUFULEdBQXNDOUYsTUFBdEM7QUFDQThOLE1BQUFBLE9BQU8sQ0FBQ0MsUUFBUixDQUFpQixNQUFNLEtBQUt0SSxJQUFMLENBQVUsS0FBVixFQUFpQnpGLE1BQWpCLENBQXZCO0FBQ0Q7O0FBQ0QsV0FBT0EsTUFBUDtBQUNEOztBQXRDdUM7OztBQXlDMUMsTUFBTWdILE9BQU8sR0FBRyxJQUFJdUcsT0FBSixFQUFoQjtlQUVldkcsTyIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IChjKSAyMDE5LiBPT08gTmF0YS1JbmZvXG4gKiBAYXV0aG9yIEFuZHJlaSBTYXJha2VldiA8YXZzQG5hdGEtaW5mby5ydT5cbiAqXG4gKiBUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgXCJAbmF0YVwiIHByb2plY3QuXG4gKiBGb3IgdGhlIGZ1bGwgY29weXJpZ2h0IGFuZCBsaWNlbnNlIGluZm9ybWF0aW9uLCBwbGVhc2Ugdmlld1xuICogdGhlIEVVTEEgZmlsZSB0aGF0IHdhcyBkaXN0cmlidXRlZCB3aXRoIHRoaXMgc291cmNlIGNvZGUuXG4gKi9cblxuLyogdHNsaW50OmRpc2FibGU6dmFyaWFibGUtbmFtZSAqL1xuaW1wb3J0IHsgY3JjMTZjY2l0dCB9IGZyb20gJ2NyYyc7XG5pbXBvcnQgZGVidWdGYWN0b3J5IGZyb20gJ2RlYnVnJztcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJ2lvLXRzJztcbmltcG9ydCB7IFBhdGhSZXBvcnRlciB9IGZyb20gJ2lvLXRzL2xpYi9QYXRoUmVwb3J0ZXInO1xuaW1wb3J0IF8gZnJvbSAnbG9kYXNoJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICdyZWZsZWN0LW1ldGFkYXRhJztcbmltcG9ydCB7IGNvbmZpZyBhcyBjb25maWdEaXIgfSBmcm9tICd4ZGctYmFzZWRpcic7XG5pbXBvcnQgQWRkcmVzcywgeyBBZGRyZXNzUGFyYW0gfSBmcm9tICcuLi9BZGRyZXNzJztcbmltcG9ydCB7IE5pYnVzRXJyb3IgfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IHsgTk1TX01BWF9EQVRBX0xFTkdUSCB9IGZyb20gJy4uL25iY29uc3QnO1xuaW1wb3J0IHsgTmlidXNDb25uZWN0aW9uIH0gZnJvbSAnLi4vbmlidXMnO1xuaW1wb3J0IHsgY2h1bmtBcnJheSB9IGZyb20gJy4uL25pYnVzL2hlbHBlcic7XG5pbXBvcnQge1xuICBjcmVhdGVFeGVjdXRlUHJvZ3JhbUludm9jYXRpb24sXG4gIGNyZWF0ZU5tc0Rvd25sb2FkU2VnbWVudCxcbiAgY3JlYXRlTm1zSW5pdGlhdGVEb3dubG9hZFNlcXVlbmNlLFxuICBjcmVhdGVObXNJbml0aWF0ZVVwbG9hZFNlcXVlbmNlLFxuICBjcmVhdGVObXNSZWFkLFxuICBjcmVhdGVObXNSZXF1ZXN0RG9tYWluRG93bmxvYWQsXG4gIGNyZWF0ZU5tc1JlcXVlc3REb21haW5VcGxvYWQsXG4gIGNyZWF0ZU5tc1Rlcm1pbmF0ZURvd25sb2FkU2VxdWVuY2UsXG4gIGNyZWF0ZU5tc1VwbG9hZFNlZ21lbnQsXG4gIGNyZWF0ZU5tc1ZlcmlmeURvbWFpbkNoZWNrc3VtLFxuICBjcmVhdGVObXNXcml0ZSxcbiAgZ2V0Tm1zVHlwZSxcbiAgVHlwZWRWYWx1ZSxcbn0gZnJvbSAnLi4vbm1zJztcbmltcG9ydCBObXNEYXRhZ3JhbSBmcm9tICcuLi9ubXMvTm1zRGF0YWdyYW0nO1xuaW1wb3J0IE5tc1ZhbHVlVHlwZSBmcm9tICcuLi9ubXMvTm1zVmFsdWVUeXBlJztcbmltcG9ydCB7IENvbmZpZ1YgfSBmcm9tICcuLi9zZXNzaW9uL2NvbW1vbic7XG5pbXBvcnQgdGltZWlkIGZyb20gJy4uL3RpbWVpZCc7XG5pbXBvcnQge1xuICBib29sZWFuQ29udmVydGVyLFxuICBjb252ZXJ0RnJvbSxcbiAgY29udmVydFRvLFxuICBlbnVtZXJhdGlvbkNvbnZlcnRlcixcbiAgZml4ZWRQb2ludE51bWJlcjRDb252ZXJ0ZXIsXG4gIGdldEludFNpemUsXG4gIElDb252ZXJ0ZXIsXG4gIG1heEluY2x1c2l2ZUNvbnZlcnRlcixcbiAgbWluSW5jbHVzaXZlQ29udmVydGVyLFxuICBwYWNrZWQ4ZmxvYXRDb252ZXJ0ZXIsXG4gIHBlcmNlbnRDb252ZXJ0ZXIsXG4gIHByZWNpc2lvbkNvbnZlcnRlcixcbiAgcmVwcmVzZW50YXRpb25Db252ZXJ0ZXIsXG4gIHRvSW50LFxuICB1bml0Q29udmVydGVyLFxuICB2YWxpZEpzTmFtZSxcbiAgdmVyc2lvblR5cGVDb252ZXJ0ZXIsXG4gIHdpdGhWYWx1ZSxcbn0gZnJvbSAnLi9taWInO1xuLy8gaW1wb3J0IHsgZ2V0TWlic1N5bmMgfSBmcm9tICcuL21pYjJqc29uJztcbi8vIGltcG9ydCBkZXRlY3RvciBmcm9tICcuLi9zZXJ2aWNlL2RldGVjdG9yJztcblxuY29uc3QgcGtnTmFtZSA9ICdAbmF0YS9uaWJ1cy5qcyc7IC8vIHJlcXVpcmUoJy4uLy4uL3BhY2thZ2UuanNvbicpLm5hbWU7XG5cbmNvbnN0IGRlYnVnID0gZGVidWdGYWN0b3J5KCduaWJ1czpkZXZpY2VzJyk7XG5cbmNvbnN0ICR2YWx1ZXMgPSBTeW1ib2woJ3ZhbHVlcycpO1xuY29uc3QgJGVycm9ycyA9IFN5bWJvbCgnZXJyb3JzJyk7XG5jb25zdCAkZGlydGllcyA9IFN5bWJvbCgnZGlydGllcycpO1xuXG5mdW5jdGlvbiBzYWZlTnVtYmVyKHZhbDogYW55KSB7XG4gIGNvbnN0IG51bSA9IHBhcnNlRmxvYXQodmFsKTtcbiAgcmV0dXJuIChOdW1iZXIuaXNOYU4obnVtKSB8fCBgJHtudW19YCAhPT0gdmFsKSA/IHZhbCA6IG51bTtcbn1cblxuZW51bSBQcml2YXRlUHJvcHMge1xuICBjb25uZWN0aW9uID0gLTEsXG59XG5cbmNvbnN0IGRldmljZU1hcDogeyBbYWRkcmVzczogc3RyaW5nXTogRGV2aWNlUHJvdG90eXBlIH0gPSB7fTtcblxuY29uc3QgbWliVHlwZXNDYWNoZTogeyBbbWlibmFtZTogc3RyaW5nXTogRnVuY3Rpb24gfSA9IHt9O1xuXG5jb25zdCBNaWJQcm9wZXJ0eUFwcEluZm9WID0gdC5pbnRlcnNlY3Rpb24oW1xuICB0LnR5cGUoe1xuICAgIG5tc19pZDogdC51bmlvbihbdC5zdHJpbmcsIHQuSW50XSksXG4gICAgYWNjZXNzOiB0LnN0cmluZyxcbiAgfSksXG4gIHQucGFydGlhbCh7XG4gICAgY2F0ZWdvcnk6IHQuc3RyaW5nLFxuICB9KSxcbl0pO1xuXG4vLyBpbnRlcmZhY2UgSU1pYlByb3BlcnR5QXBwSW5mbyBleHRlbmRzIHQuVHlwZU9mPHR5cGVvZiBNaWJQcm9wZXJ0eUFwcEluZm9WPiB7fVxuXG5jb25zdCBNaWJQcm9wZXJ0eVYgPSB0LnR5cGUoe1xuICB0eXBlOiB0LnN0cmluZyxcbiAgYW5ub3RhdGlvbjogdC5zdHJpbmcsXG4gIGFwcGluZm86IE1pYlByb3BlcnR5QXBwSW5mb1YsXG59KTtcblxuaW50ZXJmYWNlIElNaWJQcm9wZXJ0eSBleHRlbmRzIHQuVHlwZU9mPHR5cGVvZiBNaWJQcm9wZXJ0eVY+IHtcbiAgLy8gYXBwaW5mbzogSU1pYlByb3BlcnR5QXBwSW5mbztcbn1cblxuY29uc3QgTWliRGV2aWNlQXBwSW5mb1YgPSB0LmludGVyc2VjdGlvbihbXG4gIHQudHlwZSh7XG4gICAgbWliX3ZlcnNpb246IHQuc3RyaW5nLFxuICB9KSxcbiAgdC5wYXJ0aWFsKHtcbiAgICBkZXZpY2VfdHlwZTogdC5zdHJpbmcsXG4gICAgbG9hZGVyX3R5cGU6IHQuc3RyaW5nLFxuICAgIGZpcm13YXJlOiB0LnN0cmluZyxcbiAgICBtaW5fdmVyc2lvbjogdC5zdHJpbmcsXG4gIH0pLFxuXSk7XG5cbmNvbnN0IE1pYkRldmljZVR5cGVWID0gdC50eXBlKHtcbiAgYW5ub3RhdGlvbjogdC5zdHJpbmcsXG4gIGFwcGluZm86IE1pYkRldmljZUFwcEluZm9WLFxuICBwcm9wZXJ0aWVzOiB0LnJlY29yZCh0LnN0cmluZywgTWliUHJvcGVydHlWKSxcbn0pO1xuXG5leHBvcnQgaW50ZXJmYWNlIElNaWJEZXZpY2VUeXBlIGV4dGVuZHMgdC5UeXBlT2Y8dHlwZW9mIE1pYkRldmljZVR5cGVWPiB7fVxuXG5jb25zdCBNaWJUeXBlViA9IHQuaW50ZXJzZWN0aW9uKFtcbiAgdC50eXBlKHtcbiAgICBiYXNlOiB0LnN0cmluZyxcbiAgfSksXG4gIHQucGFydGlhbCh7XG4gICAgYXBwaW5mbzogdC5wYXJ0aWFsKHtcbiAgICAgIHplcm86IHQuc3RyaW5nLFxuICAgICAgdW5pdHM6IHQuc3RyaW5nLFxuICAgICAgcHJlY2lzaW9uOiB0LnN0cmluZyxcbiAgICAgIHJlcHJlc2VudGF0aW9uOiB0LnN0cmluZyxcbiAgICB9KSxcbiAgICBtaW5JbmNsdXNpdmU6IHQuc3RyaW5nLFxuICAgIG1heEluY2x1c2l2ZTogdC5zdHJpbmcsXG4gICAgZW51bWVyYXRpb246IHQucmVjb3JkKHQuc3RyaW5nLCB0LnR5cGUoeyBhbm5vdGF0aW9uOiB0LnN0cmluZyB9KSksXG4gIH0pLFxuXSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU1pYlR5cGUgZXh0ZW5kcyB0LlR5cGVPZjx0eXBlb2YgTWliVHlwZVY+IHt9XG5cbmNvbnN0IE1pYlN1YnJvdXRpbmVWID0gdC5pbnRlcnNlY3Rpb24oW1xuICB0LnR5cGUoe1xuICAgIGFubm90YXRpb246IHQuc3RyaW5nLFxuICAgIGFwcGluZm86IHQuaW50ZXJzZWN0aW9uKFtcbiAgICAgIHQudHlwZSh7IG5tc19pZDogdC51bmlvbihbdC5zdHJpbmcsIHQuSW50XSkgfSksXG4gICAgICB0LnBhcnRpYWwoeyByZXNwb25zZTogdC5zdHJpbmcgfSksXG4gICAgXSksXG4gIH0pLFxuICB0LnBhcnRpYWwoe1xuICAgIHByb3BlcnRpZXM6IHQucmVjb3JkKHQuc3RyaW5nLCB0LnR5cGUoe1xuICAgICAgdHlwZTogdC5zdHJpbmcsXG4gICAgICBhbm5vdGF0aW9uOiB0LnN0cmluZyxcbiAgICB9KSksXG4gIH0pLFxuXSk7XG5cbmNvbnN0IFN1YnJvdXRpbmVUeXBlViA9IHQudHlwZSh7XG4gIGFubm90YXRpb246IHQuc3RyaW5nLFxuICBwcm9wZXJ0aWVzOiB0LnR5cGUoe1xuICAgIGlkOiB0LnR5cGUoe1xuICAgICAgdHlwZTogdC5saXRlcmFsKCd4czp1bnNpZ25lZFNob3J0JyksXG4gICAgICBhbm5vdGF0aW9uOiB0LnN0cmluZyxcbiAgICB9KSxcbiAgfSksXG59KTtcblxuZXhwb3J0IGNvbnN0IE1pYkRldmljZVYgPSB0LmludGVyc2VjdGlvbihbXG4gIHQudHlwZSh7XG4gICAgZGV2aWNlOiB0LnN0cmluZyxcbiAgICB0eXBlczogdC5yZWNvcmQodC5zdHJpbmcsIHQudW5pb24oW01pYkRldmljZVR5cGVWLCBNaWJUeXBlViwgU3Vicm91dGluZVR5cGVWXSkpLFxuICB9KSxcbiAgdC5wYXJ0aWFsKHtcbiAgICBzdWJyb3V0aW5lczogdC5yZWNvcmQodC5zdHJpbmcsIE1pYlN1YnJvdXRpbmVWKSxcbiAgfSksXG5dKTtcblxuaW50ZXJmYWNlIElNaWJEZXZpY2UgZXh0ZW5kcyB0LlR5cGVPZjx0eXBlb2YgTWliRGV2aWNlVj4ge31cblxudHlwZSBMaXN0ZW5lcjxUPiA9IChhcmc6IFQpID0+IHZvaWQ7XG50eXBlIENoYW5nZUFyZyA9IHsgaWQ6IG51bWJlciwgbmFtZXM6IHN0cmluZ1tdIH07XG5leHBvcnQgdHlwZSBDaGFuZ2VMaXN0ZW5lciA9IExpc3RlbmVyPENoYW5nZUFyZz47XG50eXBlIFVwbG9hZFN0YXJ0QXJnID0geyBkb21haW46IHN0cmluZywgZG9tYWluU2l6ZTogbnVtYmVyLCBvZmZzZXQ6IG51bWJlciwgc2l6ZTogbnVtYmVyIH07XG5leHBvcnQgdHlwZSBVcGxvYWRTdGFydExpc3RlbmVyID0gTGlzdGVuZXI8VXBsb2FkU3RhcnRBcmc+O1xudHlwZSBVcGxvYWREYXRhQXJnID0geyBkb21haW46IHN0cmluZywgZGF0YTogQnVmZmVyLCBwb3M6IG51bWJlciB9O1xuZXhwb3J0IHR5cGUgVXBsb2FkRGF0YUxpc3RlbmVyID0gTGlzdGVuZXI8VXBsb2FkRGF0YUFyZz47XG50eXBlIFVwbG9hZEZpbmlzaEFyZyA9IHsgZG9tYWluOiBzdHJpbmcsIG9mZnNldDogbnVtYmVyLCBkYXRhOiBCdWZmZXIgfTtcbmV4cG9ydCB0eXBlIFVwbG9hZEZpbmlzaExpc3RlbmVyID0gTGlzdGVuZXI8VXBsb2FkRmluaXNoQXJnPjtcbnR5cGUgRG93bmxvYWRTdGFydEFyZyA9IHsgZG9tYWluOiBzdHJpbmcsIGRvbWFpblNpemU6IG51bWJlciwgb2Zmc2V0OiBudW1iZXIsIHNpemU6IG51bWJlciB9O1xuZXhwb3J0IHR5cGUgRG93bmxvYWRTdGFydExpc3RlbmVyID0gTGlzdGVuZXI8RG93bmxvYWRTdGFydEFyZz47XG50eXBlIERvd25sb2FkRGF0YUFyZyA9IHsgZG9tYWluOiBzdHJpbmcsIGxlbmd0aDogbnVtYmVyIH07XG5leHBvcnQgdHlwZSBEb3dubG9hZERhdGFMaXN0ZW5lciA9IExpc3RlbmVyPERvd25sb2FkRGF0YUFyZz47XG50eXBlIERvd25sb2FkRmluaXNoQXJnID0geyBkb21haW46IHN0cmluZzsgb2Zmc2V0OiBudW1iZXIsIHNpemU6IG51bWJlciB9O1xuZXhwb3J0IHR5cGUgRG93bmxvYWRGaW5pc2hMaXN0ZW5lciA9IExpc3RlbmVyPERvd25sb2FkRmluaXNoQXJnPjtcbmV4cG9ydCB0eXBlIERldmljZUlkID0gc3RyaW5nICYgeyBfX2JyYW5kOiAnRGV2aWNlSWQnIH07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSURldmljZSB7XG4gIHJlYWRvbmx5IGlkOiBEZXZpY2VJZDtcbiAgcmVhZG9ubHkgYWRkcmVzczogQWRkcmVzcztcbiAgZHJhaW4oKTogUHJvbWlzZTxudW1iZXJbXT47XG4gIHdyaXRlKC4uLmlkczogbnVtYmVyW10pOiBQcm9taXNlPG51bWJlcltdPjtcbiAgcmVhZCguLi5pZHM6IG51bWJlcltdKTogUHJvbWlzZTx7IFtuYW1lOiBzdHJpbmddOiBhbnkgfT47XG4gIHVwbG9hZChkb21haW46IHN0cmluZywgb2Zmc2V0PzogbnVtYmVyLCBzaXplPzogbnVtYmVyKTogUHJvbWlzZTxCdWZmZXI+O1xuICBkb3dubG9hZChkb21haW46IHN0cmluZywgZGF0YTogQnVmZmVyLCBvZmZzZXQ/OiBudW1iZXIsIG5vVGVybT86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+O1xuICBleGVjdXRlKFxuICAgIHByb2dyYW06IHN0cmluZyxcbiAgICBhcmdzPzogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8Tm1zRGF0YWdyYW0gfCBObXNEYXRhZ3JhbVtdIHwgdW5kZWZpbmVkPjtcbiAgY29ubmVjdGlvbj86IE5pYnVzQ29ubmVjdGlvbjtcbiAgcmVsZWFzZSgpOiBudW1iZXI7XG4gIGdldElkKGlkT3JOYW1lOiBzdHJpbmcgfCBudW1iZXIpOiBudW1iZXI7XG4gIGdldE5hbWUoaWRPck5hbWU6IHN0cmluZyB8IG51bWJlcik6IHN0cmluZztcbiAgZ2V0UmF3VmFsdWUoaWRPck5hbWU6IG51bWJlciB8IHN0cmluZyk6IGFueTtcbiAgZ2V0RXJyb3IoaWRPck5hbWU6IG51bWJlciB8IHN0cmluZyk6IGFueTtcbiAgaXNEaXJ0eShpZE9yTmFtZTogc3RyaW5nIHwgbnVtYmVyKTogYm9vbGVhbjtcbiAgW21pYlByb3BlcnR5OiBzdHJpbmddOiBhbnk7XG5cbiAgb24oZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcsIGxpc3RlbmVyOiAoKSA9PiB2b2lkKTogdGhpcztcbiAgb24oZXZlbnQ6ICdjaGFuZ2luZycgfCAnY2hhbmdlZCcsIGxpc3RlbmVyOiBDaGFuZ2VMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAndXBsb2FkU3RhcnQnLCBsaXN0ZW5lcjogVXBsb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAndXBsb2FkRGF0YScsIGxpc3RlbmVyOiBVcGxvYWREYXRhTGlzdGVuZXIpOiB0aGlzO1xuICBvbihldmVudDogJ3VwbG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBVcGxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAnZG93bmxvYWRTdGFydCcsIGxpc3RlbmVyOiBEb3dubG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBvbihldmVudDogJ2Rvd25sb2FkRGF0YScsIGxpc3RlbmVyOiBEb3dubG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAnZG93bmxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogRG93bmxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG5cbiAgb25jZShldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnY2hhbmdpbmcnIHwgJ2NoYW5nZWQnLCBsaXN0ZW5lcjogQ2hhbmdlTGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAndXBsb2FkU3RhcnQnLCBsaXN0ZW5lcjogVXBsb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICd1cGxvYWREYXRhJywgbGlzdGVuZXI6IFVwbG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICd1cGxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogVXBsb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnZG93bmxvYWRTdGFydCcsIGxpc3RlbmVyOiBEb3dubG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnZG93bmxvYWREYXRhJywgbGlzdGVuZXI6IERvd25sb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgb25jZShldmVudDogJ2Rvd25sb2FkRmluaXNoJywgbGlzdGVuZXI6IERvd25sb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuXG4gIGFkZExpc3RlbmVyKGV2ZW50OiAnY29ubmVjdGVkJyB8ICdkaXNjb25uZWN0ZWQnLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCk6IHRoaXM7XG4gIGFkZExpc3RlbmVyKGV2ZW50OiAnY2hhbmdpbmcnIHwgJ2NoYW5nZWQnLCBsaXN0ZW5lcjogQ2hhbmdlTGlzdGVuZXIpOiB0aGlzO1xuICBhZGRMaXN0ZW5lcihldmVudDogJ3VwbG9hZFN0YXJ0JywgbGlzdGVuZXI6IFVwbG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBhZGRMaXN0ZW5lcihldmVudDogJ3VwbG9hZERhdGEnLCBsaXN0ZW5lcjogVXBsb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICd1cGxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogVXBsb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuICBhZGRMaXN0ZW5lcihldmVudDogJ2Rvd25sb2FkU3RhcnQnLCBsaXN0ZW5lcjogRG93bmxvYWRTdGFydExpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICdkb3dubG9hZERhdGEnLCBsaXN0ZW5lcjogRG93bmxvYWREYXRhTGlzdGVuZXIpOiB0aGlzO1xuICBhZGRMaXN0ZW5lcihldmVudDogJ2Rvd25sb2FkRmluaXNoJywgbGlzdGVuZXI6IERvd25sb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuXG4gIG9mZihldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICdjaGFuZ2luZycgfCAnY2hhbmdlZCcsIGxpc3RlbmVyOiBDaGFuZ2VMaXN0ZW5lcik6IHRoaXM7XG4gIG9mZihldmVudDogJ3VwbG9hZFN0YXJ0JywgbGlzdGVuZXI6IFVwbG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICd1cGxvYWREYXRhJywgbGlzdGVuZXI6IFVwbG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIG9mZihldmVudDogJ3VwbG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBVcGxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG4gIG9mZihldmVudDogJ2Rvd25sb2FkU3RhcnQnLCBsaXN0ZW5lcjogRG93bmxvYWRTdGFydExpc3RlbmVyKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAnZG93bmxvYWREYXRhJywgbGlzdGVuZXI6IERvd25sb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAnZG93bmxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogRG93bmxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG5cbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcsIGxpc3RlbmVyOiAoKSA9PiB2b2lkKTogdGhpcztcbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnQ6ICdjaGFuZ2luZycgfCAnY2hhbmdlZCcsIGxpc3RlbmVyOiBDaGFuZ2VMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAndXBsb2FkU3RhcnQnLCBsaXN0ZW5lcjogVXBsb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAndXBsb2FkRGF0YScsIGxpc3RlbmVyOiBVcGxvYWREYXRhTGlzdGVuZXIpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ3VwbG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBVcGxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAnZG93bmxvYWRTdGFydCcsIGxpc3RlbmVyOiBEb3dubG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ2Rvd25sb2FkRGF0YScsIGxpc3RlbmVyOiBEb3dubG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAnZG93bmxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogRG93bmxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG5cbiAgZW1pdChldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJyk6IGJvb2xlYW47XG4gIGVtaXQoZXZlbnQ6ICdjaGFuZ2luZycgfCAnY2hhbmdlZCcsIGFyZzogQ2hhbmdlQXJnKTogYm9vbGVhbjtcbiAgZW1pdChldmVudDogJ3VwbG9hZFN0YXJ0JywgYXJnOiBVcGxvYWRTdGFydEFyZyk6IGJvb2xlYW47XG4gIGVtaXQoZXZlbnQ6ICd1cGxvYWREYXRhJywgYXJnOiBVcGxvYWREYXRhQXJnKTogYm9vbGVhbjtcbiAgZW1pdChldmVudDogJ3VwbG9hZEZpbmlzaCcsIGFyZzogVXBsb2FkRmluaXNoQXJnKTogYm9vbGVhbjtcbiAgZW1pdChldmVudDogJ2Rvd25sb2FkU3RhcnQnLCBhcmc6IERvd25sb2FkU3RhcnRBcmcpOiBib29sZWFuO1xuICBlbWl0KGV2ZW50OiAnZG93bmxvYWREYXRhJywgYXJnOiBEb3dubG9hZERhdGFBcmcpOiBib29sZWFuO1xuICBlbWl0KGV2ZW50OiAnZG93bmxvYWRGaW5pc2gnLCBhcmc6IERvd25sb2FkRmluaXNoQXJnKTogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIElTdWJyb3V0aW5lRGVzYyB7XG4gIGlkOiBudW1iZXI7XG4gIC8vIG5hbWU6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgbm90UmVwbHk/OiBib29sZWFuO1xuICBhcmdzPzogeyBuYW1lOiBzdHJpbmcsIHR5cGU6IE5tc1ZhbHVlVHlwZSwgZGVzYz86IHN0cmluZyB9W107XG59XG5cbmludGVyZmFjZSBJUHJvcGVydHlEZXNjcmlwdG9yPE93bmVyPiB7XG4gIGNvbmZpZ3VyYWJsZT86IGJvb2xlYW47XG4gIGVudW1lcmFibGU/OiBib29sZWFuO1xuICB2YWx1ZT86IGFueTtcbiAgd3JpdGFibGU/OiBib29sZWFuO1xuXG4gIGdldD8odGhpczogT3duZXIpOiBhbnk7XG5cbiAgc2V0Pyh0aGlzOiBPd25lciwgdjogYW55KTogdm9pZDtcbn1cblxuZnVuY3Rpb24gZ2V0QmFzZVR5cGUodHlwZXM6IElNaWJEZXZpY2VbJ3R5cGVzJ10sIHR5cGU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGxldCBiYXNlID0gdHlwZTtcbiAgZm9yIChsZXQgc3VwZXJUeXBlOiBJTWliVHlwZSA9IHR5cGVzW2Jhc2VdIGFzIElNaWJUeXBlOyBzdXBlclR5cGUgIT0gbnVsbDtcbiAgICAgICBzdXBlclR5cGUgPSB0eXBlc1tzdXBlclR5cGUuYmFzZV0gYXMgSU1pYlR5cGUpIHtcbiAgICBiYXNlID0gc3VwZXJUeXBlLmJhc2U7XG4gIH1cbiAgcmV0dXJuIGJhc2U7XG59XG5cbmZ1bmN0aW9uIGRlZmluZU1pYlByb3BlcnR5KFxuICB0YXJnZXQ6IERldmljZVByb3RvdHlwZSxcbiAga2V5OiBzdHJpbmcsXG4gIHR5cGVzOiBJTWliRGV2aWNlWyd0eXBlcyddLFxuICBwcm9wOiBJTWliUHJvcGVydHkpOiBbbnVtYmVyLCBzdHJpbmddIHtcbiAgY29uc3QgcHJvcGVydHlLZXkgPSB2YWxpZEpzTmFtZShrZXkpO1xuICBjb25zdCB7IGFwcGluZm8gfSA9IHByb3A7XG4gIGNvbnN0IGlkID0gdG9JbnQoYXBwaW5mby5ubXNfaWQpO1xuICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdpZCcsIGlkLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgY29uc3Qgc2ltcGxlVHlwZSA9IGdldEJhc2VUeXBlKHR5cGVzLCBwcm9wLnR5cGUpO1xuICBjb25zdCB0eXBlID0gdHlwZXNbcHJvcC50eXBlXSBhcyBJTWliVHlwZTtcbiAgY29uc3QgY29udmVydGVyczogSUNvbnZlcnRlcltdID0gW107XG4gIGNvbnN0IGlzUmVhZGFibGUgPSBhcHBpbmZvLmFjY2Vzcy5pbmRleE9mKCdyJykgPiAtMTtcbiAgY29uc3QgaXNXcml0YWJsZSA9IGFwcGluZm8uYWNjZXNzLmluZGV4T2YoJ3cnKSA+IC0xO1xuICBsZXQgZW51bWVyYXRpb246IElNaWJUeXBlWydlbnVtZXJhdGlvbiddIHwgdW5kZWZpbmVkO1xuICBsZXQgbWluOiBudW1iZXIgfCB1bmRlZmluZWQ7XG4gIGxldCBtYXg6IG51bWJlciB8IHVuZGVmaW5lZDtcbiAgc3dpdGNoIChnZXRObXNUeXBlKHNpbXBsZVR5cGUpKSB7XG4gICAgY2FzZSBObXNWYWx1ZVR5cGUuSW50ODpcbiAgICAgIG1pbiA9IC0xMjg7XG4gICAgICBtYXggPSAxMjc7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE5tc1ZhbHVlVHlwZS5JbnQxNjpcbiAgICAgIG1pbiA9IC0zMjc2ODtcbiAgICAgIG1heCA9IDMyNzY3O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBObXNWYWx1ZVR5cGUuSW50MzI6XG4gICAgICBtaW4gPSAtMjE0NzQ4MzY0ODtcbiAgICAgIG1heCA9IDIxNDc0ODM2NDc7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE5tc1ZhbHVlVHlwZS5VSW50ODpcbiAgICAgIG1pbiA9IDA7XG4gICAgICBtYXggPSAyNTU7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE5tc1ZhbHVlVHlwZS5VSW50MTY6XG4gICAgICBtaW4gPSAwO1xuICAgICAgbWF4ID0gNjU1MzU7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE5tc1ZhbHVlVHlwZS5VSW50MzI6XG4gICAgICBtaW4gPSAwO1xuICAgICAgbWF4ID0gNDI5NDk2NzI5NTtcbiAgICAgIGJyZWFrO1xuICB9XG4gIHN3aXRjaCAoc2ltcGxlVHlwZSkge1xuICAgIGNhc2UgJ3BhY2tlZDhGbG9hdCc6XG4gICAgICBjb252ZXJ0ZXJzLnB1c2gocGFja2VkOGZsb2F0Q29udmVydGVyKHR5cGUpKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2ZpeGVkUG9pbnROdW1iZXI0JzpcbiAgICAgIGNvbnZlcnRlcnMucHVzaChmaXhlZFBvaW50TnVtYmVyNENvbnZlcnRlcik7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgYnJlYWs7XG4gIH1cbiAgaWYgKGtleSA9PT0gJ2JyaWdodG5lc3MnICYmIHByb3AudHlwZSA9PT0gJ3hzOnVuc2lnbmVkQnl0ZScpIHtcbiAgICBjb252ZXJ0ZXJzLnB1c2gocGVyY2VudENvbnZlcnRlcik7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgndW5pdCcsICclJywgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWluJywgMCwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWF4JywgMTAwLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgfSBlbHNlIGlmIChpc1dyaXRhYmxlKSB7XG4gICAgaWYgKHR5cGUgIT0gbnVsbCkge1xuICAgICAgY29uc3QgeyBtaW5JbmNsdXNpdmUsIG1heEluY2x1c2l2ZSB9ID0gdHlwZTtcbiAgICAgIGlmIChtaW5JbmNsdXNpdmUpIHtcbiAgICAgICAgY29uc3QgdmFsID0gcGFyc2VGbG9hdChtaW5JbmNsdXNpdmUpO1xuICAgICAgICBtaW4gPSBtaW4gIT09IHVuZGVmaW5lZCA/IE1hdGgubWF4KG1pbiwgdmFsKSA6IHZhbDtcbiAgICAgIH1cbiAgICAgIGlmIChtYXhJbmNsdXNpdmUpIHtcbiAgICAgICAgY29uc3QgdmFsID0gcGFyc2VGbG9hdChtYXhJbmNsdXNpdmUpO1xuICAgICAgICBtYXggPSBtYXggIT09IHVuZGVmaW5lZCA/IE1hdGgubWluKG1heCwgdmFsKSA6IHZhbDtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG1pbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBtaW4gPSBjb252ZXJ0VG8oY29udmVydGVycykobWluKSBhcyBudW1iZXI7XG4gICAgICBjb252ZXJ0ZXJzLnB1c2gobWluSW5jbHVzaXZlQ29udmVydGVyKG1pbikpO1xuICAgICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWluJywgbWluLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgICB9XG4gICAgaWYgKG1heCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBtYXggPSBjb252ZXJ0VG8oY29udmVydGVycykobWF4KSBhcyBudW1iZXI7XG4gICAgICBjb252ZXJ0ZXJzLnB1c2gobWF4SW5jbHVzaXZlQ29udmVydGVyKG1heCkpO1xuICAgICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWF4JywgbWF4LCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgICB9XG4gIH1cbiAgaWYgKHR5cGUgIT0gbnVsbCkge1xuICAgIGNvbnN0IHsgYXBwaW5mbzogaW5mbyA9IHt9IH0gPSB0eXBlO1xuICAgIGVudW1lcmF0aW9uID0gdHlwZS5lbnVtZXJhdGlvbjtcbiAgICBjb25zdCB7IHVuaXRzLCBwcmVjaXNpb24sIHJlcHJlc2VudGF0aW9uIH0gPSBpbmZvO1xuICAgIGNvbnN0IHNpemUgPSBnZXRJbnRTaXplKHNpbXBsZVR5cGUpO1xuICAgIGlmICh1bml0cykge1xuICAgICAgY29udmVydGVycy5wdXNoKHVuaXRDb252ZXJ0ZXIodW5pdHMpKTtcbiAgICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ3VuaXQnLCB1bml0cywgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gICAgfVxuICAgIHByZWNpc2lvbiAmJiBjb252ZXJ0ZXJzLnB1c2gocHJlY2lzaW9uQ29udmVydGVyKHByZWNpc2lvbikpO1xuICAgIGlmIChlbnVtZXJhdGlvbikge1xuICAgICAgY29udmVydGVycy5wdXNoKGVudW1lcmF0aW9uQ29udmVydGVyKGVudW1lcmF0aW9uKSk7XG4gICAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdlbnVtJywgT2JqZWN0LmVudHJpZXMoZW51bWVyYXRpb24pXG4gICAgICAgIC5tYXAoKFtrZXksIHZhbF0pID0+IFtcbiAgICAgICAgICB2YWwhLmFubm90YXRpb24sXG4gICAgICAgICAgdG9JbnQoa2V5KSxcbiAgICAgICAgXSksIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICAgIH1cbiAgICByZXByZXNlbnRhdGlvbiAmJiBzaXplICYmIGNvbnZlcnRlcnMucHVzaChyZXByZXNlbnRhdGlvbkNvbnZlcnRlcihyZXByZXNlbnRhdGlvbiwgc2l6ZSkpO1xuICB9XG5cbiAgaWYgKHByb3AudHlwZSA9PT0gJ3ZlcnNpb25UeXBlJykge1xuICAgIGNvbnZlcnRlcnMucHVzaCh2ZXJzaW9uVHlwZUNvbnZlcnRlcik7XG4gIH1cbiAgaWYgKHNpbXBsZVR5cGUgPT09ICd4czpib29sZWFuJyAmJiAhZW51bWVyYXRpb24pIHtcbiAgICBjb252ZXJ0ZXJzLnB1c2goYm9vbGVhbkNvbnZlcnRlcik7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnZW51bScsIFtbJ9CU0LAnLCB0cnVlXSwgWyfQndC10YInLCBmYWxzZV1dLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgfVxuICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdpc1dyaXRhYmxlJywgaXNXcml0YWJsZSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2lzUmVhZGFibGUnLCBpc1JlYWRhYmxlLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgndHlwZScsIHByb3AudHlwZSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ3NpbXBsZVR5cGUnLCBzaW1wbGVUeXBlLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YShcbiAgICAnZGlzcGxheU5hbWUnLFxuICAgIHByb3AuYW5ub3RhdGlvbiA/IHByb3AuYW5ub3RhdGlvbiA6IG5hbWUsXG4gICAgdGFyZ2V0LFxuICAgIHByb3BlcnR5S2V5LFxuICApO1xuICBhcHBpbmZvLmNhdGVnb3J5ICYmIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2NhdGVnb3J5JywgYXBwaW5mby5jYXRlZ29yeSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ25tc1R5cGUnLCBnZXRObXNUeXBlKHNpbXBsZVR5cGUpLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgY29uc3QgYXR0cmlidXRlczogSVByb3BlcnR5RGVzY3JpcHRvcjxEZXZpY2VQcm90b3R5cGU+ID0ge1xuICAgIGVudW1lcmFibGU6IGlzUmVhZGFibGUsXG4gIH07XG4gIGNvbnN0IHRvID0gY29udmVydFRvKGNvbnZlcnRlcnMpO1xuICBjb25zdCBmcm9tID0gY29udmVydEZyb20oY29udmVydGVycyk7XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2NvbnZlcnRUbycsIHRvLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnY29udmVydEZyb20nLCBmcm9tLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgYXR0cmlidXRlcy5nZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgY29uc29sZS5hc3NlcnQoUmVmbGVjdC5nZXQodGhpcywgJyRjb3VudFJlZicpID4gMCwgJ0RldmljZSB3YXMgcmVsZWFzZWQnKTtcbiAgICBsZXQgdmFsdWU7XG4gICAgaWYgKCF0aGlzLmdldEVycm9yKGlkKSkge1xuICAgICAgdmFsdWUgPSB0byh0aGlzLmdldFJhd1ZhbHVlKGlkKSk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcbiAgaWYgKGlzV3JpdGFibGUpIHtcbiAgICBhdHRyaWJ1dGVzLnNldCA9IGZ1bmN0aW9uIChuZXdWYWx1ZTogYW55KSB7XG4gICAgICBjb25zb2xlLmFzc2VydChSZWZsZWN0LmdldCh0aGlzLCAnJGNvdW50UmVmJykgPiAwLCAnRGV2aWNlIHdhcyByZWxlYXNlZCcpO1xuICAgICAgY29uc3QgdmFsdWUgPSBmcm9tKG5ld1ZhbHVlKTtcbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IE51bWJlci5pc05hTih2YWx1ZSBhcyBudW1iZXIpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB2YWx1ZTogJHtKU09OLnN0cmluZ2lmeShuZXdWYWx1ZSl9YCk7XG4gICAgICB9XG4gICAgICB0aGlzLnNldFJhd1ZhbHVlKGlkLCB2YWx1ZSk7XG4gICAgfTtcbiAgfVxuICBSZWZsZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgcHJvcGVydHlLZXksIGF0dHJpYnV0ZXMpO1xuICByZXR1cm4gW2lkLCBwcm9wZXJ0eUtleV07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRNaWJGaWxlKG1pYm5hbWU6IHN0cmluZykge1xuICByZXR1cm4gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL21pYnMvJywgYCR7bWlibmFtZX0ubWliLmpzb25gKTtcbn1cblxuY2xhc3MgRGV2aWNlUHJvdG90eXBlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIGltcGxlbWVudHMgSURldmljZSB7XG4gIC8vIHdpbGwgYmUgb3ZlcnJpZGUgZm9yIGFuIGluc3RhbmNlXG4gICRjb3VudFJlZiA9IDE7XG5cbiAgLy8gcHJpdmF0ZSAkZGVib3VuY2VEcmFpbiA9IF8uZGVib3VuY2UodGhpcy5kcmFpbiwgMjUpO1xuXG4gIGNvbnN0cnVjdG9yKG1pYm5hbWU6IHN0cmluZykge1xuICAgIHN1cGVyKCk7XG4gICAgY29uc3QgbWliZmlsZSA9IGdldE1pYkZpbGUobWlibmFtZSk7XG4gICAgY29uc3QgbWliVmFsaWRhdGlvbiA9IE1pYkRldmljZVYuZGVjb2RlKHJlcXVpcmUobWliZmlsZSkpO1xuICAgIGlmIChtaWJWYWxpZGF0aW9uLmlzTGVmdCgpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgbWliIGZpbGUgJHttaWJmaWxlfSAke1BhdGhSZXBvcnRlci5yZXBvcnQobWliVmFsaWRhdGlvbil9YCk7XG4gICAgfVxuICAgIGNvbnN0IG1pYiA9IG1pYlZhbGlkYXRpb24udmFsdWU7XG4gICAgY29uc3QgeyB0eXBlcywgc3Vicm91dGluZXMgfSA9IG1pYjtcbiAgICBjb25zdCBkZXZpY2UgPSB0eXBlc1ttaWIuZGV2aWNlXSBhcyBJTWliRGV2aWNlVHlwZTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtaWInLCBtaWJuYW1lLCB0aGlzKTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtaWJmaWxlJywgbWliZmlsZSwgdGhpcyk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnYW5ub3RhdGlvbicsIGRldmljZS5hbm5vdGF0aW9uLCB0aGlzKTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtaWJWZXJzaW9uJywgZGV2aWNlLmFwcGluZm8ubWliX3ZlcnNpb24sIHRoaXMpO1xuICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2RldmljZVR5cGUnLCB0b0ludChkZXZpY2UuYXBwaW5mby5kZXZpY2VfdHlwZSksIHRoaXMpO1xuICAgIGRldmljZS5hcHBpbmZvLmxvYWRlcl90eXBlICYmIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2xvYWRlclR5cGUnLFxuICAgICAgdG9JbnQoZGV2aWNlLmFwcGluZm8ubG9hZGVyX3R5cGUpLCB0aGlzLFxuICAgICk7XG4gICAgZGV2aWNlLmFwcGluZm8uZmlybXdhcmUgJiYgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnZmlybXdhcmUnLFxuICAgICAgZGV2aWNlLmFwcGluZm8uZmlybXdhcmUsIHRoaXMsXG4gICAgKTtcbiAgICBkZXZpY2UuYXBwaW5mby5taW5fdmVyc2lvbiAmJiBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtaW5fdmVyc2lvbicsXG4gICAgICBkZXZpY2UuYXBwaW5mby5taW5fdmVyc2lvbiwgdGhpcyxcbiAgICApO1xuICAgIHR5cGVzLmVycm9yVHlwZSAmJiBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKFxuICAgICAgJ2Vycm9yVHlwZScsICh0eXBlcy5lcnJvclR5cGUgYXMgSU1pYlR5cGUpLmVudW1lcmF0aW9uLCB0aGlzKTtcblxuICAgIGlmIChzdWJyb3V0aW5lcykge1xuICAgICAgY29uc3QgbWV0YXN1YnMgPSBfLnRyYW5zZm9ybShcbiAgICAgICAgc3Vicm91dGluZXMsXG4gICAgICAgIChyZXN1bHQsIHN1YiwgbmFtZSkgPT4ge1xuICAgICAgICAgIHJlc3VsdFtuYW1lXSA9IHtcbiAgICAgICAgICAgIGlkOiB0b0ludChzdWIuYXBwaW5mby5ubXNfaWQpLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IHN1Yi5hbm5vdGF0aW9uLFxuICAgICAgICAgICAgYXJnczogc3ViLnByb3BlcnRpZXMgJiYgT2JqZWN0LmVudHJpZXMoc3ViLnByb3BlcnRpZXMpXG4gICAgICAgICAgICAgIC5tYXAoKFtuYW1lLCBwcm9wXSkgPT4gKHtcbiAgICAgICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgICAgIHR5cGU6IGdldE5tc1R5cGUocHJvcC50eXBlKSxcbiAgICAgICAgICAgICAgICBkZXNjOiBwcm9wLmFubm90YXRpb24sXG4gICAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICB9O1xuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0sXG4gICAgICAgIHt9IGFzIFJlY29yZDxzdHJpbmcsIElTdWJyb3V0aW5lRGVzYz4sXG4gICAgICApO1xuICAgICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnc3Vicm91dGluZXMnLCBtZXRhc3VicywgdGhpcyk7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogY2F0ZWdvcnlcbiAgICAvLyBjb25zdCBtaWJDYXRlZ29yeSA9IF8uZmluZChkZXRlY3Rvci5kZXRlY3Rpb24hLm1pYkNhdGVnb3JpZXMsIHsgbWliOiBtaWJuYW1lIH0pO1xuICAgIC8vIGlmIChtaWJDYXRlZ29yeSkge1xuICAgIC8vICAgY29uc3QgeyBjYXRlZ29yeSwgZGlzYWJsZUJhdGNoUmVhZGluZyB9ID0gbWliQ2F0ZWdvcnk7XG4gICAgLy8gICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdjYXRlZ29yeScsIGNhdGVnb3J5LCB0aGlzKTtcbiAgICAvLyAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2Rpc2FibGVCYXRjaFJlYWRpbmcnLCAhIWRpc2FibGVCYXRjaFJlYWRpbmcsIHRoaXMpO1xuICAgIC8vIH1cblxuICAgIGNvbnN0IGtleXMgPSBSZWZsZWN0Lm93bktleXMoZGV2aWNlLnByb3BlcnRpZXMpIGFzIHN0cmluZ1tdO1xuICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ21pYlByb3BlcnRpZXMnLCBrZXlzLm1hcCh2YWxpZEpzTmFtZSksIHRoaXMpO1xuICAgIGNvbnN0IG1hcDogeyBbaWQ6IG51bWJlcl06IHN0cmluZ1tdIH0gPSB7fTtcbiAgICBrZXlzLmZvckVhY2goKGtleTogc3RyaW5nKSA9PiB7XG4gICAgICBjb25zdCBbaWQsIHByb3BOYW1lXSA9IGRlZmluZU1pYlByb3BlcnR5KHRoaXMsIGtleSwgdHlwZXMsIGRldmljZS5wcm9wZXJ0aWVzW2tleV0pO1xuICAgICAgaWYgKCFtYXBbaWRdKSB7XG4gICAgICAgIG1hcFtpZF0gPSBbcHJvcE5hbWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWFwW2lkXS5wdXNoKHByb3BOYW1lKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtYXAnLCBtYXAsIHRoaXMpO1xuICB9XG5cbiAgcHVibGljIGdldCBjb25uZWN0aW9uKCk6IE5pYnVzQ29ubmVjdGlvbiB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgeyBbJHZhbHVlc106IHZhbHVlcyB9ID0gdGhpcztcbiAgICByZXR1cm4gdmFsdWVzW1ByaXZhdGVQcm9wcy5jb25uZWN0aW9uXTtcbiAgfVxuXG4gIHB1YmxpYyBzZXQgY29ubmVjdGlvbih2YWx1ZTogTmlidXNDb25uZWN0aW9uIHwgdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgeyBbJHZhbHVlc106IHZhbHVlcyB9ID0gdGhpcztcbiAgICBjb25zdCBwcmV2ID0gdmFsdWVzW1ByaXZhdGVQcm9wcy5jb25uZWN0aW9uXTtcbiAgICBpZiAocHJldiA9PT0gdmFsdWUpIHJldHVybjtcbiAgICB2YWx1ZXNbUHJpdmF0ZVByb3BzLmNvbm5lY3Rpb25dID0gdmFsdWU7XG4gICAgLyoqXG4gICAgICogRGV2aWNlIGNvbm5lY3RlZCBldmVudFxuICAgICAqIEBldmVudCBJRGV2aWNlI2Nvbm5lY3RlZFxuICAgICAqIEBldmVudCBJRGV2aWNlI2Rpc2Nvbm5lY3RlZFxuICAgICAqL1xuICAgIHRoaXMuZW1pdCh2YWx1ZSAhPSBudWxsID8gJ2Nvbm5lY3RlZCcgOiAnZGlzY29ubmVjdGVkJyk7XG4gICAgLy8gaWYgKHZhbHVlKSB7XG4gICAgLy8gICB0aGlzLmRyYWluKCkuY2F0Y2goKCkgPT4ge30pO1xuICAgIC8vIH1cbiAgfVxuXG4gIC8vIG5vaW5zcGVjdGlvbiBKU1VudXNlZEdsb2JhbFN5bWJvbHNcbiAgcHVibGljIHRvSlNPTigpOiBhbnkge1xuICAgIGNvbnN0IGpzb246IGFueSA9IHtcbiAgICAgIG1pYjogUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWliJywgdGhpcyksXG4gICAgfTtcbiAgICBjb25zdCBrZXlzOiBzdHJpbmdbXSA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21pYlByb3BlcnRpZXMnLCB0aGlzKTtcbiAgICBrZXlzLmZvckVhY2goKGtleSkgPT4ge1xuICAgICAgaWYgKHRoaXNba2V5XSAhPT0gdW5kZWZpbmVkKSBqc29uW2tleV0gPSB0aGlzW2tleV07XG4gICAgfSk7XG4gICAganNvbi5hZGRyZXNzID0gdGhpcy5hZGRyZXNzLnRvU3RyaW5nKCk7XG4gICAgcmV0dXJuIGpzb247XG4gIH1cblxuICBwdWJsaWMgZ2V0SWQoaWRPck5hbWU6IHN0cmluZyB8IG51bWJlcik6IG51bWJlciB7XG4gICAgbGV0IGlkOiBudW1iZXI7XG4gICAgaWYgKHR5cGVvZiBpZE9yTmFtZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGlkID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnaWQnLCB0aGlzLCBpZE9yTmFtZSk7XG4gICAgICBpZiAoTnVtYmVyLmlzSW50ZWdlcihpZCkpIHJldHVybiBpZDtcbiAgICAgIGlkID0gdG9JbnQoaWRPck5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZCA9IGlkT3JOYW1lO1xuICAgIH1cbiAgICBjb25zdCBtYXAgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBpZiAoIVJlZmxlY3QuaGFzKG1hcCwgaWQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gcHJvcGVydHkgJHtpZE9yTmFtZX1gKTtcbiAgICB9XG4gICAgcmV0dXJuIGlkO1xuICB9XG5cbiAgcHVibGljIGdldE5hbWUoaWRPck5hbWU6IHN0cmluZyB8IG51bWJlcik6IHN0cmluZyB7XG4gICAgY29uc3QgbWFwID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWFwJywgdGhpcyk7XG4gICAgaWYgKFJlZmxlY3QuaGFzKG1hcCwgaWRPck5hbWUpKSB7XG4gICAgICByZXR1cm4gbWFwW2lkT3JOYW1lXVswXTtcbiAgICB9XG4gICAgY29uc3Qga2V5czogc3RyaW5nW10gPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtaWJQcm9wZXJ0aWVzJywgdGhpcyk7XG4gICAgaWYgKHR5cGVvZiBpZE9yTmFtZSA9PT0gJ3N0cmluZycgJiYga2V5cy5pbmNsdWRlcyhpZE9yTmFtZSkpIHJldHVybiBpZE9yTmFtZTtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gcHJvcGVydHkgJHtpZE9yTmFtZX1gKTtcbiAgfVxuXG4gIC8qXG4gICAgcHVibGljIHRvSWRzKGlkc09yTmFtZXM6IChzdHJpbmcgfCBudW1iZXIpW10pOiBudW1iZXJbXSB7XG4gICAgICBjb25zdCBtYXAgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICAgIHJldHVybiBpZHNPck5hbWVzLm1hcCgoaWRPck5hbWUpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBpZE9yTmFtZSA9PT0gJ3N0cmluZycpXG4gICAgICB9KTtcbiAgICB9XG4gICovXG4gIHB1YmxpYyBnZXRSYXdWYWx1ZShpZE9yTmFtZTogbnVtYmVyIHwgc3RyaW5nKTogYW55IHtcbiAgICBjb25zdCBpZCA9IHRoaXMuZ2V0SWQoaWRPck5hbWUpO1xuICAgIGNvbnN0IHsgWyR2YWx1ZXNdOiB2YWx1ZXMgfSA9IHRoaXM7XG4gICAgcmV0dXJuIHZhbHVlc1tpZF07XG4gIH1cblxuICBwdWJsaWMgc2V0UmF3VmFsdWUoaWRPck5hbWU6IG51bWJlciB8IHN0cmluZywgdmFsdWU6IGFueSwgaXNEaXJ0eSA9IHRydWUpIHtcbiAgICAvLyBkZWJ1Zyhgc2V0UmF3VmFsdWUoJHtpZE9yTmFtZX0sICR7SlNPTi5zdHJpbmdpZnkoc2FmZU51bWJlcih2YWx1ZSkpfSlgKTtcbiAgICBjb25zdCBpZCA9IHRoaXMuZ2V0SWQoaWRPck5hbWUpO1xuICAgIGNvbnN0IHsgWyR2YWx1ZXNdOiB2YWx1ZXMsIFskZXJyb3JzXTogZXJyb3JzIH0gPSB0aGlzO1xuICAgIHZhbHVlc1tpZF0gPSBzYWZlTnVtYmVyKHZhbHVlKTtcbiAgICBkZWxldGUgZXJyb3JzW2lkXTtcbiAgICB0aGlzLnNldERpcnR5KGlkLCBpc0RpcnR5KTtcbiAgfVxuXG4gIHB1YmxpYyBnZXRFcnJvcihpZE9yTmFtZTogbnVtYmVyIHwgc3RyaW5nKTogYW55IHtcbiAgICBjb25zdCBpZCA9IHRoaXMuZ2V0SWQoaWRPck5hbWUpO1xuICAgIGNvbnN0IHsgWyRlcnJvcnNdOiBlcnJvcnMgfSA9IHRoaXM7XG4gICAgcmV0dXJuIGVycm9yc1tpZF07XG4gIH1cblxuICBwdWJsaWMgc2V0RXJyb3IoaWRPck5hbWU6IG51bWJlciB8IHN0cmluZywgZXJyb3I/OiBFcnJvcikge1xuICAgIGNvbnN0IGlkID0gdGhpcy5nZXRJZChpZE9yTmFtZSk7XG4gICAgY29uc3QgeyBbJGVycm9yc106IGVycm9ycyB9ID0gdGhpcztcbiAgICBpZiAoZXJyb3IgIT0gbnVsbCkge1xuICAgICAgZXJyb3JzW2lkXSA9IGVycm9yO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgZXJyb3JzW2lkXTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgaXNEaXJ0eShpZE9yTmFtZTogc3RyaW5nIHwgbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgY29uc3QgaWQgPSB0aGlzLmdldElkKGlkT3JOYW1lKTtcbiAgICBjb25zdCB7IFskZGlydGllc106IGRpcnRpZXMgfSA9IHRoaXM7XG4gICAgcmV0dXJuICEhZGlydGllc1tpZF07XG4gIH1cblxuICBwdWJsaWMgc2V0RGlydHkoaWRPck5hbWU6IHN0cmluZyB8IG51bWJlciwgaXNEaXJ0eSA9IHRydWUpIHtcbiAgICBjb25zdCBpZCA9IHRoaXMuZ2V0SWQoaWRPck5hbWUpO1xuICAgIGNvbnN0IG1hcDogeyBbaWQ6IG51bWJlcl06IHN0cmluZ1tdIH0gPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBjb25zdCB7IFskZGlydGllc106IGRpcnRpZXMgfSA9IHRoaXM7XG4gICAgaWYgKGlzRGlydHkpIHtcbiAgICAgIGRpcnRpZXNbaWRdID0gdHJ1ZTtcbiAgICAgIC8vIFRPRE86IGltcGxlbWVudCBhdXRvc2F2ZVxuICAgICAgLy8gdGhpcy53cml0ZShpZCkuY2F0Y2goKCkgPT4ge30pO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgZGlydGllc1tpZF07XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEBldmVudCBJRGV2aWNlI2NoYW5nZWRcbiAgICAgKiBAZXZlbnQgSURldmljZSNjaGFuZ2luZ1xuICAgICAqL1xuICAgIGNvbnN0IG5hbWVzID0gbWFwW2lkXSB8fCBbXTtcbiAgICB0aGlzLmVtaXQoXG4gICAgICBpc0RpcnR5ID8gJ2NoYW5naW5nJyA6ICdjaGFuZ2VkJyxcbiAgICAgIHtcbiAgICAgICAgaWQsXG4gICAgICAgIG5hbWVzLFxuICAgICAgfSxcbiAgICApO1xuICB9XG5cbiAgcHVibGljIGFkZHJlZigpIHtcbiAgICB0aGlzLiRjb3VudFJlZiArPSAxO1xuICAgIGRlYnVnKCdhZGRyZWYnLCBuZXcgRXJyb3IoJ2FkZHJlZicpLnN0YWNrKTtcbiAgICByZXR1cm4gdGhpcy4kY291bnRSZWY7XG4gIH1cblxuICBwdWJsaWMgcmVsZWFzZSgpIHtcbiAgICB0aGlzLiRjb3VudFJlZiAtPSAxO1xuICAgIGlmICh0aGlzLiRjb3VudFJlZiA8PSAwKSB7XG4gICAgICBkZWxldGUgZGV2aWNlTWFwW3RoaXMuYWRkcmVzcy50b1N0cmluZygpXTtcbiAgICAgIC8qKlxuICAgICAgICogQGV2ZW50IERldmljZXMjZGVsZXRlXG4gICAgICAgKi9cbiAgICAgIGRldmljZXMuZW1pdCgnZGVsZXRlJywgdGhpcyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLiRjb3VudFJlZjtcbiAgfVxuXG4gIHB1YmxpYyBkcmFpbigpOiBQcm9taXNlPG51bWJlcltdPiB7XG4gICAgZGVidWcoYGRyYWluIFske3RoaXMuYWRkcmVzc31dYCk7XG4gICAgY29uc3QgeyBbJGRpcnRpZXNdOiBkaXJ0aWVzIH0gPSB0aGlzO1xuICAgIGNvbnN0IGlkcyA9IE9iamVjdC5rZXlzKGRpcnRpZXMpLm1hcChOdW1iZXIpLmZpbHRlcihpZCA9PiBkaXJ0aWVzW2lkXSk7XG4gICAgcmV0dXJuIGlkcy5sZW5ndGggPiAwID8gdGhpcy53cml0ZSguLi5pZHMpLmNhdGNoKCgpID0+IFtdKSA6IFByb21pc2UucmVzb2x2ZShbXSk7XG4gIH1cblxuICBwcml2YXRlIHdyaXRlQWxsKCkge1xuICAgIGNvbnN0IHsgWyR2YWx1ZXNdOiB2YWx1ZXMgfSA9IHRoaXM7XG4gICAgY29uc3QgbWFwID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWFwJywgdGhpcyk7XG4gICAgY29uc3QgaWRzID0gT2JqZWN0LmVudHJpZXModmFsdWVzKVxuICAgICAgLmZpbHRlcigoWywgdmFsdWVdKSA9PiB2YWx1ZSAhPSBudWxsKVxuICAgICAgLm1hcCgoW2lkXSkgPT4gTnVtYmVyKGlkKSlcbiAgICAgIC5maWx0ZXIoKGlkID0+IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ2lzV3JpdGFibGUnLCB0aGlzLCBtYXBbaWRdWzBdKSkpO1xuICAgIHJldHVybiBpZHMubGVuZ3RoID4gMCA/IHRoaXMud3JpdGUoLi4uaWRzKSA6IFByb21pc2UucmVzb2x2ZShbXSk7XG4gIH1cblxuICBwdWJsaWMgd3JpdGUoLi4uaWRzOiBudW1iZXJbXSk6IFByb21pc2U8bnVtYmVyW10+IHtcbiAgICBjb25zdCB7IGNvbm5lY3Rpb24gfSA9IHRoaXM7XG4gICAgaWYgKCFjb25uZWN0aW9uKSByZXR1cm4gUHJvbWlzZS5yZWplY3QoYCR7dGhpcy5hZGRyZXNzfSBpcyBkaXNjb25uZWN0ZWRgKTtcbiAgICBpZiAoaWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRoaXMud3JpdGVBbGwoKTtcbiAgICB9XG4gICAgZGVidWcoYHdyaXRpbmcgJHtpZHMuam9pbigpfSB0byBbJHt0aGlzLmFkZHJlc3N9XWApO1xuICAgIGNvbnN0IG1hcCA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21hcCcsIHRoaXMpO1xuICAgIGNvbnN0IHJlcXVlc3RzID0gaWRzLnJlZHVjZShcbiAgICAgIChhY2M6IE5tc0RhdGFncmFtW10sIGlkKSA9PiB7XG4gICAgICAgIGNvbnN0IFtuYW1lXSA9IG1hcFtpZF07XG4gICAgICAgIGlmICghbmFtZSkge1xuICAgICAgICAgIGRlYnVnKGBVbmtub3duIGlkOiAke2lkfSBmb3IgJHtSZWZsZWN0LmdldE1ldGFkYXRhKCdtaWInLCB0aGlzKX1gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhY2MucHVzaChjcmVhdGVObXNXcml0ZShcbiAgICAgICAgICAgIHRoaXMuYWRkcmVzcyxcbiAgICAgICAgICAgIGlkLFxuICAgICAgICAgICAgUmVmbGVjdC5nZXRNZXRhZGF0YSgnbm1zVHlwZScsIHRoaXMsIG5hbWUpLFxuICAgICAgICAgICAgdGhpcy5nZXRSYXdWYWx1ZShpZCksXG4gICAgICAgICAgKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgIH0sXG4gICAgICBbXSxcbiAgICApO1xuICAgIHJldHVybiBQcm9taXNlLmFsbChcbiAgICAgIHJlcXVlc3RzXG4gICAgICAgIC5tYXAoZGF0YWdyYW0gPT4gY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0oZGF0YWdyYW0pXG4gICAgICAgICAgLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB7IHN0YXR1cyB9ID0gcmVzcG9uc2UgYXMgTm1zRGF0YWdyYW07XG4gICAgICAgICAgICBpZiAoc3RhdHVzID09PSAwKSB7XG4gICAgICAgICAgICAgIHRoaXMuc2V0RGlydHkoZGF0YWdyYW0uaWQsIGZhbHNlKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGRhdGFncmFtLmlkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zZXRFcnJvcihkYXRhZ3JhbS5pZCwgbmV3IE5pYnVzRXJyb3Ioc3RhdHVzISwgdGhpcykpO1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgIH0sIChyZWFzb24pID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0RXJyb3IoZGF0YWdyYW0uaWQsIHJlYXNvbik7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgfSkpKVxuICAgICAgLnRoZW4oaWRzID0+IGlkcy5maWx0ZXIoaWQgPT4gaWQgPiAwKSk7XG4gIH1cblxuICBwdWJsaWMgd3JpdGVWYWx1ZXMoc291cmNlOiBvYmplY3QsIHN0cm9uZyA9IHRydWUpOiBQcm9taXNlPG51bWJlcltdPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGlkcyA9IE9iamVjdC5rZXlzKHNvdXJjZSkubWFwKG5hbWUgPT4gdGhpcy5nZXRJZChuYW1lKSk7XG4gICAgICBpZiAoaWRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBUeXBlRXJyb3IoJ3ZhbHVlIGlzIGVtcHR5JykpO1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLCBzb3VyY2UpO1xuICAgICAgcmV0dXJuIHRoaXMud3JpdGUoLi4uaWRzKVxuICAgICAgICAudGhlbigod3JpdHRlbikgPT4ge1xuICAgICAgICAgIGlmICh3cml0dGVuLmxlbmd0aCA9PT0gMCB8fCAoc3Ryb25nICYmIHdyaXR0ZW4ubGVuZ3RoICE9PSBpZHMubGVuZ3RoKSkge1xuICAgICAgICAgICAgdGhyb3cgdGhpcy5nZXRFcnJvcihpZHNbMF0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gd3JpdHRlbjtcbiAgICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHJlYWRBbGwoKTogUHJvbWlzZTxhbnk+IHtcbiAgICBpZiAodGhpcy4kcmVhZCkgcmV0dXJuIHRoaXMuJHJlYWQ7XG4gICAgY29uc3QgbWFwOiB7IFtpZDogc3RyaW5nXTogc3RyaW5nW10gfSA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21hcCcsIHRoaXMpO1xuICAgIGNvbnN0IGlkcyA9IE9iamVjdC5lbnRyaWVzKG1hcClcbiAgICAgIC5maWx0ZXIoKFssIG5hbWVzXSkgPT4gUmVmbGVjdC5nZXRNZXRhZGF0YSgnaXNSZWFkYWJsZScsIHRoaXMsIG5hbWVzWzBdKSlcbiAgICAgIC5tYXAoKFtpZF0pID0+IE51bWJlcihpZCkpXG4gICAgICAuc29ydCgpO1xuICAgIHRoaXMuJHJlYWQgPSBpZHMubGVuZ3RoID4gMCA/IHRoaXMucmVhZCguLi5pZHMpIDogUHJvbWlzZS5yZXNvbHZlKFtdKTtcbiAgICBjb25zdCBjbGVhciA9ICgpID0+IGRlbGV0ZSB0aGlzLiRyZWFkO1xuICAgIHJldHVybiB0aGlzLiRyZWFkLmZpbmFsbHkoY2xlYXIpO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIHJlYWQoLi4uaWRzOiBudW1iZXJbXSk6IFByb21pc2U8eyBbbmFtZTogc3RyaW5nXTogYW55IH0+IHtcbiAgICBjb25zdCB7IGNvbm5lY3Rpb24gfSA9IHRoaXM7XG4gICAgaWYgKCFjb25uZWN0aW9uKSByZXR1cm4gUHJvbWlzZS5yZWplY3QoJ2Rpc2Nvbm5lY3RlZCcpO1xuICAgIGlmIChpZHMubGVuZ3RoID09PSAwKSByZXR1cm4gdGhpcy5yZWFkQWxsKCk7XG4gICAgLy8gZGVidWcoYHJlYWQgJHtpZHMuam9pbigpfSBmcm9tIFske3RoaXMuYWRkcmVzc31dYCk7XG4gICAgY29uc3QgZGlzYWJsZUJhdGNoUmVhZGluZyA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ2Rpc2FibGVCYXRjaFJlYWRpbmcnLCB0aGlzKTtcbiAgICBjb25zdCBtYXA6IHsgW2lkOiBzdHJpbmddOiBzdHJpbmdbXSB9ID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWFwJywgdGhpcyk7XG4gICAgY29uc3QgY2h1bmtzID0gY2h1bmtBcnJheShpZHMsIGRpc2FibGVCYXRjaFJlYWRpbmcgPyAxIDogMjEpO1xuICAgIGRlYnVnKGByZWFkIFske2NodW5rcy5tYXAoY2h1bmsgPT4gYFske2NodW5rLmpvaW4oKX1dYCkuam9pbigpfV0gZnJvbSBbJHt0aGlzLmFkZHJlc3N9XWApO1xuICAgIGNvbnN0IHJlcXVlc3RzID0gY2h1bmtzLm1hcChjaHVuayA9PiBjcmVhdGVObXNSZWFkKHRoaXMuYWRkcmVzcywgLi4uY2h1bmspKTtcbiAgICByZXR1cm4gcmVxdWVzdHMucmVkdWNlKFxuICAgICAgYXN5bmMgKHByb21pc2UsIGRhdGFncmFtKSA9PiB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb21pc2U7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0oZGF0YWdyYW0pO1xuICAgICAgICBjb25zdCBkYXRhZ3JhbXM6IE5tc0RhdGFncmFtW10gPSBBcnJheS5pc0FycmF5KHJlc3BvbnNlKVxuICAgICAgICAgID8gcmVzcG9uc2UgYXMgTm1zRGF0YWdyYW1bXVxuICAgICAgICAgIDogW3Jlc3BvbnNlIGFzIE5tc0RhdGFncmFtXTtcbiAgICAgICAgZGF0YWdyYW1zLmZvckVhY2goKHsgaWQsIHZhbHVlLCBzdGF0dXMgfSkgPT4ge1xuICAgICAgICAgIGlmIChzdGF0dXMgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuc2V0UmF3VmFsdWUoaWQsIHZhbHVlLCBmYWxzZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc2V0RXJyb3IoaWQsIG5ldyBOaWJ1c0Vycm9yKHN0YXR1cyEsIHRoaXMpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgbmFtZXMgPSBtYXBbaWRdO1xuICAgICAgICAgIGNvbnNvbGUuYXNzZXJ0KG5hbWVzICYmIG5hbWVzLmxlbmd0aCA+IDAsIGBJbnZhbGlkIGlkICR7aWR9YCk7XG4gICAgICAgICAgbmFtZXMuZm9yRWFjaCgocHJvcE5hbWUpID0+IHtcbiAgICAgICAgICAgIHJlc3VsdFtwcm9wTmFtZV0gPSBzdGF0dXMgPT09IDBcbiAgICAgICAgICAgICAgPyB0aGlzW3Byb3BOYW1lXVxuICAgICAgICAgICAgICA6IHsgZXJyb3I6ICh0aGlzLmdldEVycm9yKGlkKSB8fCB7fSkubWVzc2FnZSB8fCAnZXJyb3InIH07XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSxcbiAgICAgIFByb21pc2UucmVzb2x2ZSh7fSBhcyB7IFtuYW1lOiBzdHJpbmddOiBhbnkgfSksXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHVwbG9hZChkb21haW46IHN0cmluZywgb2Zmc2V0ID0gMCwgc2l6ZT86IG51bWJlcik6IFByb21pc2U8QnVmZmVyPiB7XG4gICAgY29uc3QgeyBjb25uZWN0aW9uIH0gPSB0aGlzO1xuICAgIHRyeSB7XG4gICAgICBpZiAoIWNvbm5lY3Rpb24pIHRocm93IG5ldyBFcnJvcignZGlzY29ubmVjdGVkJyk7XG4gICAgICBjb25zdCByZXFVcGxvYWQgPSBjcmVhdGVObXNSZXF1ZXN0RG9tYWluVXBsb2FkKHRoaXMuYWRkcmVzcywgZG9tYWluLnBhZEVuZCg4LCAnXFwwJykpO1xuICAgICAgY29uc3QgeyBpZCwgdmFsdWU6IGRvbWFpblNpemUsIHN0YXR1cyB9ID1cbiAgICAgICAgYXdhaXQgY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0ocmVxVXBsb2FkKSBhcyBObXNEYXRhZ3JhbTtcbiAgICAgIGlmIChzdGF0dXMgIT09IDApIHtcbiAgICAgICAgLy8gZGVidWcoJzxlcnJvcj4nLCBzdGF0dXMpO1xuICAgICAgICB0aHJvdyBuZXcgTmlidXNFcnJvcihzdGF0dXMhLCB0aGlzLCAnUmVxdWVzdCB1cGxvYWQgZG9tYWluIGVycm9yJyk7XG4gICAgICB9XG4gICAgICBjb25zdCBpbml0VXBsb2FkID0gY3JlYXRlTm1zSW5pdGlhdGVVcGxvYWRTZXF1ZW5jZSh0aGlzLmFkZHJlc3MsIGlkKTtcbiAgICAgIGNvbnN0IHsgc3RhdHVzOiBpbml0U3RhdCB9ID0gYXdhaXQgY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0oaW5pdFVwbG9hZCkgYXMgTm1zRGF0YWdyYW07XG4gICAgICBpZiAoaW5pdFN0YXQgIT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IE5pYnVzRXJyb3IoaW5pdFN0YXQhLCB0aGlzLCAnSW5pdGlhdGUgdXBsb2FkIGRvbWFpbiBlcnJvcicpO1xuICAgICAgfVxuICAgICAgY29uc3QgdG90YWwgPSBzaXplIHx8IChkb21haW5TaXplIC0gb2Zmc2V0KTtcbiAgICAgIGxldCByZXN0ID0gdG90YWw7XG4gICAgICBsZXQgcG9zID0gb2Zmc2V0O1xuICAgICAgdGhpcy5lbWl0KFxuICAgICAgICAndXBsb2FkU3RhcnQnLFxuICAgICAgICB7XG4gICAgICAgICAgZG9tYWluLFxuICAgICAgICAgIGRvbWFpblNpemUsXG4gICAgICAgICAgb2Zmc2V0LFxuICAgICAgICAgIHNpemU6IHRvdGFsLFxuICAgICAgICB9LFxuICAgICAgKTtcbiAgICAgIGNvbnN0IGJ1ZnM6IEJ1ZmZlcltdID0gW107XG4gICAgICB3aGlsZSAocmVzdCA+IDApIHtcbiAgICAgICAgY29uc3QgbGVuZ3RoID0gTWF0aC5taW4oMjU1LCByZXN0KTtcbiAgICAgICAgY29uc3QgdXBsb2FkU2VnbWVudCA9IGNyZWF0ZU5tc1VwbG9hZFNlZ21lbnQodGhpcy5hZGRyZXNzLCBpZCwgcG9zLCBsZW5ndGgpO1xuICAgICAgICBjb25zdCB7IHN0YXR1czogdXBsb2FkU3RhdHVzLCB2YWx1ZTogcmVzdWx0IH0gPVxuICAgICAgICAgIGF3YWl0IGNvbm5lY3Rpb24uc2VuZERhdGFncmFtKHVwbG9hZFNlZ21lbnQpIGFzIE5tc0RhdGFncmFtO1xuICAgICAgICBpZiAodXBsb2FkU3RhdHVzICE9PSAwKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IE5pYnVzRXJyb3IodXBsb2FkU3RhdHVzISwgdGhpcywgJ1VwbG9hZCBzZWdtZW50IGVycm9yJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc3VsdC5kYXRhLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGJ1ZnMucHVzaChyZXN1bHQuZGF0YSk7XG4gICAgICAgIHRoaXMuZW1pdChcbiAgICAgICAgICAndXBsb2FkRGF0YScsXG4gICAgICAgICAge1xuICAgICAgICAgICAgZG9tYWluLFxuICAgICAgICAgICAgcG9zLFxuICAgICAgICAgICAgZGF0YTogcmVzdWx0LmRhdGEsXG4gICAgICAgICAgfSxcbiAgICAgICAgKTtcbiAgICAgICAgcmVzdCAtPSByZXN1bHQuZGF0YS5sZW5ndGg7XG4gICAgICAgIHBvcyArPSByZXN1bHQuZGF0YS5sZW5ndGg7XG4gICAgICB9XG4gICAgICBjb25zdCByZXN1bHQgPSBCdWZmZXIuY29uY2F0KGJ1ZnMpO1xuICAgICAgdGhpcy5lbWl0KFxuICAgICAgICAndXBsb2FkRmluaXNoJyxcbiAgICAgICAge1xuICAgICAgICAgIGRvbWFpbixcbiAgICAgICAgICBvZmZzZXQsXG4gICAgICAgICAgZGF0YTogcmVzdWx0LFxuICAgICAgICB9LFxuICAgICAgKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5lbWl0KCd1cGxvYWRFcnJvcicsIGUpO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBkb3dubG9hZChkb21haW46IHN0cmluZywgYnVmZmVyOiBCdWZmZXIsIG9mZnNldCA9IDAsIG5vVGVybSA9IGZhbHNlKSB7XG4gICAgY29uc3QgeyBjb25uZWN0aW9uIH0gPSB0aGlzO1xuICAgIGlmICghY29ubmVjdGlvbikgdGhyb3cgbmV3IEVycm9yKCdkaXNjb25uZWN0ZWQnKTtcbiAgICBjb25zdCByZXFEb3dubG9hZCA9IGNyZWF0ZU5tc1JlcXVlc3REb21haW5Eb3dubG9hZCh0aGlzLmFkZHJlc3MsIGRvbWFpbi5wYWRFbmQoOCwgJ1xcMCcpKTtcbiAgICBjb25zdCB7IGlkLCB2YWx1ZTogbWF4LCBzdGF0dXMgfSA9IGF3YWl0IGNvbm5lY3Rpb24uc2VuZERhdGFncmFtKHJlcURvd25sb2FkKSBhcyBObXNEYXRhZ3JhbTtcbiAgICBpZiAoc3RhdHVzICE9PSAwKSB7XG4gICAgICAvLyBkZWJ1ZygnPGVycm9yPicsIHN0YXR1cyk7XG4gICAgICB0aHJvdyBuZXcgTmlidXNFcnJvcihzdGF0dXMhLCB0aGlzLCAnUmVxdWVzdCBkb3dubG9hZCBkb21haW4gZXJyb3InKTtcbiAgICB9XG4gICAgY29uc3QgdGVybWluYXRlID0gYXN5bmMgKGVycj86IEVycm9yKSA9PiB7XG4gICAgICBsZXQgdGVybVN0YXQgPSAwO1xuICAgICAgaWYgKCFub1Rlcm0pIHtcbiAgICAgICAgY29uc3QgcmVxID0gY3JlYXRlTm1zVGVybWluYXRlRG93bmxvYWRTZXF1ZW5jZSh0aGlzLmFkZHJlc3MsIGlkKTtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0ocmVxKSBhcyBObXNEYXRhZ3JhbTtcbiAgICAgICAgdGVybVN0YXQgPSByZXMuc3RhdHVzITtcbiAgICAgIH1cbiAgICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICAgIGlmICh0ZXJtU3RhdCAhPT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgTmlidXNFcnJvcihcbiAgICAgICAgICB0ZXJtU3RhdCEsXG4gICAgICAgICAgdGhpcyxcbiAgICAgICAgICAnVGVybWluYXRlIGRvd25sb2FkIHNlcXVlbmNlIGVycm9yLCBtYXliZSBuZWVkIC0tbm8tdGVybScsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfTtcbiAgICBpZiAoYnVmZmVyLmxlbmd0aCA+IG1heCAtIG9mZnNldCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBCdWZmZXIgdG8gbGFyZ2UuIEV4cGVjdGVkICR7bWF4IC0gb2Zmc2V0fSBieXRlc2ApO1xuICAgIH1cbiAgICBjb25zdCBpbml0RG93bmxvYWQgPSBjcmVhdGVObXNJbml0aWF0ZURvd25sb2FkU2VxdWVuY2UodGhpcy5hZGRyZXNzLCBpZCk7XG4gICAgY29uc3QgeyBzdGF0dXM6IGluaXRTdGF0IH0gPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShpbml0RG93bmxvYWQpIGFzIE5tc0RhdGFncmFtO1xuICAgIGlmIChpbml0U3RhdCAhPT0gMCkge1xuICAgICAgdGhyb3cgbmV3IE5pYnVzRXJyb3IoaW5pdFN0YXQhLCB0aGlzLCAnSW5pdGlhdGUgZG93bmxvYWQgZG9tYWluIGVycm9yJyk7XG4gICAgfVxuICAgIHRoaXMuZW1pdChcbiAgICAgICdkb3dubG9hZFN0YXJ0JyxcbiAgICAgIHtcbiAgICAgICAgZG9tYWluLFxuICAgICAgICBvZmZzZXQsXG4gICAgICAgIGRvbWFpblNpemU6IG1heCxcbiAgICAgICAgc2l6ZTogYnVmZmVyLmxlbmd0aCxcbiAgICAgIH0sXG4gICAgKTtcbiAgICBjb25zdCBjcmMgPSBjcmMxNmNjaXR0KGJ1ZmZlciwgMCk7XG4gICAgY29uc3QgY2h1bmtTaXplID0gTk1TX01BWF9EQVRBX0xFTkdUSCAtIDQ7XG4gICAgY29uc3QgY2h1bmtzID0gY2h1bmtBcnJheShidWZmZXIsIGNodW5rU2l6ZSk7XG4gICAgYXdhaXQgY2h1bmtzLnJlZHVjZShhc3luYyAocHJldiwgY2h1bms6IEJ1ZmZlciwgaSkgPT4ge1xuICAgICAgYXdhaXQgcHJldjtcbiAgICAgIGNvbnN0IHBvcyA9IGkgKiBjaHVua1NpemUgKyBvZmZzZXQ7XG4gICAgICBjb25zdCBzZWdtZW50RG93bmxvYWQgPVxuICAgICAgICBjcmVhdGVObXNEb3dubG9hZFNlZ21lbnQodGhpcy5hZGRyZXNzLCBpZCEsIHBvcywgY2h1bmspO1xuICAgICAgY29uc3QgeyBzdGF0dXM6IGRvd25sb2FkU3RhdCB9ID1cbiAgICAgICAgYXdhaXQgY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0oc2VnbWVudERvd25sb2FkKSBhcyBObXNEYXRhZ3JhbTtcbiAgICAgIGlmIChkb3dubG9hZFN0YXQgIT09IDApIHtcbiAgICAgICAgYXdhaXQgdGVybWluYXRlKG5ldyBOaWJ1c0Vycm9yKGRvd25sb2FkU3RhdCEsIHRoaXMsICdEb3dubG9hZCBzZWdtZW50IGVycm9yJykpO1xuICAgICAgfVxuICAgICAgdGhpcy5lbWl0KFxuICAgICAgICAnZG93bmxvYWREYXRhJyxcbiAgICAgICAge1xuICAgICAgICAgIGRvbWFpbixcbiAgICAgICAgICBsZW5ndGg6IGNodW5rLmxlbmd0aCxcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgfSwgUHJvbWlzZS5yZXNvbHZlKCkpO1xuICAgIGNvbnN0IHZlcmlmeSA9IGNyZWF0ZU5tc1ZlcmlmeURvbWFpbkNoZWNrc3VtKHRoaXMuYWRkcmVzcywgaWQsIG9mZnNldCwgYnVmZmVyLmxlbmd0aCwgY3JjKTtcbiAgICBjb25zdCB7IHN0YXR1czogdmVyaWZ5U3RhdCB9ID0gYXdhaXQgY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0odmVyaWZ5KSBhcyBObXNEYXRhZ3JhbTtcbiAgICBpZiAodmVyaWZ5U3RhdCAhPT0gMCkge1xuICAgICAgYXdhaXQgdGVybWluYXRlKG5ldyBOaWJ1c0Vycm9yKHZlcmlmeVN0YXQhLCB0aGlzLCAnRG93bmxvYWQgc2VnbWVudCBlcnJvcicpKTtcbiAgICB9XG4gICAgYXdhaXQgdGVybWluYXRlKCk7XG4gICAgdGhpcy5lbWl0KFxuICAgICAgJ2Rvd25sb2FkRmluaXNoJyxcbiAgICAgIHtcbiAgICAgICAgZG9tYWluLFxuICAgICAgICBvZmZzZXQsXG4gICAgICAgIHNpemU6IGJ1ZmZlci5sZW5ndGgsXG4gICAgICB9LFxuICAgICk7XG4gIH1cblxuICBhc3luYyBleGVjdXRlKHByb2dyYW06IHN0cmluZywgYXJncz86IFJlY29yZDxzdHJpbmcsIGFueT4pIHtcbiAgICBjb25zdCB7IGNvbm5lY3Rpb24gfSA9IHRoaXM7XG4gICAgaWYgKCFjb25uZWN0aW9uKSB0aHJvdyBuZXcgRXJyb3IoJ2Rpc2Nvbm5lY3RlZCcpO1xuICAgIGNvbnN0IHN1YnJvdXRpbmVzID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnc3Vicm91dGluZXMnLCB0aGlzKSBhcyBSZWNvcmQ8c3RyaW5nLCBJU3Vicm91dGluZURlc2M+O1xuICAgIGlmICghc3Vicm91dGluZXMgfHwgIVJlZmxlY3QuaGFzKHN1YnJvdXRpbmVzLCBwcm9ncmFtKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHByb2dyYW0gJHtwcm9ncmFtfWApO1xuICAgIH1cbiAgICBjb25zdCBzdWJyb3V0aW5lID0gc3Vicm91dGluZXNbcHJvZ3JhbV07XG4gICAgY29uc3QgcHJvcHM6IFR5cGVkVmFsdWVbXSA9IFtdO1xuICAgIGlmIChzdWJyb3V0aW5lLmFyZ3MpIHtcbiAgICAgIE9iamVjdC5lbnRyaWVzKHN1YnJvdXRpbmUuYXJncykuZm9yRWFjaCgoW25hbWUsIGRlc2NdKSA9PiB7XG4gICAgICAgIGNvbnN0IGFyZyA9IGFyZ3MgJiYgYXJnc1tuYW1lXTtcbiAgICAgICAgaWYgKCFhcmcpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgYXJnICR7bmFtZX0gaW4gcHJvZ3JhbSAke3Byb2dyYW19YCk7XG4gICAgICAgIHByb3BzLnB1c2goW2Rlc2MudHlwZSwgYXJnXSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgY29uc3QgcmVxID0gY3JlYXRlRXhlY3V0ZVByb2dyYW1JbnZvY2F0aW9uKFxuICAgICAgdGhpcy5hZGRyZXNzLFxuICAgICAgc3Vicm91dGluZS5pZCxcbiAgICAgIHN1YnJvdXRpbmUubm90UmVwbHksXG4gICAgICAuLi5wcm9wcyxcbiAgICApO1xuICAgIHJldHVybiBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShyZXEpO1xuICB9XG59XG5cbi8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZVxuaW50ZXJmYWNlIERldmljZVByb3RvdHlwZSB7XG4gIHJlYWRvbmx5IGlkOiBEZXZpY2VJZDtcbiAgcmVhZG9ubHkgYWRkcmVzczogQWRkcmVzcztcbiAgW21pYlByb3BlcnR5OiBzdHJpbmddOiBhbnk7XG4gICRjb3VudFJlZjogbnVtYmVyO1xuICAkcmVhZD86IFByb21pc2U8YW55PjtcbiAgWyR2YWx1ZXNdOiB7IFtpZDogbnVtYmVyXTogYW55IH07XG4gIFskZXJyb3JzXTogeyBbaWQ6IG51bWJlcl06IEVycm9yIH07XG4gIFskZGlydGllc106IHsgW2lkOiBudW1iZXJdOiBib29sZWFuIH07XG59XG5cbmZ1bmN0aW9uIGZpbmRNaWJCeVR5cGUodHlwZTogbnVtYmVyLCB2ZXJzaW9uPzogbnVtYmVyKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgY29uc3QgY29uZiA9IHBhdGgucmVzb2x2ZShjb25maWdEaXIgfHwgJy90bXAnLCAnY29uZmlnc3RvcmUnLCBwa2dOYW1lKTtcbiAgY29uc3QgdmFsaWRhdGUgPSBDb25maWdWLmRlY29kZShyZXF1aXJlKGNvbmYpKTtcbiAgaWYgKHZhbGlkYXRlLmlzTGVmdCgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGNvbmZpZyBmaWxlICR7Y29uZn1cbiAgJHtQYXRoUmVwb3J0ZXIucmVwb3J0KHZhbGlkYXRlKX1gKTtcbiAgfVxuICBjb25zdCB7IG1pYlR5cGVzIH0gPSB2YWxpZGF0ZS52YWx1ZTtcbiAgY29uc3QgbWlicyA9IG1pYlR5cGVzIVt0eXBlXTtcbiAgaWYgKG1pYnMgJiYgbWlicy5sZW5ndGgpIHtcbiAgICBsZXQgbWliVHlwZSA9IG1pYnNbMF07XG4gICAgaWYgKHZlcnNpb24gJiYgbWlicy5sZW5ndGggPiAxKSB7XG4gICAgICBtaWJUeXBlID0gXy5maW5kTGFzdChtaWJzLCAoeyBtaW5WZXJzaW9uID0gMCB9KSA9PiBtaW5WZXJzaW9uIDw9IHZlcnNpb24pIHx8IG1pYlR5cGU7XG4gICAgfVxuICAgIHJldHVybiBtaWJUeXBlLm1pYjtcbiAgfVxuICAvLyBjb25zdCBjYWNoZU1pYnMgPSBPYmplY3Qua2V5cyhtaWJUeXBlc0NhY2hlKTtcbiAgLy8gY29uc3QgY2FjaGVkID0gY2FjaGVNaWJzLmZpbmQobWliID0+XG4gIC8vICAgUmVmbGVjdC5nZXRNZXRhZGF0YSgnZGV2aWNlVHlwZScsIG1pYlR5cGVzQ2FjaGVbbWliXS5wcm90b3R5cGUpID09PSB0eXBlKTtcbiAgLy8gaWYgKGNhY2hlZCkgcmV0dXJuIGNhY2hlZDtcbiAgLy8gY29uc3QgbWlicyA9IGdldE1pYnNTeW5jKCk7XG4gIC8vIHJldHVybiBfLmRpZmZlcmVuY2UobWlicywgY2FjaGVNaWJzKS5maW5kKChtaWJOYW1lKSA9PiB7XG4gIC8vICAgY29uc3QgbWliZmlsZSA9IGdldE1pYkZpbGUobWliTmFtZSk7XG4gIC8vICAgY29uc3QgbWliOiBJTWliRGV2aWNlID0gcmVxdWlyZShtaWJmaWxlKTtcbiAgLy8gICBjb25zdCB7IHR5cGVzIH0gPSBtaWI7XG4gIC8vICAgY29uc3QgZGV2aWNlID0gdHlwZXNbbWliLmRldmljZV0gYXMgSU1pYkRldmljZVR5cGU7XG4gIC8vICAgcmV0dXJuIHRvSW50KGRldmljZS5hcHBpbmZvLmRldmljZV90eXBlKSA9PT0gdHlwZTtcbiAgLy8gfSk7XG59XG5cbmV4cG9ydCBkZWNsYXJlIGludGVyZmFjZSBEZXZpY2VzIHtcbiAgb24oZXZlbnQ6ICduZXcnIHwgJ2RlbGV0ZScsIGRldmljZUxpc3RlbmVyOiAoZGV2aWNlOiBJRGV2aWNlKSA9PiB2b2lkKTogdGhpcztcbiAgb25jZShldmVudDogJ25ldycgfCAnZGVsZXRlJywgZGV2aWNlTGlzdGVuZXI6IChkZXZpY2U6IElEZXZpY2UpID0+IHZvaWQpOiB0aGlzO1xuICBhZGRMaXN0ZW5lcihldmVudDogJ25ldycgfCAnZGVsZXRlJywgZGV2aWNlTGlzdGVuZXI6IChkZXZpY2U6IElEZXZpY2UpID0+IHZvaWQpOiB0aGlzO1xufVxuXG5mdW5jdGlvbiBnZXRDb25zdHJ1Y3RvcihtaWI6IHN0cmluZyk6IEZ1bmN0aW9uIHtcbiAgbGV0IGNvbnN0cnVjdG9yID0gbWliVHlwZXNDYWNoZVttaWJdO1xuICBpZiAoIWNvbnN0cnVjdG9yKSB7XG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lXG4gICAgZnVuY3Rpb24gRGV2aWNlKHRoaXM6IERldmljZVByb3RvdHlwZSwgYWRkcmVzczogQWRkcmVzcykge1xuICAgICAgRXZlbnRFbWl0dGVyLmFwcGx5KHRoaXMpO1xuICAgICAgdGhpc1skdmFsdWVzXSA9IHt9O1xuICAgICAgdGhpc1skZXJyb3JzXSA9IHt9O1xuICAgICAgdGhpc1skZGlydGllc10gPSB7fTtcbiAgICAgIFJlZmxlY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2FkZHJlc3MnLCB3aXRoVmFsdWUoYWRkcmVzcykpO1xuICAgICAgdGhpcy4kY291bnRSZWYgPSAxO1xuICAgICAgKHRoaXMgYXMgYW55KS5pZCA9IHRpbWVpZCgpIGFzIERldmljZUlkO1xuICAgICAgLy8gZGVidWcobmV3IEVycm9yKCdDUkVBVEUnKS5zdGFjayk7XG4gICAgfVxuXG4gICAgY29uc3QgcHJvdG90eXBlID0gbmV3IERldmljZVByb3RvdHlwZShtaWIpO1xuICAgIERldmljZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHByb3RvdHlwZSk7XG4gICAgKERldmljZSBhcyBhbnkpLmRpc3BsYXlOYW1lID0gYCR7bWliWzBdLnRvVXBwZXJDYXNlKCl9JHttaWIuc2xpY2UoMSl9YDtcbiAgICBjb25zdHJ1Y3RvciA9IERldmljZTtcbiAgICBtaWJUeXBlc0NhY2hlW21pYl0gPSBjb25zdHJ1Y3RvcjtcbiAgfVxuICByZXR1cm4gY29uc3RydWN0b3I7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRNaWJQcm90b3R5cGUobWliOiBzdHJpbmcpOiBPYmplY3Qge1xuICByZXR1cm4gZ2V0Q29uc3RydWN0b3IobWliKS5wcm90b3R5cGU7XG59XG5cbmV4cG9ydCBjbGFzcyBEZXZpY2VzIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgZ2V0ID0gKCk6IElEZXZpY2VbXSA9PiBfLnZhbHVlcyhkZXZpY2VNYXApO1xuXG4gIGZpbmQgPSAoYWRkcmVzczogQWRkcmVzc1BhcmFtKTogSURldmljZSB8IHVuZGVmaW5lZCA9PiB7XG4gICAgY29uc3QgdGFyZ2V0QWRkcmVzcyA9IG5ldyBBZGRyZXNzKGFkZHJlc3MpO1xuICAgIHJldHVybiBkZXZpY2VNYXBbdGFyZ2V0QWRkcmVzcy50b1N0cmluZygpXTtcbiAgfTtcblxuICBjcmVhdGUoYWRkcmVzczogQWRkcmVzc1BhcmFtLCBtaWI6IHN0cmluZyk6IElEZXZpY2U7XG4gIGNyZWF0ZShhZGRyZXNzOiBBZGRyZXNzUGFyYW0sIHR5cGU6IG51bWJlciwgdmVyc2lvbj86IG51bWJlcik6IElEZXZpY2U7XG4gIGNyZWF0ZShhZGRyZXNzOiBBZGRyZXNzUGFyYW0sIG1pYk9yVHlwZTogYW55LCB2ZXJzaW9uPzogbnVtYmVyKTogSURldmljZSB7XG4gICAgbGV0IG1pYjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgIGlmICh0eXBlb2YgbWliT3JUeXBlID09PSAnbnVtYmVyJykge1xuICAgICAgbWliID0gZmluZE1pYkJ5VHlwZShtaWJPclR5cGUsIHZlcnNpb24pO1xuICAgICAgaWYgKG1pYiA9PT0gdW5kZWZpbmVkKSB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gbWliIHR5cGUnKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBtaWJPclR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICBtaWIgPSBTdHJpbmcobWliT3JUeXBlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtaWIgb3IgdHlwZSBleHBlY3RlZCwgZ290ICR7bWliT3JUeXBlfWApO1xuICAgIH1cbiAgICBjb25zdCB0YXJnZXRBZGRyZXNzID0gbmV3IEFkZHJlc3MoYWRkcmVzcyk7XG4gICAgbGV0IGRldmljZSA9IGRldmljZU1hcFt0YXJnZXRBZGRyZXNzLnRvU3RyaW5nKCldO1xuICAgIGlmIChkZXZpY2UpIHtcbiAgICAgIGNvbnNvbGUuYXNzZXJ0KFxuICAgICAgICBSZWZsZWN0LmdldE1ldGFkYXRhKCdtaWInLCBkZXZpY2UpID09PSBtaWIsXG4gICAgICAgIGBtaWJzIGFyZSBkaWZmZXJlbnQsIGV4cGVjdGVkICR7bWlifWAsXG4gICAgICApO1xuICAgICAgZGV2aWNlLmFkZHJlZigpO1xuICAgICAgcmV0dXJuIGRldmljZTtcbiAgICB9XG5cbiAgICBjb25zdCBjb25zdHJ1Y3RvciA9IGdldENvbnN0cnVjdG9yKG1pYik7XG4gICAgZGV2aWNlID0gUmVmbGVjdC5jb25zdHJ1Y3QoY29uc3RydWN0b3IsIFt0YXJnZXRBZGRyZXNzXSk7XG4gICAgaWYgKCF0YXJnZXRBZGRyZXNzLmlzRW1wdHkpIHtcbiAgICAgIGRldmljZU1hcFt0YXJnZXRBZGRyZXNzLnRvU3RyaW5nKCldID0gZGV2aWNlO1xuICAgICAgcHJvY2Vzcy5uZXh0VGljaygoKSA9PiB0aGlzLmVtaXQoJ25ldycsIGRldmljZSkpO1xuICAgIH1cbiAgICByZXR1cm4gZGV2aWNlO1xuICB9XG59XG5cbmNvbnN0IGRldmljZXMgPSBuZXcgRGV2aWNlcygpO1xuXG5leHBvcnQgZGVmYXVsdCBkZXZpY2VzO1xuIl19