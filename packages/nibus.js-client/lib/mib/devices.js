"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getMibFile = getMibFile;
exports.findMibByType = findMibByType;
exports.getMibPrototype = getMibPrototype;
exports.default = exports.Devices = exports.getMibTypes = exports.MibDeviceV = void 0;

require("source-map-support/register");

var _crc = require("crc");

var _debug = _interopRequireDefault(require("debug"));

var _events = require("events");

var _fs = _interopRequireDefault(require("fs"));

var t = _interopRequireWildcard(require("io-ts"));

var _PathReporter = require("io-ts/lib/PathReporter");

var _lodash = _interopRequireDefault(require("lodash"));

var _path = _interopRequireDefault(require("path"));

require("reflect-metadata");

var _xdgBasedir = require("xdg-basedir");

var _Address = _interopRequireWildcard(require("../Address"));

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
    const mibValidation = MibDeviceV.decode(JSON.parse(_fs.default.readFileSync(mibfile).toString()));

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

    if (names.includes('serno') && !isDirty && this.address.type === _Address.AddressType.mac && typeof this.serno === 'string') {
      const value = this.serno;
      const prevAddress = this.address;
      const address = Buffer.from(value.padStart(12, '0').substring(value.length - 12), 'hex');
      Reflect.defineProperty(this, 'address', (0, _mib.withValue)(new _Address.default(address), false, true));
      devices.emit('serno', prevAddress, this.address);
    }
  }

  addref() {
    this.$countRef += 1;
    debug('addref', new Error('addref').stack);
    return this.$countRef;
  }

  release() {
    this.$countRef -= 1;

    if (this.$countRef <= 0) {
      const key = this.address.toString();
      deviceMap[key] = _lodash.default.without(deviceMap[key], this);

      if (deviceMap[key].length === 0) {
        delete deviceMap[key];
      }
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


const getMibTypes = () => {
  const conf = _path.default.resolve(_xdgBasedir.config || '/tmp', 'configstore', pkgName);

  const validate = _common.ConfigV.decode(JSON.parse(_fs.default.readFileSync(`${conf}.json`).toString())); //   const validate = ConfigV.decode(require(conf));


  if (validate.isLeft()) {
    throw new Error(`Invalid config file ${conf}
  ${_PathReporter.PathReporter.report(validate)}`);
  }

  const {
    mibTypes
  } = validate.value;
  return mibTypes;
};

exports.getMibTypes = getMibTypes;

function findMibByType(type, version) {
  const mibTypes = getMibTypes();
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
      Reflect.defineProperty(this, 'address', (0, _mib.withValue)(address, false, true));
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

    _defineProperty(this, "get", () => _lodash.default.flatten(_lodash.default.values(deviceMap)));

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

    const targetAddress = new _Address.default(address); // let device = deviceMap[targetAddress.toString()];
    // if (device) {
    //   console.assert(
    //     Reflect.getMetadata('mib', device) === mib,
    //     `mibs are different, expected ${mib}`,
    //   );
    //   device.addref();
    //   return device;
    // }

    const constructor = getConstructor(mib);
    const device = Reflect.construct(constructor, [targetAddress]);

    if (!targetAddress.isEmpty) {
      const key = targetAddress.toString();
      deviceMap[key] = (deviceMap[key] || []).concat(device);
      process.nextTick(() => this.emit('new', device));
    }

    return device;
  }

}

exports.Devices = Devices;
const devices = new Devices();
var _default = devices;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taWIvZGV2aWNlcy50cyJdLCJuYW1lcyI6WyJwa2dOYW1lIiwiZGVidWciLCIkdmFsdWVzIiwiU3ltYm9sIiwiJGVycm9ycyIsIiRkaXJ0aWVzIiwic2FmZU51bWJlciIsInZhbCIsIm51bSIsInBhcnNlRmxvYXQiLCJOdW1iZXIiLCJpc05hTiIsIlByaXZhdGVQcm9wcyIsImRldmljZU1hcCIsIm1pYlR5cGVzQ2FjaGUiLCJNaWJQcm9wZXJ0eUFwcEluZm9WIiwidCIsImludGVyc2VjdGlvbiIsInR5cGUiLCJubXNfaWQiLCJ1bmlvbiIsInN0cmluZyIsIkludCIsImFjY2VzcyIsInBhcnRpYWwiLCJjYXRlZ29yeSIsIk1pYlByb3BlcnR5ViIsImFubm90YXRpb24iLCJhcHBpbmZvIiwiTWliRGV2aWNlQXBwSW5mb1YiLCJtaWJfdmVyc2lvbiIsImRldmljZV90eXBlIiwibG9hZGVyX3R5cGUiLCJmaXJtd2FyZSIsIm1pbl92ZXJzaW9uIiwiTWliRGV2aWNlVHlwZVYiLCJwcm9wZXJ0aWVzIiwicmVjb3JkIiwiTWliVHlwZVYiLCJiYXNlIiwiemVybyIsInVuaXRzIiwicHJlY2lzaW9uIiwicmVwcmVzZW50YXRpb24iLCJtaW5JbmNsdXNpdmUiLCJtYXhJbmNsdXNpdmUiLCJlbnVtZXJhdGlvbiIsIk1pYlN1YnJvdXRpbmVWIiwicmVzcG9uc2UiLCJTdWJyb3V0aW5lVHlwZVYiLCJpZCIsImxpdGVyYWwiLCJNaWJEZXZpY2VWIiwiZGV2aWNlIiwidHlwZXMiLCJzdWJyb3V0aW5lcyIsImdldEJhc2VUeXBlIiwic3VwZXJUeXBlIiwiZGVmaW5lTWliUHJvcGVydHkiLCJ0YXJnZXQiLCJrZXkiLCJwcm9wIiwicHJvcGVydHlLZXkiLCJSZWZsZWN0IiwiZGVmaW5lTWV0YWRhdGEiLCJzaW1wbGVUeXBlIiwiY29udmVydGVycyIsImlzUmVhZGFibGUiLCJpbmRleE9mIiwiaXNXcml0YWJsZSIsIm1pbiIsIm1heCIsIk5tc1ZhbHVlVHlwZSIsIkludDgiLCJJbnQxNiIsIkludDMyIiwiVUludDgiLCJVSW50MTYiLCJVSW50MzIiLCJwdXNoIiwiZml4ZWRQb2ludE51bWJlcjRDb252ZXJ0ZXIiLCJwZXJjZW50Q29udmVydGVyIiwidW5kZWZpbmVkIiwiTWF0aCIsImluZm8iLCJzaXplIiwiT2JqZWN0IiwiZW50cmllcyIsIm1hcCIsInZlcnNpb25UeXBlQ29udmVydGVyIiwiYm9vbGVhbkNvbnZlcnRlciIsIm5hbWUiLCJhdHRyaWJ1dGVzIiwiZW51bWVyYWJsZSIsInRvIiwiZnJvbSIsImdldCIsImNvbnNvbGUiLCJhc3NlcnQiLCJ2YWx1ZSIsImdldEVycm9yIiwiZ2V0UmF3VmFsdWUiLCJzZXQiLCJuZXdWYWx1ZSIsIkVycm9yIiwiSlNPTiIsInN0cmluZ2lmeSIsInNldFJhd1ZhbHVlIiwiZGVmaW5lUHJvcGVydHkiLCJnZXRNaWJGaWxlIiwibWlibmFtZSIsInBhdGgiLCJyZXNvbHZlIiwiX19kaXJuYW1lIiwiRGV2aWNlUHJvdG90eXBlIiwiRXZlbnRFbWl0dGVyIiwiY29uc3RydWN0b3IiLCJtaWJmaWxlIiwibWliVmFsaWRhdGlvbiIsImRlY29kZSIsInBhcnNlIiwiZnMiLCJyZWFkRmlsZVN5bmMiLCJ0b1N0cmluZyIsImlzTGVmdCIsIlBhdGhSZXBvcnRlciIsInJlcG9ydCIsIm1pYiIsImVycm9yVHlwZSIsIm1ldGFzdWJzIiwiXyIsInRyYW5zZm9ybSIsInJlc3VsdCIsInN1YiIsImRlc2NyaXB0aW9uIiwiYXJncyIsImRlc2MiLCJrZXlzIiwib3duS2V5cyIsInZhbGlkSnNOYW1lIiwiZm9yRWFjaCIsInByb3BOYW1lIiwiY29ubmVjdGlvbiIsInZhbHVlcyIsInByZXYiLCJlbWl0IiwidG9KU09OIiwianNvbiIsImdldE1ldGFkYXRhIiwiYWRkcmVzcyIsImdldElkIiwiaWRPck5hbWUiLCJpc0ludGVnZXIiLCJoYXMiLCJnZXROYW1lIiwiaW5jbHVkZXMiLCJpc0RpcnR5IiwiZXJyb3JzIiwibmV3VmFsIiwic2V0RGlydHkiLCJzZXRFcnJvciIsImVycm9yIiwiZGlydGllcyIsIm5hbWVzIiwiQWRkcmVzc1R5cGUiLCJtYWMiLCJzZXJubyIsInByZXZBZGRyZXNzIiwiQnVmZmVyIiwicGFkU3RhcnQiLCJzdWJzdHJpbmciLCJsZW5ndGgiLCJBZGRyZXNzIiwiZGV2aWNlcyIsImFkZHJlZiIsIiRjb3VudFJlZiIsInN0YWNrIiwicmVsZWFzZSIsIndpdGhvdXQiLCJkcmFpbiIsImlkcyIsImZpbHRlciIsIndyaXRlIiwiY2F0Y2giLCJQcm9taXNlIiwid3JpdGVBbGwiLCJyZWplY3QiLCJqb2luIiwicmVxdWVzdHMiLCJyZWR1Y2UiLCJhY2MiLCJhbGwiLCJkYXRhZ3JhbSIsInNlbmREYXRhZ3JhbSIsInRoZW4iLCJzdGF0dXMiLCJOaWJ1c0Vycm9yIiwicmVhc29uIiwid3JpdGVWYWx1ZXMiLCJzb3VyY2UiLCJzdHJvbmciLCJUeXBlRXJyb3IiLCJhc3NpZ24iLCJ3cml0dGVuIiwiZXJyIiwicmVhZEFsbCIsIiRyZWFkIiwic29ydCIsInJlYWQiLCJjbGVhciIsImZpbmFsbHkiLCJkaXNhYmxlQmF0Y2hSZWFkaW5nIiwiY2h1bmtzIiwiY2h1bmsiLCJwcm9taXNlIiwiZGF0YWdyYW1zIiwiQXJyYXkiLCJpc0FycmF5IiwibWVzc2FnZSIsInVwbG9hZCIsImRvbWFpbiIsIm9mZnNldCIsInJlcVVwbG9hZCIsInBhZEVuZCIsImRvbWFpblNpemUiLCJpbml0VXBsb2FkIiwiaW5pdFN0YXQiLCJ0b3RhbCIsInJlc3QiLCJwb3MiLCJidWZzIiwidXBsb2FkU2VnbWVudCIsInVwbG9hZFN0YXR1cyIsImRhdGEiLCJjb25jYXQiLCJlIiwiZG93bmxvYWQiLCJidWZmZXIiLCJub1Rlcm0iLCJyZXFEb3dubG9hZCIsInRlcm1pbmF0ZSIsInRlcm1TdGF0IiwicmVxIiwicmVzIiwiaW5pdERvd25sb2FkIiwiY3JjIiwiY2h1bmtTaXplIiwiTk1TX01BWF9EQVRBX0xFTkdUSCIsImkiLCJzZWdtZW50RG93bmxvYWQiLCJkb3dubG9hZFN0YXQiLCJ2ZXJpZnkiLCJ2ZXJpZnlTdGF0IiwiZXhlY3V0ZSIsInByb2dyYW0iLCJzdWJyb3V0aW5lIiwicHJvcHMiLCJhcmciLCJub3RSZXBseSIsImdldE1pYlR5cGVzIiwiY29uZiIsImNvbmZpZ0RpciIsInZhbGlkYXRlIiwiQ29uZmlnViIsIm1pYlR5cGVzIiwiZmluZE1pYkJ5VHlwZSIsInZlcnNpb24iLCJtaWJzIiwibWliVHlwZSIsImZpbmRMYXN0IiwibWluVmVyc2lvbiIsImdldENvbnN0cnVjdG9yIiwiRGV2aWNlIiwiYXBwbHkiLCJwcm90b3R5cGUiLCJjcmVhdGUiLCJkaXNwbGF5TmFtZSIsInRvVXBwZXJDYXNlIiwic2xpY2UiLCJnZXRNaWJQcm90b3R5cGUiLCJEZXZpY2VzIiwiZmxhdHRlbiIsInRhcmdldEFkZHJlc3MiLCJtaWJPclR5cGUiLCJTdHJpbmciLCJjb25zdHJ1Y3QiLCJpc0VtcHR5IiwicHJvY2VzcyIsIm5leHRUaWNrIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFXQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFFQTs7QUFDQTs7QUFnQkE7O0FBQ0E7O0FBQ0E7O0FBQ0E7Ozs7Ozs7O0FBb0JBO0FBQ0E7QUFFQSxNQUFNQSxPQUFPLEdBQUcsZ0JBQWhCLEMsQ0FBa0M7O0FBRWxDLE1BQU1DLEtBQUssR0FBRyxvQkFBYSxlQUFiLENBQWQ7QUFFQSxNQUFNQyxPQUFPLEdBQUdDLE1BQU0sQ0FBQyxRQUFELENBQXRCO0FBQ0EsTUFBTUMsT0FBTyxHQUFHRCxNQUFNLENBQUMsUUFBRCxDQUF0QjtBQUNBLE1BQU1FLFFBQVEsR0FBR0YsTUFBTSxDQUFDLFNBQUQsQ0FBdkI7O0FBRUEsU0FBU0csVUFBVCxDQUFvQkMsR0FBcEIsRUFBOEI7QUFDNUIsUUFBTUMsR0FBRyxHQUFHQyxVQUFVLENBQUNGLEdBQUQsQ0FBdEI7QUFDQSxTQUFRRyxNQUFNLENBQUNDLEtBQVAsQ0FBYUgs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QUFBLE9BQU8sQ0FBQ0MsUUFBUixDQUFpQixNQUFNLEtBQUsvSSxJQUFMLENBQVUsS0FBVixFQUFpQjVGLE1BQWpCLENBQXZCO0FBQ0Q7O0FBQ0QsV0FBT0EsTUFBUDtBQUNEOztBQXZDdUM7OztBQTBDMUMsTUFBTXdILE9BQU8sR0FBRyxJQUFJMkcsT0FBSixFQUFoQjtlQUVlM0csTyIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IChjKSAyMDE5LiBPT08gTmF0YS1JbmZvXG4gKiBAYXV0aG9yIEFuZHJlaSBTYXJha2VldiA8YXZzQG5hdGEtaW5mby5ydT5cbiAqXG4gKiBUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgXCJAbmF0YVwiIHByb2plY3QuXG4gKiBGb3IgdGhlIGZ1bGwgY29weXJpZ2h0IGFuZCBsaWNlbnNlIGluZm9ybWF0aW9uLCBwbGVhc2Ugdmlld1xuICogdGhlIEVVTEEgZmlsZSB0aGF0IHdhcyBkaXN0cmlidXRlZCB3aXRoIHRoaXMgc291cmNlIGNvZGUuXG4gKi9cblxuLyogdHNsaW50OmRpc2FibGU6dmFyaWFibGUtbmFtZSAqL1xuaW1wb3J0IHsgY3JjMTZjY2l0dCB9IGZyb20gJ2NyYyc7XG5pbXBvcnQgZGVidWdGYWN0b3J5IGZyb20gJ2RlYnVnJztcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgdCBmcm9tICdpby10cyc7XG5pbXBvcnQgeyBQYXRoUmVwb3J0ZXIgfSBmcm9tICdpby10cy9saWIvUGF0aFJlcG9ydGVyJztcbmltcG9ydCBfIGZyb20gJ2xvZGFzaCc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAncmVmbGVjdC1tZXRhZGF0YSc7XG5pbXBvcnQgeyBjb25maWcgYXMgY29uZmlnRGlyIH0gZnJvbSAneGRnLWJhc2VkaXInO1xuaW1wb3J0IEFkZHJlc3MsIHsgQWRkcmVzc1BhcmFtLCBBZGRyZXNzVHlwZSB9IGZyb20gJy4uL0FkZHJlc3MnO1xuaW1wb3J0IHsgTmlidXNFcnJvciB9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQgeyBOTVNfTUFYX0RBVEFfTEVOR1RIIH0gZnJvbSAnLi4vbmJjb25zdCc7XG5pbXBvcnQgeyBOaWJ1c0Nvbm5lY3Rpb24gfSBmcm9tICcuLi9uaWJ1cyc7XG5pbXBvcnQgeyBjaHVua0FycmF5IH0gZnJvbSAnLi4vbmlidXMvaGVscGVyJztcbmltcG9ydCB7XG4gIGNyZWF0ZUV4ZWN1dGVQcm9ncmFtSW52b2NhdGlvbixcbiAgY3JlYXRlTm1zRG93bmxvYWRTZWdtZW50LFxuICBjcmVhdGVObXNJbml0aWF0ZURvd25sb2FkU2VxdWVuY2UsXG4gIGNyZWF0ZU5tc0luaXRpYXRlVXBsb2FkU2VxdWVuY2UsXG4gIGNyZWF0ZU5tc1JlYWQsXG4gIGNyZWF0ZU5tc1JlcXVlc3REb21haW5Eb3dubG9hZCxcbiAgY3JlYXRlTm1zUmVxdWVzdERvbWFpblVwbG9hZCxcbiAgY3JlYXRlTm1zVGVybWluYXRlRG93bmxvYWRTZXF1ZW5jZSxcbiAgY3JlYXRlTm1zVXBsb2FkU2VnbWVudCxcbiAgY3JlYXRlTm1zVmVyaWZ5RG9tYWluQ2hlY2tzdW0sXG4gIGNyZWF0ZU5tc1dyaXRlLFxuICBnZXRObXNUeXBlLFxuICBUeXBlZFZhbHVlLFxufSBmcm9tICcuLi9ubXMnO1xuaW1wb3J0IE5tc0RhdGFncmFtIGZyb20gJy4uL25tcy9ObXNEYXRhZ3JhbSc7XG5pbXBvcnQgTm1zVmFsdWVUeXBlIGZyb20gJy4uL25tcy9ObXNWYWx1ZVR5cGUnO1xuaW1wb3J0IHsgQ29uZmlnViB9IGZyb20gJy4uL3Nlc3Npb24vY29tbW9uJztcbmltcG9ydCB0aW1laWQgZnJvbSAnLi4vdGltZWlkJztcbmltcG9ydCB7XG4gIGJvb2xlYW5Db252ZXJ0ZXIsXG4gIGNvbnZlcnRGcm9tLFxuICBjb252ZXJ0VG8sXG4gIGVudW1lcmF0aW9uQ29udmVydGVyLFxuICBmaXhlZFBvaW50TnVtYmVyNENvbnZlcnRlcixcbiAgZ2V0SW50U2l6ZSxcbiAgSUNvbnZlcnRlcixcbiAgbWF4SW5jbHVzaXZlQ29udmVydGVyLFxuICBtaW5JbmNsdXNpdmVDb252ZXJ0ZXIsXG4gIHBhY2tlZDhmbG9hdENvbnZlcnRlcixcbiAgcGVyY2VudENvbnZlcnRlcixcbiAgcHJlY2lzaW9uQ29udmVydGVyLFxuICByZXByZXNlbnRhdGlvbkNvbnZlcnRlcixcbiAgdG9JbnQsXG4gIHVuaXRDb252ZXJ0ZXIsXG4gIHZhbGlkSnNOYW1lLFxuICB2ZXJzaW9uVHlwZUNvbnZlcnRlcixcbiAgd2l0aFZhbHVlLFxufSBmcm9tICcuL21pYic7XG4vLyBpbXBvcnQgeyBnZXRNaWJzU3luYyB9IGZyb20gJy4vbWliMmpzb24nO1xuLy8gaW1wb3J0IGRldGVjdG9yIGZyb20gJy4uL3NlcnZpY2UvZGV0ZWN0b3InO1xuXG5jb25zdCBwa2dOYW1lID0gJ0BuYXRhL25pYnVzLmpzJzsgLy8gcmVxdWlyZSgnLi4vLi4vcGFja2FnZS5qc29uJykubmFtZTtcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ25pYnVzOmRldmljZXMnKTtcblxuY29uc3QgJHZhbHVlcyA9IFN5bWJvbCgndmFsdWVzJyk7XG5jb25zdCAkZXJyb3JzID0gU3ltYm9sKCdlcnJvcnMnKTtcbmNvbnN0ICRkaXJ0aWVzID0gU3ltYm9sKCdkaXJ0aWVzJyk7XG5cbmZ1bmN0aW9uIHNhZmVOdW1iZXIodmFsOiBhbnkpIHtcbiAgY29uc3QgbnVtID0gcGFyc2VGbG9hdCh2YWwpO1xuICByZXR1cm4gKE51bWJlci5pc05hTihudW0pIHx8IGAke251bX1gICE9PSB2YWwpID8gdmFsIDogbnVtO1xufVxuXG5lbnVtIFByaXZhdGVQcm9wcyB7XG4gIGNvbm5lY3Rpb24gPSAtMSxcbn1cblxuY29uc3QgZGV2aWNlTWFwOiB7IFthZGRyZXNzOiBzdHJpbmddOiBJRGV2aWNlW10gfSA9IHt9O1xuXG5jb25zdCBtaWJUeXBlc0NhY2hlOiB7IFttaWJuYW1lOiBzdHJpbmddOiBGdW5jdGlvbiB9ID0ge307XG5cbmNvbnN0IE1pYlByb3BlcnR5QXBwSW5mb1YgPSB0LmludGVyc2VjdGlvbihbXG4gIHQudHlwZSh7XG4gICAgbm1zX2lkOiB0LnVuaW9uKFt0LnN0cmluZywgdC5JbnRdKSxcbiAgICBhY2Nlc3M6IHQuc3RyaW5nLFxuICB9KSxcbiAgdC5wYXJ0aWFsKHtcbiAgICBjYXRlZ29yeTogdC5zdHJpbmcsXG4gIH0pLFxuXSk7XG5cbi8vIGludGVyZmFjZSBJTWliUHJvcGVydHlBcHBJbmZvIGV4dGVuZHMgdC5UeXBlT2Y8dHlwZW9mIE1pYlByb3BlcnR5QXBwSW5mb1Y+IHt9XG5cbmNvbnN0IE1pYlByb3BlcnR5ViA9IHQudHlwZSh7XG4gIHR5cGU6IHQuc3RyaW5nLFxuICBhbm5vdGF0aW9uOiB0LnN0cmluZyxcbiAgYXBwaW5mbzogTWliUHJvcGVydHlBcHBJbmZvVixcbn0pO1xuXG5pbnRlcmZhY2UgSU1pYlByb3BlcnR5IGV4dGVuZHMgdC5UeXBlT2Y8dHlwZW9mIE1pYlByb3BlcnR5Vj4ge1xuICAvLyBhcHBpbmZvOiBJTWliUHJvcGVydHlBcHBJbmZvO1xufVxuXG5jb25zdCBNaWJEZXZpY2VBcHBJbmZvViA9IHQuaW50ZXJzZWN0aW9uKFtcbiAgdC50eXBlKHtcbiAgICBtaWJfdmVyc2lvbjogdC5zdHJpbmcsXG4gIH0pLFxuICB0LnBhcnRpYWwoe1xuICAgIGRldmljZV90eXBlOiB0LnN0cmluZyxcbiAgICBsb2FkZXJfdHlwZTogdC5zdHJpbmcsXG4gICAgZmlybXdhcmU6IHQuc3RyaW5nLFxuICAgIG1pbl92ZXJzaW9uOiB0LnN0cmluZyxcbiAgfSksXG5dKTtcblxuY29uc3QgTWliRGV2aWNlVHlwZVYgPSB0LnR5cGUoe1xuICBhbm5vdGF0aW9uOiB0LnN0cmluZyxcbiAgYXBwaW5mbzogTWliRGV2aWNlQXBwSW5mb1YsXG4gIHByb3BlcnRpZXM6IHQucmVjb3JkKHQuc3RyaW5nLCBNaWJQcm9wZXJ0eVYpLFxufSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU1pYkRldmljZVR5cGUgZXh0ZW5kcyB0LlR5cGVPZjx0eXBlb2YgTWliRGV2aWNlVHlwZVY+IHt9XG5cbmNvbnN0IE1pYlR5cGVWID0gdC5pbnRlcnNlY3Rpb24oW1xuICB0LnR5cGUoe1xuICAgIGJhc2U6IHQuc3RyaW5nLFxuICB9KSxcbiAgdC5wYXJ0aWFsKHtcbiAgICBhcHBpbmZvOiB0LnBhcnRpYWwoe1xuICAgICAgemVybzogdC5zdHJpbmcsXG4gICAgICB1bml0czogdC5zdHJpbmcsXG4gICAgICBwcmVjaXNpb246IHQuc3RyaW5nLFxuICAgICAgcmVwcmVzZW50YXRpb246IHQuc3RyaW5nLFxuICAgIH0pLFxuICAgIG1pbkluY2x1c2l2ZTogdC5zdHJpbmcsXG4gICAgbWF4SW5jbHVzaXZlOiB0LnN0cmluZyxcbiAgICBlbnVtZXJhdGlvbjogdC5yZWNvcmQodC5zdHJpbmcsIHQudHlwZSh7IGFubm90YXRpb246IHQuc3RyaW5nIH0pKSxcbiAgfSksXG5dKTtcblxuZXhwb3J0IGludGVyZmFjZSBJTWliVHlwZSBleHRlbmRzIHQuVHlwZU9mPHR5cGVvZiBNaWJUeXBlVj4ge31cblxuY29uc3QgTWliU3Vicm91dGluZVYgPSB0LmludGVyc2VjdGlvbihbXG4gIHQudHlwZSh7XG4gICAgYW5ub3RhdGlvbjogdC5zdHJpbmcsXG4gICAgYXBwaW5mbzogdC5pbnRlcnNlY3Rpb24oW1xuICAgICAgdC50eXBlKHsgbm1zX2lkOiB0LnVuaW9uKFt0LnN0cmluZywgdC5JbnRdKSB9KSxcbiAgICAgIHQucGFydGlhbCh7IHJlc3BvbnNlOiB0LnN0cmluZyB9KSxcbiAgICBdKSxcbiAgfSksXG4gIHQucGFydGlhbCh7XG4gICAgcHJvcGVydGllczogdC5yZWNvcmQodC5zdHJpbmcsIHQudHlwZSh7XG4gICAgICB0eXBlOiB0LnN0cmluZyxcbiAgICAgIGFubm90YXRpb246IHQuc3RyaW5nLFxuICAgIH0pKSxcbiAgfSksXG5dKTtcblxuY29uc3QgU3Vicm91dGluZVR5cGVWID0gdC50eXBlKHtcbiAgYW5ub3RhdGlvbjogdC5zdHJpbmcsXG4gIHByb3BlcnRpZXM6IHQudHlwZSh7XG4gICAgaWQ6IHQudHlwZSh7XG4gICAgICB0eXBlOiB0LmxpdGVyYWwoJ3hzOnVuc2lnbmVkU2hvcnQnKSxcbiAgICAgIGFubm90YXRpb246IHQuc3RyaW5nLFxuICAgIH0pLFxuICB9KSxcbn0pO1xuXG5leHBvcnQgY29uc3QgTWliRGV2aWNlViA9IHQuaW50ZXJzZWN0aW9uKFtcbiAgdC50eXBlKHtcbiAgICBkZXZpY2U6IHQuc3RyaW5nLFxuICAgIHR5cGVzOiB0LnJlY29yZCh0LnN0cmluZywgdC51bmlvbihbTWliRGV2aWNlVHlwZVYsIE1pYlR5cGVWLCBTdWJyb3V0aW5lVHlwZVZdKSksXG4gIH0pLFxuICB0LnBhcnRpYWwoe1xuICAgIHN1YnJvdXRpbmVzOiB0LnJlY29yZCh0LnN0cmluZywgTWliU3Vicm91dGluZVYpLFxuICB9KSxcbl0pO1xuXG5pbnRlcmZhY2UgSU1pYkRldmljZSBleHRlbmRzIHQuVHlwZU9mPHR5cGVvZiBNaWJEZXZpY2VWPiB7fVxuXG50eXBlIExpc3RlbmVyPFQ+ID0gKGFyZzogVCkgPT4gdm9pZDtcbnR5cGUgQ2hhbmdlQXJnID0geyBpZDogbnVtYmVyLCBuYW1lczogc3RyaW5nW10gfTtcbmV4cG9ydCB0eXBlIENoYW5nZUxpc3RlbmVyID0gTGlzdGVuZXI8Q2hhbmdlQXJnPjtcbnR5cGUgVXBsb2FkU3RhcnRBcmcgPSB7IGRvbWFpbjogc3RyaW5nLCBkb21haW5TaXplOiBudW1iZXIsIG9mZnNldDogbnVtYmVyLCBzaXplOiBudW1iZXIgfTtcbmV4cG9ydCB0eXBlIFVwbG9hZFN0YXJ0TGlzdGVuZXIgPSBMaXN0ZW5lcjxVcGxvYWRTdGFydEFyZz47XG50eXBlIFVwbG9hZERhdGFBcmcgPSB7IGRvbWFpbjogc3RyaW5nLCBkYXRhOiBCdWZmZXIsIHBvczogbnVtYmVyIH07XG5leHBvcnQgdHlwZSBVcGxvYWREYXRhTGlzdGVuZXIgPSBMaXN0ZW5lcjxVcGxvYWREYXRhQXJnPjtcbnR5cGUgVXBsb2FkRmluaXNoQXJnID0geyBkb21haW46IHN0cmluZywgb2Zmc2V0OiBudW1iZXIsIGRhdGE6IEJ1ZmZlciB9O1xuZXhwb3J0IHR5cGUgVXBsb2FkRmluaXNoTGlzdGVuZXIgPSBMaXN0ZW5lcjxVcGxvYWRGaW5pc2hBcmc+O1xudHlwZSBEb3dubG9hZFN0YXJ0QXJnID0geyBkb21haW46IHN0cmluZywgZG9tYWluU2l6ZTogbnVtYmVyLCBvZmZzZXQ6IG51bWJlciwgc2l6ZTogbnVtYmVyIH07XG5leHBvcnQgdHlwZSBEb3dubG9hZFN0YXJ0TGlzdGVuZXIgPSBMaXN0ZW5lcjxEb3dubG9hZFN0YXJ0QXJnPjtcbnR5cGUgRG93bmxvYWREYXRhQXJnID0geyBkb21haW46IHN0cmluZywgbGVuZ3RoOiBudW1iZXIgfTtcbmV4cG9ydCB0eXBlIERvd25sb2FkRGF0YUxpc3RlbmVyID0gTGlzdGVuZXI8RG93bmxvYWREYXRhQXJnPjtcbnR5cGUgRG93bmxvYWRGaW5pc2hBcmcgPSB7IGRvbWFpbjogc3RyaW5nOyBvZmZzZXQ6IG51bWJlciwgc2l6ZTogbnVtYmVyIH07XG5leHBvcnQgdHlwZSBEb3dubG9hZEZpbmlzaExpc3RlbmVyID0gTGlzdGVuZXI8RG93bmxvYWRGaW5pc2hBcmc+O1xuZXhwb3J0IHR5cGUgRGV2aWNlSWQgPSBzdHJpbmcgJiB7IF9fYnJhbmQ6ICdEZXZpY2VJZCcgfTtcblxuZXhwb3J0IGludGVyZmFjZSBJRGV2aWNlIHtcbiAgcmVhZG9ubHkgaWQ6IERldmljZUlkO1xuICByZWFkb25seSBhZGRyZXNzOiBBZGRyZXNzO1xuICBkcmFpbigpOiBQcm9taXNlPG51bWJlcltdPjtcbiAgd3JpdGUoLi4uaWRzOiBudW1iZXJbXSk6IFByb21pc2U8bnVtYmVyW10+O1xuICByZWFkKC4uLmlkczogbnVtYmVyW10pOiBQcm9taXNlPHsgW25hbWU6IHN0cmluZ106IGFueSB9PjtcbiAgdXBsb2FkKGRvbWFpbjogc3RyaW5nLCBvZmZzZXQ/OiBudW1iZXIsIHNpemU/OiBudW1iZXIpOiBQcm9taXNlPEJ1ZmZlcj47XG4gIGRvd25sb2FkKGRvbWFpbjogc3RyaW5nLCBkYXRhOiBCdWZmZXIsIG9mZnNldD86IG51bWJlciwgbm9UZXJtPzogYm9vbGVhbik6IFByb21pc2U8dm9pZD47XG4gIGV4ZWN1dGUoXG4gICAgcHJvZ3JhbTogc3RyaW5nLFxuICAgIGFyZ3M/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxObXNEYXRhZ3JhbSB8IE5tc0RhdGFncmFtW10gfCB1bmRlZmluZWQ+O1xuICBjb25uZWN0aW9uPzogTmlidXNDb25uZWN0aW9uO1xuICByZWxlYXNlKCk6IG51bWJlcjtcbiAgZ2V0SWQoaWRPck5hbWU6IHN0cmluZyB8IG51bWJlcik6IG51bWJlcjtcbiAgZ2V0TmFtZShpZE9yTmFtZTogc3RyaW5nIHwgbnVtYmVyKTogc3RyaW5nO1xuICBnZXRSYXdWYWx1ZShpZE9yTmFtZTogbnVtYmVyIHwgc3RyaW5nKTogYW55O1xuICBnZXRFcnJvcihpZE9yTmFtZTogbnVtYmVyIHwgc3RyaW5nKTogYW55O1xuICBpc0RpcnR5KGlkT3JOYW1lOiBzdHJpbmcgfCBudW1iZXIpOiBib29sZWFuO1xuICBbbWliUHJvcGVydHk6IHN0cmluZ106IGFueTtcblxuICBvbihldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB0aGlzO1xuICAvLyBvbihldmVudDogJ3Nlcm5vJywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB0aGlzO1xuICBvbihldmVudDogJ2NoYW5naW5nJyB8ICdjaGFuZ2VkJywgbGlzdGVuZXI6IENoYW5nZUxpc3RlbmVyKTogdGhpcztcbiAgb24oZXZlbnQ6ICd1cGxvYWRTdGFydCcsIGxpc3RlbmVyOiBVcGxvYWRTdGFydExpc3RlbmVyKTogdGhpcztcbiAgb24oZXZlbnQ6ICd1cGxvYWREYXRhJywgbGlzdGVuZXI6IFVwbG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAndXBsb2FkRmluaXNoJywgbGlzdGVuZXI6IFVwbG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcbiAgb24oZXZlbnQ6ICdkb3dubG9hZFN0YXJ0JywgbGlzdGVuZXI6IERvd25sb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAnZG93bmxvYWREYXRhJywgbGlzdGVuZXI6IERvd25sb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgb24oZXZlbnQ6ICdkb3dubG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBEb3dubG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcblxuICBvbmNlKGV2ZW50OiAnY29ubmVjdGVkJyB8ICdkaXNjb25uZWN0ZWQnLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCk6IHRoaXM7XG4gIC8vIG9uY2UoZXZlbnQ6ICdzZXJubycsIGxpc3RlbmVyOiAoKSA9PiB2b2lkKTogdGhpcztcbiAgb25jZShldmVudDogJ2NoYW5naW5nJyB8ICdjaGFuZ2VkJywgbGlzdGVuZXI6IENoYW5nZUxpc3RlbmVyKTogdGhpcztcbiAgb25jZShldmVudDogJ3VwbG9hZFN0YXJ0JywgbGlzdGVuZXI6IFVwbG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAndXBsb2FkRGF0YScsIGxpc3RlbmVyOiBVcGxvYWREYXRhTGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAndXBsb2FkRmluaXNoJywgbGlzdGVuZXI6IFVwbG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcbiAgb25jZShldmVudDogJ2Rvd25sb2FkU3RhcnQnLCBsaXN0ZW5lcjogRG93bmxvYWRTdGFydExpc3RlbmVyKTogdGhpcztcbiAgb25jZShldmVudDogJ2Rvd25sb2FkRGF0YScsIGxpc3RlbmVyOiBEb3dubG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICdkb3dubG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBEb3dubG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcblxuICBhZGRMaXN0ZW5lcihldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB0aGlzO1xuICAvLyBhZGRMaXN0ZW5lcihldmVudDogJ3Nlcm5vJywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB0aGlzO1xuICBhZGRMaXN0ZW5lcihldmVudDogJ2NoYW5naW5nJyB8ICdjaGFuZ2VkJywgbGlzdGVuZXI6IENoYW5nZUxpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICd1cGxvYWRTdGFydCcsIGxpc3RlbmVyOiBVcGxvYWRTdGFydExpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICd1cGxvYWREYXRhJywgbGlzdGVuZXI6IFVwbG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIGFkZExpc3RlbmVyKGV2ZW50OiAndXBsb2FkRmluaXNoJywgbGlzdGVuZXI6IFVwbG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICdkb3dubG9hZFN0YXJ0JywgbGlzdGVuZXI6IERvd25sb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIGFkZExpc3RlbmVyKGV2ZW50OiAnZG93bmxvYWREYXRhJywgbGlzdGVuZXI6IERvd25sb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICdkb3dubG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBEb3dubG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcblxuICBvZmYoZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcsIGxpc3RlbmVyOiAoKSA9PiB2b2lkKTogdGhpcztcbiAgLy8gb2ZmKGV2ZW50OiAnc2Vybm8nLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCk6IHRoaXM7XG4gIG9mZihldmVudDogJ2NoYW5naW5nJyB8ICdjaGFuZ2VkJywgbGlzdGVuZXI6IENoYW5nZUxpc3RlbmVyKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAndXBsb2FkU3RhcnQnLCBsaXN0ZW5lcjogVXBsb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIG9mZihldmVudDogJ3VwbG9hZERhdGEnLCBsaXN0ZW5lcjogVXBsb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAndXBsb2FkRmluaXNoJywgbGlzdGVuZXI6IFVwbG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAnZG93bmxvYWRTdGFydCcsIGxpc3RlbmVyOiBEb3dubG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICdkb3dubG9hZERhdGEnLCBsaXN0ZW5lcjogRG93bmxvYWREYXRhTGlzdGVuZXIpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICdkb3dubG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBEb3dubG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcblxuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB0aGlzO1xuICAvLyByZW1vdmVMaXN0ZW5lcihldmVudDogJ3Nlcm5vJywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ2NoYW5naW5nJyB8ICdjaGFuZ2VkJywgbGlzdGVuZXI6IENoYW5nZUxpc3RlbmVyKTogdGhpcztcbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnQ6ICd1cGxvYWRTdGFydCcsIGxpc3RlbmVyOiBVcGxvYWRTdGFydExpc3RlbmVyKTogdGhpcztcbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnQ6ICd1cGxvYWREYXRhJywgbGlzdGVuZXI6IFVwbG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAndXBsb2FkRmluaXNoJywgbGlzdGVuZXI6IFVwbG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnQ6ICdkb3dubG9hZFN0YXJ0JywgbGlzdGVuZXI6IERvd25sb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAnZG93bmxvYWREYXRhJywgbGlzdGVuZXI6IERvd25sb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnQ6ICdkb3dubG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBEb3dubG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcblxuICBlbWl0KGV2ZW50OiAnY29ubmVjdGVkJyB8ICdkaXNjb25uZWN0ZWQnKTogYm9vbGVhbjtcbiAgLy8gZW1pdChldmVudDogJ3Nlcm5vJyk6IGJvb2xlYW47XG4gIGVtaXQoZXZlbnQ6ICdjaGFuZ2luZycgfCAnY2hhbmdlZCcsIGFyZzogQ2hhbmdlQXJnKTogYm9vbGVhbjtcbiAgZW1pdChldmVudDogJ3VwbG9hZFN0YXJ0JywgYXJnOiBVcGxvYWRTdGFydEFyZyk6IGJvb2xlYW47XG4gIGVtaXQoZXZlbnQ6ICd1cGxvYWREYXRhJywgYXJnOiBVcGxvYWREYXRhQXJnKTogYm9vbGVhbjtcbiAgZW1pdChldmVudDogJ3VwbG9hZEZpbmlzaCcsIGFyZzogVXBsb2FkRmluaXNoQXJnKTogYm9vbGVhbjtcbiAgZW1pdChldmVudDogJ2Rvd25sb2FkU3RhcnQnLCBhcmc6IERvd25sb2FkU3RhcnRBcmcpOiBib29sZWFuO1xuICBlbWl0KGV2ZW50OiAnZG93bmxvYWREYXRhJywgYXJnOiBEb3dubG9hZERhdGFBcmcpOiBib29sZWFuO1xuICBlbWl0KGV2ZW50OiAnZG93bmxvYWRGaW5pc2gnLCBhcmc6IERvd25sb2FkRmluaXNoQXJnKTogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIElTdWJyb3V0aW5lRGVzYyB7XG4gIGlkOiBudW1iZXI7XG4gIC8vIG5hbWU6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgbm90UmVwbHk/OiBib29sZWFuO1xuICBhcmdzPzogeyBuYW1lOiBzdHJpbmcsIHR5cGU6IE5tc1ZhbHVlVHlwZSwgZGVzYz86IHN0cmluZyB9W107XG59XG5cbmludGVyZmFjZSBJUHJvcGVydHlEZXNjcmlwdG9yPE93bmVyPiB7XG4gIGNvbmZpZ3VyYWJsZT86IGJvb2xlYW47XG4gIGVudW1lcmFibGU/OiBib29sZWFuO1xuICB2YWx1ZT86IGFueTtcbiAgd3JpdGFibGU/OiBib29sZWFuO1xuXG4gIGdldD8odGhpczogT3duZXIpOiBhbnk7XG5cbiAgc2V0Pyh0aGlzOiBPd25lciwgdjogYW55KTogdm9pZDtcbn1cblxuZnVuY3Rpb24gZ2V0QmFzZVR5cGUodHlwZXM6IElNaWJEZXZpY2VbJ3R5cGVzJ10sIHR5cGU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGxldCBiYXNlID0gdHlwZTtcbiAgZm9yIChsZXQgc3VwZXJUeXBlOiBJTWliVHlwZSA9IHR5cGVzW2Jhc2VdIGFzIElNaWJUeXBlOyBzdXBlclR5cGUgIT0gbnVsbDtcbiAgICAgICBzdXBlclR5cGUgPSB0eXBlc1tzdXBlclR5cGUuYmFzZV0gYXMgSU1pYlR5cGUpIHtcbiAgICBiYXNlID0gc3VwZXJUeXBlLmJhc2U7XG4gIH1cbiAgcmV0dXJuIGJhc2U7XG59XG5cbmZ1bmN0aW9uIGRlZmluZU1pYlByb3BlcnR5KFxuICB0YXJnZXQ6IERldmljZVByb3RvdHlwZSxcbiAga2V5OiBzdHJpbmcsXG4gIHR5cGVzOiBJTWliRGV2aWNlWyd0eXBlcyddLFxuICBwcm9wOiBJTWliUHJvcGVydHkpOiBbbnVtYmVyLCBzdHJpbmddIHtcbiAgY29uc3QgcHJvcGVydHlLZXkgPSB2YWxpZEpzTmFtZShrZXkpO1xuICBjb25zdCB7IGFwcGluZm8gfSA9IHByb3A7XG4gIGNvbnN0IGlkID0gdG9JbnQoYXBwaW5mby5ubXNfaWQpO1xuICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdpZCcsIGlkLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgY29uc3Qgc2ltcGxlVHlwZSA9IGdldEJhc2VUeXBlKHR5cGVzLCBwcm9wLnR5cGUpO1xuICBjb25zdCB0eXBlID0gdHlwZXNbcHJvcC50eXBlXSBhcyBJTWliVHlwZTtcbiAgY29uc3QgY29udmVydGVyczogSUNvbnZlcnRlcltdID0gW107XG4gIGNvbnN0IGlzUmVhZGFibGUgPSBhcHBpbmZvLmFjY2Vzcy5pbmRleE9mKCdyJykgPiAtMTtcbiAgY29uc3QgaXNXcml0YWJsZSA9IGFwcGluZm8uYWNjZXNzLmluZGV4T2YoJ3cnKSA+IC0xO1xuICBsZXQgZW51bWVyYXRpb246IElNaWJUeXBlWydlbnVtZXJhdGlvbiddIHwgdW5kZWZpbmVkO1xuICBsZXQgbWluOiBudW1iZXIgfCB1bmRlZmluZWQ7XG4gIGxldCBtYXg6IG51bWJlciB8IHVuZGVmaW5lZDtcbiAgc3dpdGNoIChnZXRObXNUeXBlKHNpbXBsZVR5cGUpKSB7XG4gICAgY2FzZSBObXNWYWx1ZVR5cGUuSW50ODpcbiAgICAgIG1pbiA9IC0xMjg7XG4gICAgICBtYXggPSAxMjc7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE5tc1ZhbHVlVHlwZS5JbnQxNjpcbiAgICAgIG1pbiA9IC0zMjc2ODtcbiAgICAgIG1heCA9IDMyNzY3O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSBObXNWYWx1ZVR5cGUuSW50MzI6XG4gICAgICBtaW4gPSAtMjE0NzQ4MzY0ODtcbiAgICAgIG1heCA9IDIxNDc0ODM2NDc7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE5tc1ZhbHVlVHlwZS5VSW50ODpcbiAgICAgIG1pbiA9IDA7XG4gICAgICBtYXggPSAyNTU7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE5tc1ZhbHVlVHlwZS5VSW50MTY6XG4gICAgICBtaW4gPSAwO1xuICAgICAgbWF4ID0gNjU1MzU7XG4gICAgICBicmVhaztcbiAgICBjYXNlIE5tc1ZhbHVlVHlwZS5VSW50MzI6XG4gICAgICBtaW4gPSAwO1xuICAgICAgbWF4ID0gNDI5NDk2NzI5NTtcbiAgICAgIGJyZWFrO1xuICB9XG4gIHN3aXRjaCAoc2ltcGxlVHlwZSkge1xuICAgIGNhc2UgJ3BhY2tlZDhGbG9hdCc6XG4gICAgICBjb252ZXJ0ZXJzLnB1c2gocGFja2VkOGZsb2F0Q29udmVydGVyKHR5cGUpKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2ZpeGVkUG9pbnROdW1iZXI0JzpcbiAgICAgIGNvbnZlcnRlcnMucHVzaChmaXhlZFBvaW50TnVtYmVyNENvbnZlcnRlcik7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgYnJlYWs7XG4gIH1cbiAgaWYgKGtleSA9PT0gJ2JyaWdodG5lc3MnICYmIHByb3AudHlwZSA9PT0gJ3hzOnVuc2lnbmVkQnl0ZScpIHtcbiAgICBjb252ZXJ0ZXJzLnB1c2gocGVyY2VudENvbnZlcnRlcik7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgndW5pdCcsICclJywgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWluJywgMCwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWF4JywgMTAwLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgfSBlbHNlIGlmIChpc1dyaXRhYmxlKSB7XG4gICAgaWYgKHR5cGUgIT0gbnVsbCkge1xuICAgICAgY29uc3QgeyBtaW5JbmNsdXNpdmUsIG1heEluY2x1c2l2ZSB9ID0gdHlwZTtcbiAgICAgIGlmIChtaW5JbmNsdXNpdmUpIHtcbiAgICAgICAgY29uc3QgdmFsID0gcGFyc2VGbG9hdChtaW5JbmNsdXNpdmUpO1xuICAgICAgICBtaW4gPSBtaW4gIT09IHVuZGVmaW5lZCA/IE1hdGgubWF4KG1pbiwgdmFsKSA6IHZhbDtcbiAgICAgIH1cbiAgICAgIGlmIChtYXhJbmNsdXNpdmUpIHtcbiAgICAgICAgY29uc3QgdmFsID0gcGFyc2VGbG9hdChtYXhJbmNsdXNpdmUpO1xuICAgICAgICBtYXggPSBtYXggIT09IHVuZGVmaW5lZCA/IE1hdGgubWluKG1heCwgdmFsKSA6IHZhbDtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG1pbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBtaW4gPSBjb252ZXJ0VG8oY29udmVydGVycykobWluKSBhcyBudW1iZXI7XG4gICAgICBjb252ZXJ0ZXJzLnB1c2gobWluSW5jbHVzaXZlQ29udmVydGVyKG1pbikpO1xuICAgICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWluJywgbWluLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgICB9XG4gICAgaWYgKG1heCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBtYXggPSBjb252ZXJ0VG8oY29udmVydGVycykobWF4KSBhcyBudW1iZXI7XG4gICAgICBjb252ZXJ0ZXJzLnB1c2gobWF4SW5jbHVzaXZlQ29udmVydGVyKG1heCkpO1xuICAgICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWF4JywgbWF4LCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgICB9XG4gIH1cbiAgaWYgKHR5cGUgIT0gbnVsbCkge1xuICAgIGNvbnN0IHsgYXBwaW5mbzogaW5mbyA9IHt9IH0gPSB0eXBlO1xuICAgIGVudW1lcmF0aW9uID0gdHlwZS5lbnVtZXJhdGlvbjtcbiAgICBjb25zdCB7IHVuaXRzLCBwcmVjaXNpb24sIHJlcHJlc2VudGF0aW9uIH0gPSBpbmZvO1xuICAgIGNvbnN0IHNpemUgPSBnZXRJbnRTaXplKHNpbXBsZVR5cGUpO1xuICAgIGlmICh1bml0cykge1xuICAgICAgY29udmVydGVycy5wdXNoKHVuaXRDb252ZXJ0ZXIodW5pdHMpKTtcbiAgICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ3VuaXQnLCB1bml0cywgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gICAgfVxuICAgIHByZWNpc2lvbiAmJiBjb252ZXJ0ZXJzLnB1c2gocHJlY2lzaW9uQ29udmVydGVyKHByZWNpc2lvbikpO1xuICAgIGlmIChlbnVtZXJhdGlvbikge1xuICAgICAgY29udmVydGVycy5wdXNoKGVudW1lcmF0aW9uQ29udmVydGVyKGVudW1lcmF0aW9uKSk7XG4gICAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdlbnVtJywgT2JqZWN0LmVudHJpZXMoZW51bWVyYXRpb24pXG4gICAgICAgIC5tYXAoKFtrZXksIHZhbF0pID0+IFtcbiAgICAgICAgICB2YWwhLmFubm90YXRpb24sXG4gICAgICAgICAgdG9JbnQoa2V5KSxcbiAgICAgICAgXSksIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICAgIH1cbiAgICByZXByZXNlbnRhdGlvbiAmJiBzaXplICYmIGNvbnZlcnRlcnMucHVzaChyZXByZXNlbnRhdGlvbkNvbnZlcnRlcihyZXByZXNlbnRhdGlvbiwgc2l6ZSkpO1xuICB9XG5cbiAgaWYgKHByb3AudHlwZSA9PT0gJ3ZlcnNpb25UeXBlJykge1xuICAgIGNvbnZlcnRlcnMucHVzaCh2ZXJzaW9uVHlwZUNvbnZlcnRlcik7XG4gIH1cbiAgaWYgKHNpbXBsZVR5cGUgPT09ICd4czpib29sZWFuJyAmJiAhZW51bWVyYXRpb24pIHtcbiAgICBjb252ZXJ0ZXJzLnB1c2goYm9vbGVhbkNvbnZlcnRlcik7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnZW51bScsIFtbJ9CU0LAnLCB0cnVlXSwgWyfQndC10YInLCBmYWxzZV1dLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgfVxuICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdpc1dyaXRhYmxlJywgaXNXcml0YWJsZSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2lzUmVhZGFibGUnLCBpc1JlYWRhYmxlLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgndHlwZScsIHByb3AudHlwZSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ3NpbXBsZVR5cGUnLCBzaW1wbGVUeXBlLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YShcbiAgICAnZGlzcGxheU5hbWUnLFxuICAgIHByb3AuYW5ub3RhdGlvbiA/IHByb3AuYW5ub3RhdGlvbiA6IG5hbWUsXG4gICAgdGFyZ2V0LFxuICAgIHByb3BlcnR5S2V5LFxuICApO1xuICBhcHBpbmZvLmNhdGVnb3J5ICYmIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2NhdGVnb3J5JywgYXBwaW5mby5jYXRlZ29yeSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ25tc1R5cGUnLCBnZXRObXNUeXBlKHNpbXBsZVR5cGUpLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgY29uc3QgYXR0cmlidXRlczogSVByb3BlcnR5RGVzY3JpcHRvcjxEZXZpY2VQcm90b3R5cGU+ID0ge1xuICAgIGVudW1lcmFibGU6IGlzUmVhZGFibGUsXG4gIH07XG4gIGNvbnN0IHRvID0gY29udmVydFRvKGNvbnZlcnRlcnMpO1xuICBjb25zdCBmcm9tID0gY29udmVydEZyb20oY29udmVydGVycyk7XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2NvbnZlcnRUbycsIHRvLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnY29udmVydEZyb20nLCBmcm9tLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgYXR0cmlidXRlcy5nZXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgY29uc29sZS5hc3NlcnQoUmVmbGVjdC5nZXQodGhpcywgJyRjb3VudFJlZicpID4gMCwgJ0RldmljZSB3YXMgcmVsZWFzZWQnKTtcbiAgICBsZXQgdmFsdWU7XG4gICAgaWYgKCF0aGlzLmdldEVycm9yKGlkKSkge1xuICAgICAgdmFsdWUgPSB0byh0aGlzLmdldFJhd1ZhbHVlKGlkKSk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcbiAgaWYgKGlzV3JpdGFibGUpIHtcbiAgICBhdHRyaWJ1dGVzLnNldCA9IGZ1bmN0aW9uIChuZXdWYWx1ZTogYW55KSB7XG4gICAgICBjb25zb2xlLmFzc2VydChSZWZsZWN0LmdldCh0aGlzLCAnJGNvdW50UmVmJykgPiAwLCAnRGV2aWNlIHdhcyByZWxlYXNlZCcpO1xuICAgICAgY29uc3QgdmFsdWUgPSBmcm9tKG5ld1ZhbHVlKTtcbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IE51bWJlci5pc05hTih2YWx1ZSBhcyBudW1iZXIpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB2YWx1ZTogJHtKU09OLnN0cmluZ2lmeShuZXdWYWx1ZSl9YCk7XG4gICAgICB9XG4gICAgICB0aGlzLnNldFJhd1ZhbHVlKGlkLCB2YWx1ZSk7XG4gICAgfTtcbiAgfVxuICBSZWZsZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgcHJvcGVydHlLZXksIGF0dHJpYnV0ZXMpO1xuICByZXR1cm4gW2lkLCBwcm9wZXJ0eUtleV07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRNaWJGaWxlKG1pYm5hbWU6IHN0cmluZykge1xuICByZXR1cm4gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL21pYnMvJywgYCR7bWlibmFtZX0ubWliLmpzb25gKTtcbn1cblxuY2xhc3MgRGV2aWNlUHJvdG90eXBlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIGltcGxlbWVudHMgSURldmljZSB7XG4gIC8vIHdpbGwgYmUgb3ZlcnJpZGUgZm9yIGFuIGluc3RhbmNlXG4gICRjb3VudFJlZiA9IDE7XG5cbiAgLy8gcHJpdmF0ZSAkZGVib3VuY2VEcmFpbiA9IF8uZGVib3VuY2UodGhpcy5kcmFpbiwgMjUpO1xuXG4gIGNvbnN0cnVjdG9yKG1pYm5hbWU6IHN0cmluZykge1xuICAgIHN1cGVyKCk7XG4gICAgY29uc3QgbWliZmlsZSA9IGdldE1pYkZpbGUobWlibmFtZSk7XG4gICAgY29uc3QgbWliVmFsaWRhdGlvbiA9IE1pYkRldmljZVYuZGVjb2RlKEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKG1pYmZpbGUpLnRvU3RyaW5nKCkpKTtcbiAgICBpZiAobWliVmFsaWRhdGlvbi5pc0xlZnQoKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIG1pYiBmaWxlICR7bWliZmlsZX0gJHtQYXRoUmVwb3J0ZXIucmVwb3J0KG1pYlZhbGlkYXRpb24pfWApO1xuICAgIH1cbiAgICBjb25zdCBtaWIgPSBtaWJWYWxpZGF0aW9uLnZhbHVlO1xuICAgIGNvbnN0IHsgdHlwZXMsIHN1YnJvdXRpbmVzIH0gPSBtaWI7XG4gICAgY29uc3QgZGV2aWNlID0gdHlwZXNbbWliLmRldmljZV0gYXMgSU1pYkRldmljZVR5cGU7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWliJywgbWlibmFtZSwgdGhpcyk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWliZmlsZScsIG1pYmZpbGUsIHRoaXMpO1xuICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2Fubm90YXRpb24nLCBkZXZpY2UuYW5ub3RhdGlvbiwgdGhpcyk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWliVmVyc2lvbicsIGRldmljZS5hcHBpbmZvLm1pYl92ZXJzaW9uLCB0aGlzKTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdkZXZpY2VUeXBlJywgdG9JbnQoZGV2aWNlLmFwcGluZm8uZGV2aWNlX3R5cGUpLCB0aGlzKTtcbiAgICBkZXZpY2UuYXBwaW5mby5sb2FkZXJfdHlwZSAmJiBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdsb2FkZXJUeXBlJyxcbiAgICAgIHRvSW50KGRldmljZS5hcHBpbmZvLmxvYWRlcl90eXBlKSwgdGhpcyxcbiAgICApO1xuICAgIGRldmljZS5hcHBpbmZvLmZpcm13YXJlICYmIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2Zpcm13YXJlJyxcbiAgICAgIGRldmljZS5hcHBpbmZvLmZpcm13YXJlLCB0aGlzLFxuICAgICk7XG4gICAgZGV2aWNlLmFwcGluZm8ubWluX3ZlcnNpb24gJiYgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWluX3ZlcnNpb24nLFxuICAgICAgZGV2aWNlLmFwcGluZm8ubWluX3ZlcnNpb24sIHRoaXMsXG4gICAgKTtcbiAgICB0eXBlcy5lcnJvclR5cGUgJiYgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YShcbiAgICAgICdlcnJvclR5cGUnLCAodHlwZXMuZXJyb3JUeXBlIGFzIElNaWJUeXBlKS5lbnVtZXJhdGlvbiwgdGhpcyk7XG5cbiAgICBpZiAoc3Vicm91dGluZXMpIHtcbiAgICAgIGNvbnN0IG1ldGFzdWJzID0gXy50cmFuc2Zvcm0oXG4gICAgICAgIHN1YnJvdXRpbmVzLFxuICAgICAgICAocmVzdWx0LCBzdWIsIG5hbWUpID0+IHtcbiAgICAgICAgICByZXN1bHRbbmFtZV0gPSB7XG4gICAgICAgICAgICBpZDogdG9JbnQoc3ViLmFwcGluZm8ubm1zX2lkKSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBzdWIuYW5ub3RhdGlvbixcbiAgICAgICAgICAgIGFyZ3M6IHN1Yi5wcm9wZXJ0aWVzICYmIE9iamVjdC5lbnRyaWVzKHN1Yi5wcm9wZXJ0aWVzKVxuICAgICAgICAgICAgICAubWFwKChbbmFtZSwgcHJvcF0pID0+ICh7XG4gICAgICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICAgICB0eXBlOiBnZXRObXNUeXBlKHByb3AudHlwZSksXG4gICAgICAgICAgICAgICAgZGVzYzogcHJvcC5hbm5vdGF0aW9uLFxuICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgfTtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9LFxuICAgICAgICB7fSBhcyBSZWNvcmQ8c3RyaW5nLCBJU3Vicm91dGluZURlc2M+LFxuICAgICAgKTtcbiAgICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ3N1YnJvdXRpbmVzJywgbWV0YXN1YnMsIHRoaXMpO1xuICAgIH1cblxuICAgIC8vIFRPRE86IGNhdGVnb3J5XG4gICAgLy8gY29uc3QgbWliQ2F0ZWdvcnkgPSBfLmZpbmQoZGV0ZWN0b3IuZGV0ZWN0aW9uIS5taWJDYXRlZ29yaWVzLCB7IG1pYjogbWlibmFtZSB9KTtcbiAgICAvLyBpZiAobWliQ2F0ZWdvcnkpIHtcbiAgICAvLyAgIGNvbnN0IHsgY2F0ZWdvcnksIGRpc2FibGVCYXRjaFJlYWRpbmcgfSA9IG1pYkNhdGVnb3J5O1xuICAgIC8vICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnY2F0ZWdvcnknLCBjYXRlZ29yeSwgdGhpcyk7XG4gICAgLy8gICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdkaXNhYmxlQmF0Y2hSZWFkaW5nJywgISFkaXNhYmxlQmF0Y2hSZWFkaW5nLCB0aGlzKTtcbiAgICAvLyB9XG5cbiAgICBjb25zdCBrZXlzID0gUmVmbGVjdC5vd25LZXlzKGRldmljZS5wcm9wZXJ0aWVzKSBhcyBzdHJpbmdbXTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtaWJQcm9wZXJ0aWVzJywga2V5cy5tYXAodmFsaWRKc05hbWUpLCB0aGlzKTtcbiAgICBjb25zdCBtYXA6IHsgW2lkOiBudW1iZXJdOiBzdHJpbmdbXSB9ID0ge307XG4gICAga2V5cy5mb3JFYWNoKChrZXk6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgW2lkLCBwcm9wTmFtZV0gPSBkZWZpbmVNaWJQcm9wZXJ0eSh0aGlzLCBrZXksIHR5cGVzLCBkZXZpY2UucHJvcGVydGllc1trZXldKTtcbiAgICAgIGlmICghbWFwW2lkXSkge1xuICAgICAgICBtYXBbaWRdID0gW3Byb3BOYW1lXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1hcFtpZF0ucHVzaChwcm9wTmFtZSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWFwJywgbWFwLCB0aGlzKTtcbiAgfVxuXG4gIHB1YmxpYyBnZXQgY29ubmVjdGlvbigpOiBOaWJ1c0Nvbm5lY3Rpb24gfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IHsgWyR2YWx1ZXNdOiB2YWx1ZXMgfSA9IHRoaXM7XG4gICAgcmV0dXJuIHZhbHVlc1tQcml2YXRlUHJvcHMuY29ubmVjdGlvbl07XG4gIH1cblxuICBwdWJsaWMgc2V0IGNvbm5lY3Rpb24odmFsdWU6IE5pYnVzQ29ubmVjdGlvbiB8IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IHsgWyR2YWx1ZXNdOiB2YWx1ZXMgfSA9IHRoaXM7XG4gICAgY29uc3QgcHJldiA9IHZhbHVlc1tQcml2YXRlUHJvcHMuY29ubmVjdGlvbl07XG4gICAgaWYgKHByZXYgPT09IHZhbHVlKSByZXR1cm47XG4gICAgdmFsdWVzW1ByaXZhdGVQcm9wcy5jb25uZWN0aW9uXSA9IHZhbHVlO1xuICAgIC8qKlxuICAgICAqIERldmljZSBjb25uZWN0ZWQgZXZlbnRcbiAgICAgKiBAZXZlbnQgSURldmljZSNjb25uZWN0ZWRcbiAgICAgKiBAZXZlbnQgSURldmljZSNkaXNjb25uZWN0ZWRcbiAgICAgKi9cbiAgICB0aGlzLmVtaXQodmFsdWUgIT0gbnVsbCA/ICdjb25uZWN0ZWQnIDogJ2Rpc2Nvbm5lY3RlZCcpO1xuICAgIC8vIGlmICh2YWx1ZSkge1xuICAgIC8vICAgdGhpcy5kcmFpbigpLmNhdGNoKCgpID0+IHt9KTtcbiAgICAvLyB9XG4gIH1cblxuICAvLyBub2luc3BlY3Rpb24gSlNVbnVzZWRHbG9iYWxTeW1ib2xzXG4gIHB1YmxpYyB0b0pTT04oKTogYW55IHtcbiAgICBjb25zdCBqc29uOiBhbnkgPSB7XG4gICAgICBtaWI6IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21pYicsIHRoaXMpLFxuICAgIH07XG4gICAgY29uc3Qga2V5czogc3RyaW5nW10gPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtaWJQcm9wZXJ0aWVzJywgdGhpcyk7XG4gICAga2V5cy5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgIGlmICh0aGlzW2tleV0gIT09IHVuZGVmaW5lZCkganNvbltrZXldID0gdGhpc1trZXldO1xuICAgIH0pO1xuICAgIGpzb24uYWRkcmVzcyA9IHRoaXMuYWRkcmVzcy50b1N0cmluZygpO1xuICAgIHJldHVybiBqc29uO1xuICB9XG5cbiAgcHVibGljIGdldElkKGlkT3JOYW1lOiBzdHJpbmcgfCBudW1iZXIpOiBudW1iZXIge1xuICAgIGxldCBpZDogbnVtYmVyO1xuICAgIGlmICh0eXBlb2YgaWRPck5hbWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICBpZCA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ2lkJywgdGhpcywgaWRPck5hbWUpO1xuICAgICAgaWYgKE51bWJlci5pc0ludGVnZXIoaWQpKSByZXR1cm4gaWQ7XG4gICAgICBpZCA9IHRvSW50KGlkT3JOYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWQgPSBpZE9yTmFtZTtcbiAgICB9XG4gICAgY29uc3QgbWFwID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWFwJywgdGhpcyk7XG4gICAgaWYgKCFSZWZsZWN0LmhhcyhtYXAsIGlkKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHByb3BlcnR5ICR7aWRPck5hbWV9YCk7XG4gICAgfVxuICAgIHJldHVybiBpZDtcbiAgfVxuXG4gIHB1YmxpYyBnZXROYW1lKGlkT3JOYW1lOiBzdHJpbmcgfCBudW1iZXIpOiBzdHJpbmcge1xuICAgIGNvbnN0IG1hcCA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21hcCcsIHRoaXMpO1xuICAgIGlmIChSZWZsZWN0LmhhcyhtYXAsIGlkT3JOYW1lKSkge1xuICAgICAgcmV0dXJuIG1hcFtpZE9yTmFtZV1bMF07XG4gICAgfVxuICAgIGNvbnN0IGtleXM6IHN0cmluZ1tdID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWliUHJvcGVydGllcycsIHRoaXMpO1xuICAgIGlmICh0eXBlb2YgaWRPck5hbWUgPT09ICdzdHJpbmcnICYmIGtleXMuaW5jbHVkZXMoaWRPck5hbWUpKSByZXR1cm4gaWRPck5hbWU7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHByb3BlcnR5ICR7aWRPck5hbWV9YCk7XG4gIH1cblxuICAvKlxuICAgIHB1YmxpYyB0b0lkcyhpZHNPck5hbWVzOiAoc3RyaW5nIHwgbnVtYmVyKVtdKTogbnVtYmVyW10ge1xuICAgICAgY29uc3QgbWFwID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWFwJywgdGhpcyk7XG4gICAgICByZXR1cm4gaWRzT3JOYW1lcy5tYXAoKGlkT3JOYW1lKSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgaWRPck5hbWUgPT09ICdzdHJpbmcnKVxuICAgICAgfSk7XG4gICAgfVxuICAqL1xuICBwdWJsaWMgZ2V0UmF3VmFsdWUoaWRPck5hbWU6IG51bWJlciB8IHN0cmluZyk6IGFueSB7XG4gICAgY29uc3QgaWQgPSB0aGlzLmdldElkKGlkT3JOYW1lKTtcbiAgICBjb25zdCB7IFskdmFsdWVzXTogdmFsdWVzIH0gPSB0aGlzO1xuICAgIHJldHVybiB2YWx1ZXNbaWRdO1xuICB9XG5cbiAgcHVibGljIHNldFJhd1ZhbHVlKGlkT3JOYW1lOiBudW1iZXIgfCBzdHJpbmcsIHZhbHVlOiBhbnksIGlzRGlydHkgPSB0cnVlKSB7XG4gICAgLy8gZGVidWcoYHNldFJhd1ZhbHVlKCR7aWRPck5hbWV9LCAke0pTT04uc3RyaW5naWZ5KHNhZmVOdW1iZXIodmFsdWUpKX0pYCk7XG4gICAgY29uc3QgaWQgPSB0aGlzLmdldElkKGlkT3JOYW1lKTtcbiAgICBjb25zdCB7IFskdmFsdWVzXTogdmFsdWVzLCBbJGVycm9yc106IGVycm9ycyB9ID0gdGhpcztcbiAgICBjb25zdCBuZXdWYWwgPSBzYWZlTnVtYmVyKHZhbHVlKTtcbiAgICBpZiAobmV3VmFsICE9PSB2YWx1ZXNbaWRdIHx8IGVycm9yc1tpZF0pIHtcbiAgICAgIHZhbHVlc1tpZF0gPSBuZXdWYWw7XG4gICAgICBkZWxldGUgZXJyb3JzW2lkXTtcbiAgICAgIHRoaXMuc2V0RGlydHkoaWQsIGlzRGlydHkpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBnZXRFcnJvcihpZE9yTmFtZTogbnVtYmVyIHwgc3RyaW5nKTogYW55IHtcbiAgICBjb25zdCBpZCA9IHRoaXMuZ2V0SWQoaWRPck5hbWUpO1xuICAgIGNvbnN0IHsgWyRlcnJvcnNdOiBlcnJvcnMgfSA9IHRoaXM7XG4gICAgcmV0dXJuIGVycm9yc1tpZF07XG4gIH1cblxuICBwdWJsaWMgc2V0RXJyb3IoaWRPck5hbWU6IG51bWJlciB8IHN0cmluZywgZXJyb3I/OiBFcnJvcikge1xuICAgIGNvbnN0IGlkID0gdGhpcy5nZXRJZChpZE9yTmFtZSk7XG4gICAgY29uc3QgeyBbJGVycm9yc106IGVycm9ycyB9ID0gdGhpcztcbiAgICBpZiAoZXJyb3IgIT0gbnVsbCkge1xuICAgICAgZXJyb3JzW2lkXSA9IGVycm9yO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgZXJyb3JzW2lkXTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgaXNEaXJ0eShpZE9yTmFtZTogc3RyaW5nIHwgbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgY29uc3QgaWQgPSB0aGlzLmdldElkKGlkT3JOYW1lKTtcbiAgICBjb25zdCB7IFskZGlydGllc106IGRpcnRpZXMgfSA9IHRoaXM7XG4gICAgcmV0dXJuICEhZGlydGllc1tpZF07XG4gIH1cblxuICBwdWJsaWMgc2V0RGlydHkoaWRPck5hbWU6IHN0cmluZyB8IG51bWJlciwgaXNEaXJ0eSA9IHRydWUpIHtcbiAgICBjb25zdCBpZCA9IHRoaXMuZ2V0SWQoaWRPck5hbWUpO1xuICAgIGNvbnN0IG1hcDogeyBbaWQ6IG51bWJlcl06IHN0cmluZ1tdIH0gPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBjb25zdCB7IFskZGlydGllc106IGRpcnRpZXMgfSA9IHRoaXM7XG4gICAgaWYgKGlzRGlydHkpIHtcbiAgICAgIGRpcnRpZXNbaWRdID0gdHJ1ZTtcbiAgICAgIC8vIFRPRE86IGltcGxlbWVudCBhdXRvc2F2ZVxuICAgICAgLy8gdGhpcy53cml0ZShpZCkuY2F0Y2goKCkgPT4ge30pO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgZGlydGllc1tpZF07XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEBldmVudCBJRGV2aWNlI2NoYW5nZWRcbiAgICAgKiBAZXZlbnQgSURldmljZSNjaGFuZ2luZ1xuICAgICAqL1xuICAgIGNvbnN0IG5hbWVzID0gbWFwW2lkXSB8fCBbXTtcbiAgICB0aGlzLmVtaXQoXG4gICAgICBpc0RpcnR5ID8gJ2NoYW5naW5nJyA6ICdjaGFuZ2VkJyxcbiAgICAgIHtcbiAgICAgICAgaWQsXG4gICAgICAgIG5hbWVzLFxuICAgICAgfSxcbiAgICApO1xuICAgIGlmIChuYW1lcy5pbmNsdWRlcygnc2Vybm8nKSAmJiAhaXNEaXJ0eVxuICAgICAgJiYgdGhpcy5hZGRyZXNzLnR5cGUgPT09IEFkZHJlc3NUeXBlLm1hYyAmJiB0eXBlb2YgdGhpcy5zZXJubyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5zZXJubztcbiAgICAgIGNvbnN0IHByZXZBZGRyZXNzID0gdGhpcy5hZGRyZXNzO1xuICAgICAgY29uc3QgYWRkcmVzcyA9IEJ1ZmZlci5mcm9tKHZhbHVlLnBhZFN0YXJ0KDEyLCAnMCcpLnN1YnN0cmluZyh2YWx1ZS5sZW5ndGggLSAxMiksICdoZXgnKTtcbiAgICAgIFJlZmxlY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2FkZHJlc3MnLCB3aXRoVmFsdWUobmV3IEFkZHJlc3MoYWRkcmVzcyksIGZhbHNlLCB0cnVlKSk7XG4gICAgICBkZXZpY2VzLmVtaXQoJ3Nlcm5vJywgcHJldkFkZHJlc3MsIHRoaXMuYWRkcmVzcyk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFkZHJlZigpIHtcbiAgICB0aGlzLiRjb3VudFJlZiArPSAxO1xuICAgIGRlYnVnKCdhZGRyZWYnLCBuZXcgRXJyb3IoJ2FkZHJlZicpLnN0YWNrKTtcbiAgICByZXR1cm4gdGhpcy4kY291bnRSZWY7XG4gIH1cblxuICBwdWJsaWMgcmVsZWFzZSgpIHtcbiAgICB0aGlzLiRjb3VudFJlZiAtPSAxO1xuICAgIGlmICh0aGlzLiRjb3VudFJlZiA8PSAwKSB7XG4gICAgICBjb25zdCBrZXkgPSB0aGlzLmFkZHJlc3MudG9TdHJpbmcoKTtcbiAgICAgIGRldmljZU1hcFtrZXldID0gXy53aXRob3V0KGRldmljZU1hcFtrZXldLCB0aGlzKTtcbiAgICAgIGlmIChkZXZpY2VNYXBba2V5XS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgZGVsZXRlIGRldmljZU1hcFtrZXldO1xuICAgICAgfVxuICAgICAgLyoqXG4gICAgICAgKiBAZXZlbnQgRGV2aWNlcyNkZWxldGVcbiAgICAgICAqL1xuICAgICAgZGV2aWNlcy5lbWl0KCdkZWxldGUnLCB0aGlzKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuJGNvdW50UmVmO1xuICB9XG5cbiAgcHVibGljIGRyYWluKCk6IFByb21pc2U8bnVtYmVyW10+IHtcbiAgICBkZWJ1ZyhgZHJhaW4gWyR7dGhpcy5hZGRyZXNzfV1gKTtcbiAgICBjb25zdCB7IFskZGlydGllc106IGRpcnRpZXMgfSA9IHRoaXM7XG4gICAgY29uc3QgaWRzID0gT2JqZWN0LmtleXMoZGlydGllcykubWFwKE51bWJlcikuZmlsdGVyKGlkID0+IGRpcnRpZXNbaWRdKTtcbiAgICByZXR1cm4gaWRzLmxlbmd0aCA+IDAgPyB0aGlzLndyaXRlKC4uLmlkcykuY2F0Y2goKCkgPT4gW10pIDogUHJvbWlzZS5yZXNvbHZlKFtdKTtcbiAgfVxuXG4gIHByaXZhdGUgd3JpdGVBbGwoKSB7XG4gICAgY29uc3QgeyBbJHZhbHVlc106IHZhbHVlcyB9ID0gdGhpcztcbiAgICBjb25zdCBtYXAgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBjb25zdCBpZHMgPSBPYmplY3QuZW50cmllcyh2YWx1ZXMpXG4gICAgICAuZmlsdGVyKChbLCB2YWx1ZV0pID0+IHZhbHVlICE9IG51bGwpXG4gICAgICAubWFwKChbaWRdKSA9PiBOdW1iZXIoaWQpKVxuICAgICAgLmZpbHRlcigoaWQgPT4gUmVmbGVjdC5nZXRNZXRhZGF0YSgnaXNXcml0YWJsZScsIHRoaXMsIG1hcFtpZF1bMF0pKSk7XG4gICAgcmV0dXJuIGlkcy5sZW5ndGggPiAwID8gdGhpcy53cml0ZSguLi5pZHMpIDogUHJvbWlzZS5yZXNvbHZlKFtdKTtcbiAgfVxuXG4gIHB1YmxpYyB3cml0ZSguLi5pZHM6IG51bWJlcltdKTogUHJvbWlzZTxudW1iZXJbXT4ge1xuICAgIGNvbnN0IHsgY29ubmVjdGlvbiB9ID0gdGhpcztcbiAgICBpZiAoIWNvbm5lY3Rpb24pIHJldHVybiBQcm9taXNlLnJlamVjdChgJHt0aGlzLmFkZHJlc3N9IGlzIGRpc2Nvbm5lY3RlZGApO1xuICAgIGlmIChpZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gdGhpcy53cml0ZUFsbCgpO1xuICAgIH1cbiAgICBkZWJ1Zyhgd3JpdGluZyAke2lkcy5qb2luKCl9IHRvIFske3RoaXMuYWRkcmVzc31dYCk7XG4gICAgY29uc3QgbWFwID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWFwJywgdGhpcyk7XG4gICAgY29uc3QgcmVxdWVzdHMgPSBpZHMucmVkdWNlKFxuICAgICAgKGFjYzogTm1zRGF0YWdyYW1bXSwgaWQpID0+IHtcbiAgICAgICAgY29uc3QgW25hbWVdID0gbWFwW2lkXTtcbiAgICAgICAgaWYgKCFuYW1lKSB7XG4gICAgICAgICAgZGVidWcoYFVua25vd24gaWQ6ICR7aWR9IGZvciAke1JlZmxlY3QuZ2V0TWV0YWRhdGEoJ21pYicsIHRoaXMpfWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGFjYy5wdXNoKGNyZWF0ZU5tc1dyaXRlKFxuICAgICAgICAgICAgdGhpcy5hZGRyZXNzLFxuICAgICAgICAgICAgaWQsXG4gICAgICAgICAgICBSZWZsZWN0LmdldE1ldGFkYXRhKCdubXNUeXBlJywgdGhpcywgbmFtZSksXG4gICAgICAgICAgICB0aGlzLmdldFJhd1ZhbHVlKGlkKSxcbiAgICAgICAgICApKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgfSxcbiAgICAgIFtdLFxuICAgICk7XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKFxuICAgICAgcmVxdWVzdHNcbiAgICAgICAgLm1hcChkYXRhZ3JhbSA9PiBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShkYXRhZ3JhbSlcbiAgICAgICAgICAudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHsgc3RhdHVzIH0gPSByZXNwb25zZSBhcyBObXNEYXRhZ3JhbTtcbiAgICAgICAgICAgIGlmIChzdGF0dXMgPT09IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5zZXREaXJ0eShkYXRhZ3JhbS5pZCwgZmFsc2UpO1xuICAgICAgICAgICAgICByZXR1cm4gZGF0YWdyYW0uaWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnNldEVycm9yKGRhdGFncmFtLmlkLCBuZXcgTmlidXNFcnJvcihzdGF0dXMhLCB0aGlzKSk7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgfSwgKHJlYXNvbikgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXRFcnJvcihkYXRhZ3JhbS5pZCwgcmVhc29uKTtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICB9KSkpXG4gICAgICAudGhlbihpZHMgPT4gaWRzLmZpbHRlcihpZCA9PiBpZCA+IDApKTtcbiAgfVxuXG4gIHB1YmxpYyB3cml0ZVZhbHVlcyhzb3VyY2U6IG9iamVjdCwgc3Ryb25nID0gdHJ1ZSk6IFByb21pc2U8bnVtYmVyW10+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgaWRzID0gT2JqZWN0LmtleXMoc291cmNlKS5tYXAobmFtZSA9PiB0aGlzLmdldElkKG5hbWUpKTtcbiAgICAgIGlmIChpZHMubGVuZ3RoID09PSAwKSByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IFR5cGVFcnJvcigndmFsdWUgaXMgZW1wdHknKSk7XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMsIHNvdXJjZSk7XG4gICAgICByZXR1cm4gdGhpcy53cml0ZSguLi5pZHMpXG4gICAgICAgIC50aGVuKCh3cml0dGVuKSA9PiB7XG4gICAgICAgICAgaWYgKHdyaXR0ZW4ubGVuZ3RoID09PSAwIHx8IChzdHJvbmcgJiYgd3JpdHRlbi5sZW5ndGggIT09IGlkcy5sZW5ndGgpKSB7XG4gICAgICAgICAgICB0aHJvdyB0aGlzLmdldEVycm9yKGlkc1swXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB3cml0dGVuO1xuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcmVhZEFsbCgpOiBQcm9taXNlPGFueT4ge1xuICAgIGlmICh0aGlzLiRyZWFkKSByZXR1cm4gdGhpcy4kcmVhZDtcbiAgICBjb25zdCBtYXA6IHsgW2lkOiBzdHJpbmddOiBzdHJpbmdbXSB9ID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWFwJywgdGhpcyk7XG4gICAgY29uc3QgaWRzID0gT2JqZWN0LmVudHJpZXMobWFwKVxuICAgICAgLmZpbHRlcigoWywgbmFtZXNdKSA9PiBSZWZsZWN0LmdldE1ldGFkYXRhKCdpc1JlYWRhYmxlJywgdGhpcywgbmFtZXNbMF0pKVxuICAgICAgLm1hcCgoW2lkXSkgPT4gTnVtYmVyKGlkKSlcbiAgICAgIC5zb3J0KCk7XG4gICAgdGhpcy4kcmVhZCA9IGlkcy5sZW5ndGggPiAwID8gdGhpcy5yZWFkKC4uLmlkcykgOiBQcm9taXNlLnJlc29sdmUoW10pO1xuICAgIGNvbnN0IGNsZWFyID0gKCkgPT4gZGVsZXRlIHRoaXMuJHJlYWQ7XG4gICAgcmV0dXJuIHRoaXMuJHJlYWQuZmluYWxseShjbGVhcik7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcmVhZCguLi5pZHM6IG51bWJlcltdKTogUHJvbWlzZTx7IFtuYW1lOiBzdHJpbmddOiBhbnkgfT4ge1xuICAgIGNvbnN0IHsgY29ubmVjdGlvbiB9ID0gdGhpcztcbiAgICBpZiAoIWNvbm5lY3Rpb24pIHJldHVybiBQcm9taXNlLnJlamVjdCgnZGlzY29ubmVjdGVkJyk7XG4gICAgaWYgKGlkcy5sZW5ndGggPT09IDApIHJldHVybiB0aGlzLnJlYWRBbGwoKTtcbiAgICAvLyBkZWJ1ZyhgcmVhZCAke2lkcy5qb2luKCl9IGZyb20gWyR7dGhpcy5hZGRyZXNzfV1gKTtcbiAgICBjb25zdCBkaXNhYmxlQmF0Y2hSZWFkaW5nID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnZGlzYWJsZUJhdGNoUmVhZGluZycsIHRoaXMpO1xuICAgIGNvbnN0IG1hcDogeyBbaWQ6IHN0cmluZ106IHN0cmluZ1tdIH0gPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBjb25zdCBjaHVua3MgPSBjaHVua0FycmF5KGlkcywgZGlzYWJsZUJhdGNoUmVhZGluZyA/IDEgOiAyMSk7XG4gICAgZGVidWcoYHJlYWQgWyR7Y2h1bmtzLm1hcChjaHVuayA9PiBgWyR7Y2h1bmsuam9pbigpfV1gKS5qb2luKCl9XSBmcm9tIFske3RoaXMuYWRkcmVzc31dYCk7XG4gICAgY29uc3QgcmVxdWVzdHMgPSBjaHVua3MubWFwKGNodW5rID0+IGNyZWF0ZU5tc1JlYWQodGhpcy5hZGRyZXNzLCAuLi5jaHVuaykpO1xuICAgIHJldHVybiByZXF1ZXN0cy5yZWR1Y2UoXG4gICAgICBhc3luYyAocHJvbWlzZSwgZGF0YWdyYW0pID0+IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvbWlzZTtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShkYXRhZ3JhbSk7XG4gICAgICAgIGNvbnN0IGRhdGFncmFtczogTm1zRGF0YWdyYW1bXSA9IEFycmF5LmlzQXJyYXkocmVzcG9uc2UpXG4gICAgICAgICAgPyByZXNwb25zZSBhcyBObXNEYXRhZ3JhbVtdXG4gICAgICAgICAgOiBbcmVzcG9uc2UgYXMgTm1zRGF0YWdyYW1dO1xuICAgICAgICBkYXRhZ3JhbXMuZm9yRWFjaCgoeyBpZCwgdmFsdWUsIHN0YXR1cyB9KSA9PiB7XG4gICAgICAgICAgaWYgKHN0YXR1cyA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5zZXRSYXdWYWx1ZShpZCwgdmFsdWUsIGZhbHNlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zZXRFcnJvcihpZCwgbmV3IE5pYnVzRXJyb3Ioc3RhdHVzISwgdGhpcykpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBuYW1lcyA9IG1hcFtpZF07XG4gICAgICAgICAgY29uc29sZS5hc3NlcnQobmFtZXMgJiYgbmFtZXMubGVuZ3RoID4gMCwgYEludmFsaWQgaWQgJHtpZH1gKTtcbiAgICAgICAgICBuYW1lcy5mb3JFYWNoKChwcm9wTmFtZSkgPT4ge1xuICAgICAgICAgICAgcmVzdWx0W3Byb3BOYW1lXSA9IHN0YXR1cyA9PT0gMFxuICAgICAgICAgICAgICA/IHRoaXNbcHJvcE5hbWVdXG4gICAgICAgICAgICAgIDogeyBlcnJvcjogKHRoaXMuZ2V0RXJyb3IoaWQpIHx8IHt9KS5tZXNzYWdlIHx8ICdlcnJvcicgfTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9LFxuICAgICAgUHJvbWlzZS5yZXNvbHZlKHt9IGFzIHsgW25hbWU6IHN0cmluZ106IGFueSB9KSxcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgdXBsb2FkKGRvbWFpbjogc3RyaW5nLCBvZmZzZXQgPSAwLCBzaXplPzogbnVtYmVyKTogUHJvbWlzZTxCdWZmZXI+IHtcbiAgICBjb25zdCB7IGNvbm5lY3Rpb24gfSA9IHRoaXM7XG4gICAgdHJ5IHtcbiAgICAgIGlmICghY29ubmVjdGlvbikgdGhyb3cgbmV3IEVycm9yKCdkaXNjb25uZWN0ZWQnKTtcbiAgICAgIGNvbnN0IHJlcVVwbG9hZCA9IGNyZWF0ZU5tc1JlcXVlc3REb21haW5VcGxvYWQodGhpcy5hZGRyZXNzLCBkb21haW4ucGFkRW5kKDgsICdcXDAnKSk7XG4gICAgICBjb25zdCB7IGlkLCB2YWx1ZTogZG9tYWluU2l6ZSwgc3RhdHVzIH0gPVxuICAgICAgICBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShyZXFVcGxvYWQpIGFzIE5tc0RhdGFncmFtO1xuICAgICAgaWYgKHN0YXR1cyAhPT0gMCkge1xuICAgICAgICAvLyBkZWJ1ZygnPGVycm9yPicsIHN0YXR1cyk7XG4gICAgICAgIHRocm93IG5ldyBOaWJ1c0Vycm9yKHN0YXR1cyEsIHRoaXMsICdSZXF1ZXN0IHVwbG9hZCBkb21haW4gZXJyb3InKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGluaXRVcGxvYWQgPSBjcmVhdGVObXNJbml0aWF0ZVVwbG9hZFNlcXVlbmNlKHRoaXMuYWRkcmVzcywgaWQpO1xuICAgICAgY29uc3QgeyBzdGF0dXM6IGluaXRTdGF0IH0gPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShpbml0VXBsb2FkKSBhcyBObXNEYXRhZ3JhbTtcbiAgICAgIGlmIChpbml0U3RhdCAhPT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgTmlidXNFcnJvcihpbml0U3RhdCEsIHRoaXMsICdJbml0aWF0ZSB1cGxvYWQgZG9tYWluIGVycm9yJyk7XG4gICAgICB9XG4gICAgICBjb25zdCB0b3RhbCA9IHNpemUgfHwgKGRvbWFpblNpemUgLSBvZmZzZXQpO1xuICAgICAgbGV0IHJlc3QgPSB0b3RhbDtcbiAgICAgIGxldCBwb3MgPSBvZmZzZXQ7XG4gICAgICB0aGlzLmVtaXQoXG4gICAgICAgICd1cGxvYWRTdGFydCcsXG4gICAgICAgIHtcbiAgICAgICAgICBkb21haW4sXG4gICAgICAgICAgZG9tYWluU2l6ZSxcbiAgICAgICAgICBvZmZzZXQsXG4gICAgICAgICAgc2l6ZTogdG90YWwsXG4gICAgICAgIH0sXG4gICAgICApO1xuICAgICAgY29uc3QgYnVmczogQnVmZmVyW10gPSBbXTtcbiAgICAgIHdoaWxlIChyZXN0ID4gMCkge1xuICAgICAgICBjb25zdCBsZW5ndGggPSBNYXRoLm1pbigyNTUsIHJlc3QpO1xuICAgICAgICBjb25zdCB1cGxvYWRTZWdtZW50ID0gY3JlYXRlTm1zVXBsb2FkU2VnbWVudCh0aGlzLmFkZHJlc3MsIGlkLCBwb3MsIGxlbmd0aCk7XG4gICAgICAgIGNvbnN0IHsgc3RhdHVzOiB1cGxvYWRTdGF0dXMsIHZhbHVlOiByZXN1bHQgfSA9XG4gICAgICAgICAgYXdhaXQgY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0odXBsb2FkU2VnbWVudCkgYXMgTm1zRGF0YWdyYW07XG4gICAgICAgIGlmICh1cGxvYWRTdGF0dXMgIT09IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgTmlidXNFcnJvcih1cGxvYWRTdGF0dXMhLCB0aGlzLCAnVXBsb2FkIHNlZ21lbnQgZXJyb3InKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVzdWx0LmRhdGEubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgYnVmcy5wdXNoKHJlc3VsdC5kYXRhKTtcbiAgICAgICAgdGhpcy5lbWl0KFxuICAgICAgICAgICd1cGxvYWREYXRhJyxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBkb21haW4sXG4gICAgICAgICAgICBwb3MsXG4gICAgICAgICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgICAgICB9LFxuICAgICAgICApO1xuICAgICAgICByZXN0IC09IHJlc3VsdC5kYXRhLmxlbmd0aDtcbiAgICAgICAgcG9zICs9IHJlc3VsdC5kYXRhLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHJlc3VsdCA9IEJ1ZmZlci5jb25jYXQoYnVmcyk7XG4gICAgICB0aGlzLmVtaXQoXG4gICAgICAgICd1cGxvYWRGaW5pc2gnLFxuICAgICAgICB7XG4gICAgICAgICAgZG9tYWluLFxuICAgICAgICAgIG9mZnNldCxcbiAgICAgICAgICBkYXRhOiByZXN1bHQsXG4gICAgICAgIH0sXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLmVtaXQoJ3VwbG9hZEVycm9yJywgZSk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGRvd25sb2FkKGRvbWFpbjogc3RyaW5nLCBidWZmZXI6IEJ1ZmZlciwgb2Zmc2V0ID0gMCwgbm9UZXJtID0gZmFsc2UpIHtcbiAgICBjb25zdCB7IGNvbm5lY3Rpb24gfSA9IHRoaXM7XG4gICAgaWYgKCFjb25uZWN0aW9uKSB0aHJvdyBuZXcgRXJyb3IoJ2Rpc2Nvbm5lY3RlZCcpO1xuICAgIGNvbnN0IHJlcURvd25sb2FkID0gY3JlYXRlTm1zUmVxdWVzdERvbWFpbkRvd25sb2FkKHRoaXMuYWRkcmVzcywgZG9tYWluLnBhZEVuZCg4LCAnXFwwJykpO1xuICAgIGNvbnN0IHsgaWQsIHZhbHVlOiBtYXgsIHN0YXR1cyB9ID0gYXdhaXQgY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0ocmVxRG93bmxvYWQpIGFzIE5tc0RhdGFncmFtO1xuICAgIGlmIChzdGF0dXMgIT09IDApIHtcbiAgICAgIC8vIGRlYnVnKCc8ZXJyb3I+Jywgc3RhdHVzKTtcbiAgICAgIHRocm93IG5ldyBOaWJ1c0Vycm9yKHN0YXR1cyEsIHRoaXMsICdSZXF1ZXN0IGRvd25sb2FkIGRvbWFpbiBlcnJvcicpO1xuICAgIH1cbiAgICBjb25zdCB0ZXJtaW5hdGUgPSBhc3luYyAoZXJyPzogRXJyb3IpID0+IHtcbiAgICAgIGxldCB0ZXJtU3RhdCA9IDA7XG4gICAgICBpZiAoIW5vVGVybSkge1xuICAgICAgICBjb25zdCByZXEgPSBjcmVhdGVObXNUZXJtaW5hdGVEb3dubG9hZFNlcXVlbmNlKHRoaXMuYWRkcmVzcywgaWQpO1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShyZXEpIGFzIE5tc0RhdGFncmFtO1xuICAgICAgICB0ZXJtU3RhdCA9IHJlcy5zdGF0dXMhO1xuICAgICAgfVxuICAgICAgaWYgKGVycikgdGhyb3cgZXJyO1xuICAgICAgaWYgKHRlcm1TdGF0ICE9PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBOaWJ1c0Vycm9yKFxuICAgICAgICAgIHRlcm1TdGF0ISxcbiAgICAgICAgICB0aGlzLFxuICAgICAgICAgICdUZXJtaW5hdGUgZG93bmxvYWQgc2VxdWVuY2UgZXJyb3IsIG1heWJlIG5lZWQgLS1uby10ZXJtJyxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGlmIChidWZmZXIubGVuZ3RoID4gbWF4IC0gb2Zmc2V0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEJ1ZmZlciB0byBsYXJnZS4gRXhwZWN0ZWQgJHttYXggLSBvZmZzZXR9IGJ5dGVzYCk7XG4gICAgfVxuICAgIGNvbnN0IGluaXREb3dubG9hZCA9IGNyZWF0ZU5tc0luaXRpYXRlRG93bmxvYWRTZXF1ZW5jZSh0aGlzLmFkZHJlc3MsIGlkKTtcbiAgICBjb25zdCB7IHN0YXR1czogaW5pdFN0YXQgfSA9IGF3YWl0IGNvbm5lY3Rpb24uc2VuZERhdGFncmFtKGluaXREb3dubG9hZCkgYXMgTm1zRGF0YWdyYW07XG4gICAgaWYgKGluaXRTdGF0ICE9PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgTmlidXNFcnJvcihpbml0U3RhdCEsIHRoaXMsICdJbml0aWF0ZSBkb3dubG9hZCBkb21haW4gZXJyb3InKTtcbiAgICB9XG4gICAgdGhpcy5lbWl0KFxuICAgICAgJ2Rvd25sb2FkU3RhcnQnLFxuICAgICAge1xuICAgICAgICBkb21haW4sXG4gICAgICAgIG9mZnNldCxcbiAgICAgICAgZG9tYWluU2l6ZTogbWF4LFxuICAgICAgICBzaXplOiBidWZmZXIubGVuZ3RoLFxuICAgICAgfSxcbiAgICApO1xuICAgIGNvbnN0IGNyYyA9IGNyYzE2Y2NpdHQoYnVmZmVyLCAwKTtcbiAgICBjb25zdCBjaHVua1NpemUgPSBOTVNfTUFYX0RBVEFfTEVOR1RIIC0gNDtcbiAgICBjb25zdCBjaHVua3MgPSBjaHVua0FycmF5KGJ1ZmZlciwgY2h1bmtTaXplKTtcbiAgICBhd2FpdCBjaHVua3MucmVkdWNlKGFzeW5jIChwcmV2LCBjaHVuazogQnVmZmVyLCBpKSA9PiB7XG4gICAgICBhd2FpdCBwcmV2O1xuICAgICAgY29uc3QgcG9zID0gaSAqIGNodW5rU2l6ZSArIG9mZnNldDtcbiAgICAgIGNvbnN0IHNlZ21lbnREb3dubG9hZCA9XG4gICAgICAgIGNyZWF0ZU5tc0Rvd25sb2FkU2VnbWVudCh0aGlzLmFkZHJlc3MsIGlkISwgcG9zLCBjaHVuayk7XG4gICAgICBjb25zdCB7IHN0YXR1czogZG93bmxvYWRTdGF0IH0gPVxuICAgICAgICBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShzZWdtZW50RG93bmxvYWQpIGFzIE5tc0RhdGFncmFtO1xuICAgICAgaWYgKGRvd25sb2FkU3RhdCAhPT0gMCkge1xuICAgICAgICBhd2FpdCB0ZXJtaW5hdGUobmV3IE5pYnVzRXJyb3IoZG93bmxvYWRTdGF0ISwgdGhpcywgJ0Rvd25sb2FkIHNlZ21lbnQgZXJyb3InKSk7XG4gICAgICB9XG4gICAgICB0aGlzLmVtaXQoXG4gICAgICAgICdkb3dubG9hZERhdGEnLFxuICAgICAgICB7XG4gICAgICAgICAgZG9tYWluLFxuICAgICAgICAgIGxlbmd0aDogY2h1bmsubGVuZ3RoLFxuICAgICAgICB9LFxuICAgICAgKTtcbiAgICB9LCBQcm9taXNlLnJlc29sdmUoKSk7XG4gICAgY29uc3QgdmVyaWZ5ID0gY3JlYXRlTm1zVmVyaWZ5RG9tYWluQ2hlY2tzdW0odGhpcy5hZGRyZXNzLCBpZCwgb2Zmc2V0LCBidWZmZXIubGVuZ3RoLCBjcmMpO1xuICAgIGNvbnN0IHsgc3RhdHVzOiB2ZXJpZnlTdGF0IH0gPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbSh2ZXJpZnkpIGFzIE5tc0RhdGFncmFtO1xuICAgIGlmICh2ZXJpZnlTdGF0ICE9PSAwKSB7XG4gICAgICBhd2FpdCB0ZXJtaW5hdGUobmV3IE5pYnVzRXJyb3IodmVyaWZ5U3RhdCEsIHRoaXMsICdEb3dubG9hZCBzZWdtZW50IGVycm9yJykpO1xuICAgIH1cbiAgICBhd2FpdCB0ZXJtaW5hdGUoKTtcbiAgICB0aGlzLmVtaXQoXG4gICAgICAnZG93bmxvYWRGaW5pc2gnLFxuICAgICAge1xuICAgICAgICBkb21haW4sXG4gICAgICAgIG9mZnNldCxcbiAgICAgICAgc2l6ZTogYnVmZmVyLmxlbmd0aCxcbiAgICAgIH0sXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIGV4ZWN1dGUocHJvZ3JhbTogc3RyaW5nLCBhcmdzPzogUmVjb3JkPHN0cmluZywgYW55Pikge1xuICAgIGNvbnN0IHsgY29ubmVjdGlvbiB9ID0gdGhpcztcbiAgICBpZiAoIWNvbm5lY3Rpb24pIHRocm93IG5ldyBFcnJvcignZGlzY29ubmVjdGVkJyk7XG4gICAgY29uc3Qgc3Vicm91dGluZXMgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdzdWJyb3V0aW5lcycsIHRoaXMpIGFzIFJlY29yZDxzdHJpbmcsIElTdWJyb3V0aW5lRGVzYz47XG4gICAgaWYgKCFzdWJyb3V0aW5lcyB8fCAhUmVmbGVjdC5oYXMoc3Vicm91dGluZXMsIHByb2dyYW0pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gcHJvZ3JhbSAke3Byb2dyYW19YCk7XG4gICAgfVxuICAgIGNvbnN0IHN1YnJvdXRpbmUgPSBzdWJyb3V0aW5lc1twcm9ncmFtXTtcbiAgICBjb25zdCBwcm9wczogVHlwZWRWYWx1ZVtdID0gW107XG4gICAgaWYgKHN1YnJvdXRpbmUuYXJncykge1xuICAgICAgT2JqZWN0LmVudHJpZXMoc3Vicm91dGluZS5hcmdzKS5mb3JFYWNoKChbbmFtZSwgZGVzY10pID0+IHtcbiAgICAgICAgY29uc3QgYXJnID0gYXJncyAmJiBhcmdzW25hbWVdO1xuICAgICAgICBpZiAoIWFyZykgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBhcmcgJHtuYW1lfSBpbiBwcm9ncmFtICR7cHJvZ3JhbX1gKTtcbiAgICAgICAgcHJvcHMucHVzaChbZGVzYy50eXBlLCBhcmddKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBjb25zdCByZXEgPSBjcmVhdGVFeGVjdXRlUHJvZ3JhbUludm9jYXRpb24oXG4gICAgICB0aGlzLmFkZHJlc3MsXG4gICAgICBzdWJyb3V0aW5lLmlkLFxuICAgICAgc3Vicm91dGluZS5ub3RSZXBseSxcbiAgICAgIC4uLnByb3BzLFxuICAgICk7XG4gICAgcmV0dXJuIGNvbm5lY3Rpb24uc2VuZERhdGFncmFtKHJlcSk7XG4gIH1cbn1cblxuLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lXG5pbnRlcmZhY2UgRGV2aWNlUHJvdG90eXBlIHtcbiAgcmVhZG9ubHkgaWQ6IERldmljZUlkO1xuICByZWFkb25seSBhZGRyZXNzOiBBZGRyZXNzO1xuICBbbWliUHJvcGVydHk6IHN0cmluZ106IGFueTtcbiAgJGNvdW50UmVmOiBudW1iZXI7XG4gICRyZWFkPzogUHJvbWlzZTxhbnk+O1xuICBbJHZhbHVlc106IHsgW2lkOiBudW1iZXJdOiBhbnkgfTtcbiAgWyRlcnJvcnNdOiB7IFtpZDogbnVtYmVyXTogRXJyb3IgfTtcbiAgWyRkaXJ0aWVzXTogeyBbaWQ6IG51bWJlcl06IGJvb2xlYW4gfTtcbn1cblxuZXhwb3J0IGNvbnN0IGdldE1pYlR5cGVzID0gKCkgPT4ge1xuICBjb25zdCBjb25mID0gcGF0aC5yZXNvbHZlKGNvbmZpZ0RpciB8fCAnL3RtcCcsICdjb25maWdzdG9yZScsIHBrZ05hbWUpO1xuICBjb25zdCB2YWxpZGF0ZSA9IENvbmZpZ1YuZGVjb2RlKEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKGAke2NvbmZ9Lmpzb25gKS50b1N0cmluZygpKSk7XG4vLyAgIGNvbnN0IHZhbGlkYXRlID0gQ29uZmlnVi5kZWNvZGUocmVxdWlyZShjb25mKSk7XG4gIGlmICh2YWxpZGF0ZS5pc0xlZnQoKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBjb25maWcgZmlsZSAke2NvbmZ9XG4gICR7UGF0aFJlcG9ydGVyLnJlcG9ydCh2YWxpZGF0ZSl9YCk7XG4gIH1cbiAgY29uc3QgeyBtaWJUeXBlcyB9ID0gdmFsaWRhdGUudmFsdWU7XG4gIHJldHVybiBtaWJUeXBlcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbmRNaWJCeVR5cGUodHlwZTogbnVtYmVyLCB2ZXJzaW9uPzogbnVtYmVyKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgY29uc3QgbWliVHlwZXMgPSBnZXRNaWJUeXBlcygpO1xuICBjb25zdCBtaWJzID0gbWliVHlwZXMhW3R5cGVdO1xuICBpZiAobWlicyAmJiBtaWJzLmxlbmd0aCkge1xuICAgIGxldCBtaWJUeXBlID0gbWlic1swXTtcbiAgICBpZiAodmVyc2lvbiAmJiBtaWJzLmxlbmd0aCA+IDEpIHtcbiAgICAgIG1pYlR5cGUgPSBfLmZpbmRMYXN0KG1pYnMsICh7IG1pblZlcnNpb24gPSAwIH0pID0+IG1pblZlcnNpb24gPD0gdmVyc2lvbikgfHwgbWliVHlwZTtcbiAgICB9XG4gICAgcmV0dXJuIG1pYlR5cGUubWliO1xuICB9XG4gIC8vIGNvbnN0IGNhY2hlTWlicyA9IE9iamVjdC5rZXlzKG1pYlR5cGVzQ2FjaGUpO1xuICAvLyBjb25zdCBjYWNoZWQgPSBjYWNoZU1pYnMuZmluZChtaWIgPT5cbiAgLy8gICBSZWZsZWN0LmdldE1ldGFkYXRhKCdkZXZpY2VUeXBlJywgbWliVHlwZXNDYWNoZVttaWJdLnByb3RvdHlwZSkgPT09IHR5cGUpO1xuICAvLyBpZiAoY2FjaGVkKSByZXR1cm4gY2FjaGVkO1xuICAvLyBjb25zdCBtaWJzID0gZ2V0TWlic1N5bmMoKTtcbiAgLy8gcmV0dXJuIF8uZGlmZmVyZW5jZShtaWJzLCBjYWNoZU1pYnMpLmZpbmQoKG1pYk5hbWUpID0+IHtcbiAgLy8gICBjb25zdCBtaWJmaWxlID0gZ2V0TWliRmlsZShtaWJOYW1lKTtcbiAgLy8gICBjb25zdCBtaWI6IElNaWJEZXZpY2UgPSByZXF1aXJlKG1pYmZpbGUpO1xuICAvLyAgIGNvbnN0IHsgdHlwZXMgfSA9IG1pYjtcbiAgLy8gICBjb25zdCBkZXZpY2UgPSB0eXBlc1ttaWIuZGV2aWNlXSBhcyBJTWliRGV2aWNlVHlwZTtcbiAgLy8gICByZXR1cm4gdG9JbnQoZGV2aWNlLmFwcGluZm8uZGV2aWNlX3R5cGUpID09PSB0eXBlO1xuICAvLyB9KTtcbn1cblxuZXhwb3J0IGRlY2xhcmUgaW50ZXJmYWNlIERldmljZXMge1xuICBvbihldmVudDogJ25ldycgfCAnZGVsZXRlJywgZGV2aWNlTGlzdGVuZXI6IChkZXZpY2U6IElEZXZpY2UpID0+IHZvaWQpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnbmV3JyB8ICdkZWxldGUnLCBkZXZpY2VMaXN0ZW5lcjogKGRldmljZTogSURldmljZSkgPT4gdm9pZCk6IHRoaXM7XG4gIGFkZExpc3RlbmVyKGV2ZW50OiAnbmV3JyB8ICdkZWxldGUnLCBkZXZpY2VMaXN0ZW5lcjogKGRldmljZTogSURldmljZSkgPT4gdm9pZCk6IHRoaXM7XG4gIG9uKGV2ZW50OiAnc2Vybm8nLCBsaXN0ZW5lcjogKHByZXZBZGRyZXNzOiBBZGRyZXNzLCBuZXdBZGRyZXNzOiBBZGRyZXNzKSA9PiB2b2lkKTogdGhpcztcbiAgb25jZShldmVudDogJ3Nlcm5vJywgbGlzdGVuZXI6IChwcmV2QWRkcmVzczogQWRkcmVzcywgbmV3QWRkcmVzczogQWRkcmVzcykgPT4gdm9pZCk6IHRoaXM7XG4gIGFkZExpc3RlbmVyKGV2ZW50OiAnc2Vybm8nLCBsaXN0ZW5lcjogKHByZXZBZGRyZXNzOiBBZGRyZXNzLCBuZXdBZGRyZXNzOiBBZGRyZXNzKSA9PiB2b2lkKTogdGhpcztcbn1cblxuZnVuY3Rpb24gZ2V0Q29uc3RydWN0b3IobWliOiBzdHJpbmcpOiBGdW5jdGlvbiB7XG4gIGxldCBjb25zdHJ1Y3RvciA9IG1pYlR5cGVzQ2FjaGVbbWliXTtcbiAgaWYgKCFjb25zdHJ1Y3Rvcikge1xuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZVxuICAgIGZ1bmN0aW9uIERldmljZSh0aGlzOiBEZXZpY2VQcm90b3R5cGUsIGFkZHJlc3M6IEFkZHJlc3MpIHtcbiAgICAgIEV2ZW50RW1pdHRlci5hcHBseSh0aGlzKTtcbiAgICAgIHRoaXNbJHZhbHVlc10gPSB7fTtcbiAgICAgIHRoaXNbJGVycm9yc10gPSB7fTtcbiAgICAgIHRoaXNbJGRpcnRpZXNdID0ge307XG4gICAgICBSZWZsZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdhZGRyZXNzJywgd2l0aFZhbHVlKGFkZHJlc3MsIGZhbHNlLCB0cnVlKSk7XG4gICAgICB0aGlzLiRjb3VudFJlZiA9IDE7XG4gICAgICAodGhpcyBhcyBhbnkpLmlkID0gdGltZWlkKCkgYXMgRGV2aWNlSWQ7XG4gICAgICAvLyBkZWJ1ZyhuZXcgRXJyb3IoJ0NSRUFURScpLnN0YWNrKTtcbiAgICB9XG5cbiAgICBjb25zdCBwcm90b3R5cGUgPSBuZXcgRGV2aWNlUHJvdG90eXBlKG1pYik7XG4gICAgRGV2aWNlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUocHJvdG90eXBlKTtcbiAgICAoRGV2aWNlIGFzIGFueSkuZGlzcGxheU5hbWUgPSBgJHttaWJbMF0udG9VcHBlckNhc2UoKX0ke21pYi5zbGljZSgxKX1gO1xuICAgIGNvbnN0cnVjdG9yID0gRGV2aWNlO1xuICAgIG1pYlR5cGVzQ2FjaGVbbWliXSA9IGNvbnN0cnVjdG9yO1xuICB9XG4gIHJldHVybiBjb25zdHJ1Y3Rvcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE1pYlByb3RvdHlwZShtaWI6IHN0cmluZyk6IE9iamVjdCB7XG4gIHJldHVybiBnZXRDb25zdHJ1Y3RvcihtaWIpLnByb3RvdHlwZTtcbn1cblxuZXhwb3J0IGNsYXNzIERldmljZXMgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICBnZXQgPSAoKTogSURldmljZVtdID0+IF8uZmxhdHRlbihfLnZhbHVlcyhkZXZpY2VNYXApKTtcblxuICBmaW5kID0gKGFkZHJlc3M6IEFkZHJlc3NQYXJhbSk6IElEZXZpY2VbXSB8IHVuZGVmaW5lZCA9PiB7XG4gICAgY29uc3QgdGFyZ2V0QWRkcmVzcyA9IG5ldyBBZGRyZXNzKGFkZHJlc3MpO1xuICAgIHJldHVybiBkZXZpY2VNYXBbdGFyZ2V0QWRkcmVzcy50b1N0cmluZygpXTtcbiAgfTtcblxuICBjcmVhdGUoYWRkcmVzczogQWRkcmVzc1BhcmFtLCBtaWI6IHN0cmluZyk6IElEZXZpY2U7XG4gIGNyZWF0ZShhZGRyZXNzOiBBZGRyZXNzUGFyYW0sIHR5cGU6IG51bWJlciwgdmVyc2lvbj86IG51bWJlcik6IElEZXZpY2U7XG4gIGNyZWF0ZShhZGRyZXNzOiBBZGRyZXNzUGFyYW0sIG1pYk9yVHlwZTogYW55LCB2ZXJzaW9uPzogbnVtYmVyKTogSURldmljZSB7XG4gICAgbGV0IG1pYjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgIGlmICh0eXBlb2YgbWliT3JUeXBlID09PSAnbnVtYmVyJykge1xuICAgICAgbWliID0gZmluZE1pYkJ5VHlwZShtaWJPclR5cGUsIHZlcnNpb24pO1xuICAgICAgaWYgKG1pYiA9PT0gdW5kZWZpbmVkKSB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gbWliIHR5cGUnKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBtaWJPclR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICBtaWIgPSBTdHJpbmcobWliT3JUeXBlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtaWIgb3IgdHlwZSBleHBlY3RlZCwgZ290ICR7bWliT3JUeXBlfWApO1xuICAgIH1cbiAgICBjb25zdCB0YXJnZXRBZGRyZXNzID0gbmV3IEFkZHJlc3MoYWRkcmVzcyk7XG4gICAgLy8gbGV0IGRldmljZSA9IGRldmljZU1hcFt0YXJnZXRBZGRyZXNzLnRvU3RyaW5nKCldO1xuICAgIC8vIGlmIChkZXZpY2UpIHtcbiAgICAvLyAgIGNvbnNvbGUuYXNzZXJ0KFxuICAgIC8vICAgICBSZWZsZWN0LmdldE1ldGFkYXRhKCdtaWInLCBkZXZpY2UpID09PSBtaWIsXG4gICAgLy8gICAgIGBtaWJzIGFyZSBkaWZmZXJlbnQsIGV4cGVjdGVkICR7bWlifWAsXG4gICAgLy8gICApO1xuICAgIC8vICAgZGV2aWNlLmFkZHJlZigpO1xuICAgIC8vICAgcmV0dXJuIGRldmljZTtcbiAgICAvLyB9XG5cbiAgICBjb25zdCBjb25zdHJ1Y3RvciA9IGdldENvbnN0cnVjdG9yKG1pYik7XG4gICAgY29uc3QgZGV2aWNlOiBJRGV2aWNlID0gUmVmbGVjdC5jb25zdHJ1Y3QoY29uc3RydWN0b3IsIFt0YXJnZXRBZGRyZXNzXSk7XG4gICAgaWYgKCF0YXJnZXRBZGRyZXNzLmlzRW1wdHkpIHtcbiAgICAgIGNvbnN0IGtleSA9IHRhcmdldEFkZHJlc3MudG9TdHJpbmcoKTtcbiAgICAgIGRldmljZU1hcFtrZXldID0gKGRldmljZU1hcFtrZXldIHx8IFtdKS5jb25jYXQoZGV2aWNlKTtcbiAgICAgIHByb2Nlc3MubmV4dFRpY2soKCkgPT4gdGhpcy5lbWl0KCduZXcnLCBkZXZpY2UpKTtcbiAgICB9XG4gICAgcmV0dXJuIGRldmljZTtcbiAgfVxufVxuXG5jb25zdCBkZXZpY2VzID0gbmV3IERldmljZXMoKTtcblxuZXhwb3J0IGRlZmF1bHQgZGV2aWNlcztcbiJdfQ==