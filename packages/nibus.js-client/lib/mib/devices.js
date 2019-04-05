"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getMibFile = getMibFile;
exports.getMibPrototype = getMibPrototype;
exports.default = exports.MibDeviceV = void 0;

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

var _common = require("../session/common");

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

  if (type != null) {
    const {
      appinfo: info = {},
      enumeration,
      minInclusive,
      maxInclusive
    } = type;
    const {
      units,
      precision,
      representation
    } = info;
    const size = (0, _mib.getIntSize)(simpleType);
    units && converters.push((0, _mib.unitConverter)(units));
    precision && converters.push((0, _mib.precisionConverter)(precision));
    enumeration && converters.push((0, _mib.enumerationConverter)(enumeration));
    representation && size && converters.push((0, _mib.representationConverter)(representation, size));
    minInclusive && converters.push((0, _mib.minInclusiveConverter)(minInclusive));
    maxInclusive && converters.push((0, _mib.maxInclusiveConverter)(maxInclusive));
  }

  if (key === 'brightness' && prop.type === 'xs:unsignedByte') {
    converters.push(_mib.percentConverter);
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

  if (prop.type === 'versionType') {
    converters.push(_mib.versionTypeConverter);
  }

  if (simpleType === 'xs:boolean') {
    converters.push(_mib.booleanConverter);
    Reflect.defineMetadata('enum', [{
      Да: true
    }, {
      Нет: false
    }], target, propertyKey);
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
  }; // if (isReadable) {

  attributes.get = function () {
    console.assert(Reflect.get(this, '$countRef') > 0, 'Device was released');
    let value;

    if (!this.getError(id)) {
      value = (0, _mib.convertTo)(converters)(this.getRawValue(id));
    }

    return value;
  }; // }


  if (isWritable) {
    attributes.set = function (newValue) {
      console.assert(Reflect.get(this, '$countRef') > 0, 'Device was released');
      const value = (0, _mib.convertFrom)(converters)(newValue);

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
    const map = Reflect.getMetadata('map', this);
    const ids = Object.entries(map).filter(([, names]) => Reflect.getMetadata('isReadable', this, names[0])).map(([id]) => Number(id));
    return ids.length > 0 ? this.read(...ids) : Promise.resolve([]);
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
      this.$countRef = 1; // this.$debounceDrain = _.debounce(this.drain, 25);
    }

    const prototype = new DevicePrototype(mib);
    Device.prototype = Object.create(prototype);
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
      mib = String(mibOrType || 'minihost_v2.06b');
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

const devices = new Devices();
var _default = devices;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taWIvZGV2aWNlcy50cyJdLCJuYW1lcyI6WyJwa2dOYW1lIiwiZGVidWciLCIkdmFsdWVzIiwiU3ltYm9sIiwiJGVycm9ycyIsIiRkaXJ0aWVzIiwic2FmZU51bWJlciIsInZhbCIsIm51bSIsInBhcnNlRmxvYXQiLCJOdW1iZXIiLCJpc05hTiIsIlByaXZhdGVQcm9wcyIsImRldmljZU1hcCIsIm1pYlR5cGVzQ2FjaGUiLCJNaWJQcm9wZXJ0eUFwcEluZm9WIiwidCIsImludGVyc2VjdGlvbiIsInR5cGUiLCJubXNfaWQiLCJ1bmlvbiIsInN0cmluZyIsIkludCIsImFjY2VzcyIsInBhcnRpYWwiLCJjYXRlZ29yeSIsIk1pYlByb3BlcnR5ViIsImFubm90YXRpb24iLCJhcHBpbmZvIiwiTWliRGV2aWNlQXBwSW5mb1YiLCJtaWJfdmVyc2lvbiIsImRldmljZV90eXBlIiwibG9hZGVyX3R5cGUiLCJmaXJtd2FyZSIsIm1pbl92ZXJzaW9uIiwiTWliRGV2aWNlVHlwZVYiLCJwcm9wZXJ0aWVzIiwicmVjb3JkIiwiTWliVHlwZVYiLCJiYXNlIiwiemVybyIsInVuaXRzIiwicHJlY2lzaW9uIiwicmVwcmVzZW50YXRpb24iLCJtaW5JbmNsdXNpdmUiLCJtYXhJbmNsdXNpdmUiLCJlbnVtZXJhdGlvbiIsIk1pYlN1YnJvdXRpbmVWIiwicmVzcG9uc2UiLCJTdWJyb3V0aW5lVHlwZVYiLCJpZCIsImxpdGVyYWwiLCJNaWJEZXZpY2VWIiwiZGV2aWNlIiwidHlwZXMiLCJzdWJyb3V0aW5lcyIsImdldEJhc2VUeXBlIiwic3VwZXJUeXBlIiwiZGVmaW5lTWliUHJvcGVydHkiLCJ0YXJnZXQiLCJrZXkiLCJwcm9wIiwicHJvcGVydHlLZXkiLCJSZWZsZWN0IiwiZGVmaW5lTWV0YWRhdGEiLCJzaW1wbGVUeXBlIiwiY29udmVydGVycyIsImlzUmVhZGFibGUiLCJpbmRleE9mIiwiaXNXcml0YWJsZSIsImluZm8iLCJzaXplIiwicHVzaCIsInBlcmNlbnRDb252ZXJ0ZXIiLCJmaXhlZFBvaW50TnVtYmVyNENvbnZlcnRlciIsInZlcnNpb25UeXBlQ29udmVydGVyIiwiYm9vbGVhbkNvbnZlcnRlciIsItCU0LAiLCLQndC10YIiLCJuYW1lIiwiYXR0cmlidXRlcyIsImVudW1lcmFibGUiLCJnZXQiLCJjb25zb2xlIiwiYXNzZXJ0IiwidmFsdWUiLCJnZXRFcnJvciIsImdldFJhd1ZhbHVlIiwic2V0IiwibmV3VmFsdWUiLCJ1bmRlZmluZWQiLCJFcnJvciIsIkpTT04iLCJzdHJpbmdpZnkiLCJzZXRSYXdWYWx1ZSIsImRlZmluZVByb3BlcnR5IiwiZ2V0TWliRmlsZSIsIm1pYm5hbWUiLCJwYXRoIiwicmVzb2x2ZSIsIl9fZGlybmFtZSIsIkRldmljZVByb3RvdHlwZSIsIkV2ZW50RW1pdHRlciIsImNvbnN0cnVjdG9yIiwibWliZmlsZSIsIm1pYlZhbGlkYXRpb24iLCJkZWNvZGUiLCJyZXF1aXJlIiwiaXNMZWZ0IiwiUGF0aFJlcG9ydGVyIiwicmVwb3J0IiwibWliIiwiZXJyb3JUeXBlIiwibWV0YXN1YnMiLCJfIiwidHJhbnNmb3JtIiwicmVzdWx0Iiwic3ViIiwiZGVzY3JpcHRpb24iLCJhcmdzIiwiT2JqZWN0IiwiZW50cmllcyIsIm1hcCIsImRlc2MiLCJrZXlzIiwib3duS2V5cyIsInZhbGlkSnNOYW1lIiwiZm9yRWFjaCIsInByb3BOYW1lIiwiY29ubmVjdGlvbiIsInZhbHVlcyIsInByZXYiLCJlbWl0IiwidG9KU09OIiwianNvbiIsImdldE1ldGFkYXRhIiwiYWRkcmVzcyIsInRvU3RyaW5nIiwiZ2V0SWQiLCJpZE9yTmFtZSIsImlzSW50ZWdlciIsImhhcyIsImdldE5hbWUiLCJpbmNsdWRlcyIsImlzRGlydHkiLCJlcnJvcnMiLCJzZXREaXJ0eSIsInNldEVycm9yIiwiZXJyb3IiLCJkaXJ0aWVzIiwibmFtZXMiLCJhZGRyZWYiLCIkY291bnRSZWYiLCJyZWxlYXNlIiwiZGV2aWNlcyIsImRyYWluIiwiaWRzIiwiZmlsdGVyIiwibGVuZ3RoIiwid3JpdGUiLCJjYXRjaCIsIlByb21pc2UiLCJ3cml0ZUFsbCIsInJlamVjdCIsImpvaW4iLCJyZXF1ZXN0cyIsInJlZHVjZSIsImFjYyIsImFsbCIsImRhdGFncmFtIiwic2VuZERhdGFncmFtIiwidGhlbiIsInN0YXR1cyIsIk5pYnVzRXJyb3IiLCJyZWFzb24iLCJ3cml0ZVZhbHVlcyIsInNvdXJjZSIsInN0cm9uZyIsIlR5cGVFcnJvciIsImFzc2lnbiIsIndyaXR0ZW4iLCJlcnIiLCJyZWFkQWxsIiwicmVhZCIsImRpc2FibGVCYXRjaFJlYWRpbmciLCJjaHVua3MiLCJjaHVuayIsInByb21pc2UiLCJkYXRhZ3JhbXMiLCJBcnJheSIsImlzQXJyYXkiLCJtZXNzYWdlIiwidXBsb2FkIiwiZG9tYWluIiwib2Zmc2V0IiwicmVxVXBsb2FkIiwicGFkRW5kIiwiZG9tYWluU2l6ZSIsImluaXRVcGxvYWQiLCJpbml0U3RhdCIsInRvdGFsIiwicmVzdCIsInBvcyIsImJ1ZnMiLCJNYXRoIiwibWluIiwidXBsb2FkU2VnbWVudCIsInVwbG9hZFN0YXR1cyIsImRhdGEiLCJCdWZmZXIiLCJjb25jYXQiLCJlIiwiZG93bmxvYWQiLCJidWZmZXIiLCJub1Rlcm0iLCJyZXFEb3dubG9hZCIsIm1heCIsInRlcm1pbmF0ZSIsInRlcm1TdGF0IiwicmVxIiwicmVzIiwiaW5pdERvd25sb2FkIiwiY3JjIiwiY2h1bmtTaXplIiwiTk1TX01BWF9EQVRBX0xFTkdUSCIsImkiLCJzZWdtZW50RG93bmxvYWQiLCJkb3dubG9hZFN0YXQiLCJ2ZXJpZnkiLCJ2ZXJpZnlTdGF0IiwiZXhlY3V0ZSIsInByb2dyYW0iLCJzdWJyb3V0aW5lIiwicHJvcHMiLCJhcmciLCJub3RSZXBseSIsImZpbmRNaWJCeVR5cGUiLCJ2ZXJzaW9uIiwiY29uZiIsImNvbmZpZ0RpciIsInZhbGlkYXRlIiwiQ29uZmlnViIsIm1pYlR5cGVzIiwibWlicyIsIm1pYlR5cGUiLCJmaW5kTGFzdCIsIm1pblZlcnNpb24iLCJnZXRDb25zdHJ1Y3RvciIsIkRldmljZSIsImFwcGx5IiwicHJvdG90eXBlIiwiY3JlYXRlIiwiZ2V0TWliUHJvdG90eXBlIiwiRGV2aWNlcyIsInRhcmdldEFkZHJlc3MiLCJBZGRyZXNzIiwibWliT3JUeXBlIiwiU3RyaW5nIiwiY29uc3RydWN0IiwiaXNFbXB0eSIsInByb2Nlc3MiLCJuZXh0VGljayJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFXQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFFQTs7QUFDQTs7QUFnQkE7O0FBQ0E7Ozs7Ozs7O0FBb0JBO0FBQ0E7QUFFQSxNQUFNQSxPQUFPLEdBQUcsZ0JBQWhCLEMsQ0FBa0M7O0FBRWxDLE1BQU1DLEtBQUssR0FBRyxvQkFBYSxlQUFiLENBQWQ7QUFFQSxNQUFNQyxPQUFPLEdBQUdDLE1BQU0sQ0FBQyxRQUFELENBQXRCO0FBQ0EsTUFBTUMsT0FBTyxHQUFHRCxNQUFNLENBQUMsUUFBRCxDQUF0QjtBQUNBLE1BQU1FLFFBQVEsR0FBR0YsTUFBTSxDQUFDLFNBQUQsQ0FBdkI7O0FBRUEsU0FBU0csVUFBVCxDQUFvQkMsR0FBcEIsRUFBOEI7QUFDNUIsUUFBTUMsR0FBRyxHQUFHQyxVQUFVLENBQUNGLEdBQUQsQ0FBdEI7QUFDQSxTQUFRRyxNQUFNLENBQUNDLEtBQVAsQ0FBYUgsR0FBYixLQUFzQixHQUFFQSxHQUFJLEVBQVAsS0FBYUQsR0FBbkMsR0FBMENBLEdBQTFDLEdBQWdEQyxHQUF2RDtBQUNEOztJQUVJSSxZOztXQUFBQSxZO0FBQUFBLEVBQUFBLFksQ0FBQUEsWTtHQUFBQSxZLEtBQUFBLFk7O0FBSUwsTUFBTUMsU0FBaUQsR0FBRyxFQUExRDtBQUVBLE1BQU1DLGFBQThDLEdBQUcsRUFBdkQ7QUFFQSxNQUFNQyxtQkFBbUIsR0FBR0MsQ0FBQyxDQUFDQyxZQUFGLENBQWUsQ0FDekNELENBQUMsQ0FBQ0UsSUFBRixDQUFPO0FBQ0xDLEVBQUFBLE1BQU0sRUFBRUgsQ0FB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SUFBSXJLLEtBQUosQ0FBVyw2QkFBNEJxSyxTQUFVLEVBQWpELENBQU47QUFDRDs7QUFDRCxVQUFNRixhQUFhLEdBQUcsSUFBSUMsZ0JBQUosQ0FBWXZILE9BQVosQ0FBdEI7QUFDQSxRQUFJbkYsTUFBTSxHQUFHeEMsU0FBUyxDQUFDaVAsYUFBYSxDQUFDckgsUUFBZCxFQUFELENBQXRCOztBQUNBLFFBQUlwRixNQUFKLEVBQVk7QUFDVjhCLE1BQUFBLE9BQU8sQ0FBQ0MsTUFBUixDQUNFckIsT0FBTyxDQUFDd0UsV0FBUixDQUFvQixLQUFwQixFQUEyQmxGLE1BQTNCLE1BQXVDMEQsR0FEekMsRUFFRyxnQ0FBK0JBLEdBQUksRUFGdEM7QUFJQTFELE1BQUFBLE1BQU0sQ0FBQ2tHLE1BQVA7QUFDQSxhQUFPbEcsTUFBUDtBQUNEOztBQUVELFVBQU1rRCxXQUFXLEdBQUdnSixjQUFjLENBQUN4SSxHQUFELENBQWxDO0FBQ0ExRCxJQUFBQSxNQUFNLEdBQUdVLE9BQU8sQ0FBQ21NLFNBQVIsQ0FBa0IzSixXQUFsQixFQUErQixDQUFDdUosYUFBRCxDQUEvQixDQUFUOztBQUNBLFFBQUksQ0FBQ0EsYUFBYSxDQUFDSyxPQUFuQixFQUE0QjtBQUMxQnRQLE1BQUFBLFNBQVMsQ0FBQ2lQLGFBQWEsQ0FBQ3JILFFBQWQsRUFBRCxDQUFULEdBQXNDcEYsTUFBdEM7QUFDQStNLE1BQUFBLE9BQU8sQ0FBQ0MsUUFBUixDQUFpQixNQUFNLEtBQUtqSSxJQUFMLENBQVUsS0FBVixFQUFpQi9FLE1BQWpCLENBQXZCO0FBQ0Q7O0FBQ0QsV0FBT0EsTUFBUDtBQUNEOztBQXRDZ0M7O0FBeUNuQyxNQUFNcUcsT0FBTyxHQUFHLElBQUltRyxPQUFKLEVBQWhCO2VBRWVuRyxPIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTkuIE9PTyBOYXRhLUluZm9cbiAqIEBhdXRob3IgQW5kcmVpIFNhcmFrZWV2IDxhdnNAbmF0YS1pbmZvLnJ1PlxuICpcbiAqIFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBcIkBuYXRhXCIgcHJvamVjdC5cbiAqIEZvciB0aGUgZnVsbCBjb3B5cmlnaHQgYW5kIGxpY2Vuc2UgaW5mb3JtYXRpb24sIHBsZWFzZSB2aWV3XG4gKiB0aGUgRVVMQSBmaWxlIHRoYXQgd2FzIGRpc3RyaWJ1dGVkIHdpdGggdGhpcyBzb3VyY2UgY29kZS5cbiAqL1xuXG4vKiB0c2xpbnQ6ZGlzYWJsZTp2YXJpYWJsZS1uYW1lICovXG5pbXBvcnQgeyBjcmMxNmNjaXR0IH0gZnJvbSAnY3JjJztcbmltcG9ydCBkZWJ1Z0ZhY3RvcnkgZnJvbSAnZGVidWcnO1xuaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnaW8tdHMnO1xuaW1wb3J0IHsgUGF0aFJlcG9ydGVyIH0gZnJvbSAnaW8tdHMvbGliL1BhdGhSZXBvcnRlcic7XG5pbXBvcnQgXyBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgJ3JlZmxlY3QtbWV0YWRhdGEnO1xuaW1wb3J0IHsgY29uZmlnIGFzIGNvbmZpZ0RpciB9IGZyb20gJ3hkZy1iYXNlZGlyJztcbmltcG9ydCBBZGRyZXNzLCB7IEFkZHJlc3NQYXJhbSB9IGZyb20gJy4uL0FkZHJlc3MnO1xuaW1wb3J0IHsgTmlidXNFcnJvciB9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQgeyBOTVNfTUFYX0RBVEFfTEVOR1RIIH0gZnJvbSAnLi4vbmJjb25zdCc7XG5pbXBvcnQgeyBOaWJ1c0Nvbm5lY3Rpb24gfSBmcm9tICcuLi9uaWJ1cyc7XG5pbXBvcnQgeyBjaHVua0FycmF5IH0gZnJvbSAnLi4vbmlidXMvaGVscGVyJztcbmltcG9ydCB7XG4gIGNyZWF0ZUV4ZWN1dGVQcm9ncmFtSW52b2NhdGlvbixcbiAgY3JlYXRlTm1zRG93bmxvYWRTZWdtZW50LFxuICBjcmVhdGVObXNJbml0aWF0ZURvd25sb2FkU2VxdWVuY2UsXG4gIGNyZWF0ZU5tc0luaXRpYXRlVXBsb2FkU2VxdWVuY2UsXG4gIGNyZWF0ZU5tc1JlYWQsXG4gIGNyZWF0ZU5tc1JlcXVlc3REb21haW5Eb3dubG9hZCxcbiAgY3JlYXRlTm1zUmVxdWVzdERvbWFpblVwbG9hZCxcbiAgY3JlYXRlTm1zVGVybWluYXRlRG93bmxvYWRTZXF1ZW5jZSxcbiAgY3JlYXRlTm1zVXBsb2FkU2VnbWVudCxcbiAgY3JlYXRlTm1zVmVyaWZ5RG9tYWluQ2hlY2tzdW0sXG4gIGNyZWF0ZU5tc1dyaXRlLFxuICBnZXRObXNUeXBlLCBUeXBlZFZhbHVlLFxufSBmcm9tICcuLi9ubXMnO1xuaW1wb3J0IE5tc0RhdGFncmFtIGZyb20gJy4uL25tcy9ObXNEYXRhZ3JhbSc7XG5pbXBvcnQgTm1zVmFsdWVUeXBlIGZyb20gJy4uL25tcy9ObXNWYWx1ZVR5cGUnO1xuaW1wb3J0IHsgQ29uZmlnViB9IGZyb20gJy4uL3Nlc3Npb24vY29tbW9uJztcbmltcG9ydCB7XG4gIGJvb2xlYW5Db252ZXJ0ZXIsXG4gIGNvbnZlcnRGcm9tLFxuICBjb252ZXJ0VG8sXG4gIGVudW1lcmF0aW9uQ29udmVydGVyLFxuICBmaXhlZFBvaW50TnVtYmVyNENvbnZlcnRlcixcbiAgZ2V0SW50U2l6ZSxcbiAgSUNvbnZlcnRlcixcbiAgbWF4SW5jbHVzaXZlQ29udmVydGVyLFxuICBtaW5JbmNsdXNpdmVDb252ZXJ0ZXIsXG4gIHBhY2tlZDhmbG9hdENvbnZlcnRlcixcbiAgcGVyY2VudENvbnZlcnRlcixcbiAgcHJlY2lzaW9uQ29udmVydGVyLFxuICByZXByZXNlbnRhdGlvbkNvbnZlcnRlcixcbiAgdG9JbnQsXG4gIHVuaXRDb252ZXJ0ZXIsXG4gIHZhbGlkSnNOYW1lLFxuICB2ZXJzaW9uVHlwZUNvbnZlcnRlcixcbiAgd2l0aFZhbHVlLFxufSBmcm9tICcuL21pYic7XG4vLyBpbXBvcnQgeyBnZXRNaWJzU3luYyB9IGZyb20gJy4vbWliMmpzb24nO1xuLy8gaW1wb3J0IGRldGVjdG9yIGZyb20gJy4uL3NlcnZpY2UvZGV0ZWN0b3InO1xuXG5jb25zdCBwa2dOYW1lID0gJ0BuYXRhL25pYnVzLmpzJzsgLy8gcmVxdWlyZSgnLi4vLi4vcGFja2FnZS5qc29uJykubmFtZTtcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ25pYnVzOmRldmljZXMnKTtcblxuY29uc3QgJHZhbHVlcyA9IFN5bWJvbCgndmFsdWVzJyk7XG5jb25zdCAkZXJyb3JzID0gU3ltYm9sKCdlcnJvcnMnKTtcbmNvbnN0ICRkaXJ0aWVzID0gU3ltYm9sKCdkaXJ0aWVzJyk7XG5cbmZ1bmN0aW9uIHNhZmVOdW1iZXIodmFsOiBhbnkpIHtcbiAgY29uc3QgbnVtID0gcGFyc2VGbG9hdCh2YWwpO1xuICByZXR1cm4gKE51bWJlci5pc05hTihudW0pIHx8IGAke251bX1gICE9PSB2YWwpID8gdmFsIDogbnVtO1xufVxuXG5lbnVtIFByaXZhdGVQcm9wcyB7XG4gIGNvbm5lY3Rpb24gPSAtMSxcbn1cblxuY29uc3QgZGV2aWNlTWFwOiB7IFthZGRyZXNzOiBzdHJpbmddOiBEZXZpY2VQcm90b3R5cGUgfSA9IHt9O1xuXG5jb25zdCBtaWJUeXBlc0NhY2hlOiB7IFttaWJuYW1lOiBzdHJpbmddOiBGdW5jdGlvbiB9ID0ge307XG5cbmNvbnN0IE1pYlByb3BlcnR5QXBwSW5mb1YgPSB0LmludGVyc2VjdGlvbihbXG4gIHQudHlwZSh7XG4gICAgbm1zX2lkOiB0LnVuaW9uKFt0LnN0cmluZywgdC5JbnRdKSxcbiAgICBhY2Nlc3M6IHQuc3RyaW5nLFxuICB9KSxcbiAgdC5wYXJ0aWFsKHtcbiAgICBjYXRlZ29yeTogdC5zdHJpbmcsXG4gIH0pLFxuXSk7XG5cbi8vIGludGVyZmFjZSBJTWliUHJvcGVydHlBcHBJbmZvIGV4dGVuZHMgdC5UeXBlT2Y8dHlwZW9mIE1pYlByb3BlcnR5QXBwSW5mb1Y+IHt9XG5cbmNvbnN0IE1pYlByb3BlcnR5ViA9IHQudHlwZSh7XG4gIHR5cGU6IHQuc3RyaW5nLFxuICBhbm5vdGF0aW9uOiB0LnN0cmluZyxcbiAgYXBwaW5mbzogTWliUHJvcGVydHlBcHBJbmZvVixcbn0pO1xuXG5pbnRlcmZhY2UgSU1pYlByb3BlcnR5IGV4dGVuZHMgdC5UeXBlT2Y8dHlwZW9mIE1pYlByb3BlcnR5Vj4ge1xuICAvLyBhcHBpbmZvOiBJTWliUHJvcGVydHlBcHBJbmZvO1xufVxuXG5jb25zdCBNaWJEZXZpY2VBcHBJbmZvViA9IHQuaW50ZXJzZWN0aW9uKFtcbiAgdC50eXBlKHtcbiAgICBtaWJfdmVyc2lvbjogdC5zdHJpbmcsXG4gIH0pLFxuICB0LnBhcnRpYWwoe1xuICAgIGRldmljZV90eXBlOiB0LnN0cmluZyxcbiAgICBsb2FkZXJfdHlwZTogdC5zdHJpbmcsXG4gICAgZmlybXdhcmU6IHQuc3RyaW5nLFxuICAgIG1pbl92ZXJzaW9uOiB0LnN0cmluZyxcbiAgfSksXG5dKTtcblxuY29uc3QgTWliRGV2aWNlVHlwZVYgPSB0LnR5cGUoe1xuICBhbm5vdGF0aW9uOiB0LnN0cmluZyxcbiAgYXBwaW5mbzogTWliRGV2aWNlQXBwSW5mb1YsXG4gIHByb3BlcnRpZXM6IHQucmVjb3JkKHQuc3RyaW5nLCBNaWJQcm9wZXJ0eVYpLFxufSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU1pYkRldmljZVR5cGUgZXh0ZW5kcyB0LlR5cGVPZjx0eXBlb2YgTWliRGV2aWNlVHlwZVY+IHt9XG5cbmNvbnN0IE1pYlR5cGVWID0gdC5pbnRlcnNlY3Rpb24oW1xuICB0LnR5cGUoe1xuICAgIGJhc2U6IHQuc3RyaW5nLFxuICB9KSxcbiAgdC5wYXJ0aWFsKHtcbiAgICBhcHBpbmZvOiB0LnBhcnRpYWwoe1xuICAgICAgemVybzogdC5zdHJpbmcsXG4gICAgICB1bml0czogdC5zdHJpbmcsXG4gICAgICBwcmVjaXNpb246IHQuc3RyaW5nLFxuICAgICAgcmVwcmVzZW50YXRpb246IHQuc3RyaW5nLFxuICAgIH0pLFxuICAgIG1pbkluY2x1c2l2ZTogdC5zdHJpbmcsXG4gICAgbWF4SW5jbHVzaXZlOiB0LnN0cmluZyxcbiAgICBlbnVtZXJhdGlvbjogdC5yZWNvcmQodC5zdHJpbmcsIHQudHlwZSh7IGFubm90YXRpb246IHQuc3RyaW5nIH0pKSxcbiAgfSksXG5dKTtcblxuZXhwb3J0IGludGVyZmFjZSBJTWliVHlwZSBleHRlbmRzIHQuVHlwZU9mPHR5cGVvZiBNaWJUeXBlVj4ge31cblxuY29uc3QgTWliU3Vicm91dGluZVYgPSB0LmludGVyc2VjdGlvbihbXG4gIHQudHlwZSh7XG4gICAgYW5ub3RhdGlvbjogdC5zdHJpbmcsXG4gICAgYXBwaW5mbzogdC5pbnRlcnNlY3Rpb24oW1xuICAgICAgdC50eXBlKHsgbm1zX2lkOiB0LnVuaW9uKFt0LnN0cmluZywgdC5JbnRdKSB9KSxcbiAgICAgIHQucGFydGlhbCh7IHJlc3BvbnNlOiB0LnN0cmluZyB9KSxcbiAgICBdKSxcbiAgfSksXG4gIHQucGFydGlhbCh7XG4gICAgcHJvcGVydGllczogdC5yZWNvcmQodC5zdHJpbmcsIHQudHlwZSh7XG4gICAgICB0eXBlOiB0LnN0cmluZyxcbiAgICAgIGFubm90YXRpb246IHQuc3RyaW5nLFxuICAgIH0pKSxcbiAgfSksXG5dKTtcblxuY29uc3QgU3Vicm91dGluZVR5cGVWID0gdC50eXBlKHtcbiAgYW5ub3RhdGlvbjogdC5zdHJpbmcsXG4gIHByb3BlcnRpZXM6IHQudHlwZSh7XG4gICAgaWQ6IHQudHlwZSh7XG4gICAgICB0eXBlOiB0LmxpdGVyYWwoJ3hzOnVuc2lnbmVkU2hvcnQnKSxcbiAgICAgIGFubm90YXRpb246IHQuc3RyaW5nLFxuICAgIH0pLFxuICB9KSxcbn0pO1xuXG5leHBvcnQgY29uc3QgTWliRGV2aWNlViA9IHQuaW50ZXJzZWN0aW9uKFtcbiAgdC50eXBlKHtcbiAgICBkZXZpY2U6IHQuc3RyaW5nLFxuICAgIHR5cGVzOiB0LnJlY29yZCh0LnN0cmluZywgdC51bmlvbihbTWliRGV2aWNlVHlwZVYsIE1pYlR5cGVWLCBTdWJyb3V0aW5lVHlwZVZdKSksXG4gIH0pLFxuICB0LnBhcnRpYWwoe1xuICAgIHN1YnJvdXRpbmVzOiB0LnJlY29yZCh0LnN0cmluZywgTWliU3Vicm91dGluZVYpLFxuICB9KSxcbl0pO1xuXG5pbnRlcmZhY2UgSU1pYkRldmljZSBleHRlbmRzIHQuVHlwZU9mPHR5cGVvZiBNaWJEZXZpY2VWPiB7fVxuXG50eXBlIExpc3RlbmVyPFQ+ID0gKGFyZzogVCkgPT4gdm9pZDtcbnR5cGUgQ2hhbmdlZEFyZyA9IHsgaWQ6IG51bWJlciwgbmFtZXM6IHN0cmluZ1tdIH07XG50eXBlIENoYW5nZWRMaXN0ZW5lciA9IExpc3RlbmVyPENoYW5nZWRBcmc+O1xudHlwZSBVcGxvYWRTdGFydEFyZyA9IHsgZG9tYWluOiBzdHJpbmcsIGRvbWFpblNpemU6IG51bWJlciwgb2Zmc2V0OiBudW1iZXIsIHNpemU6IG51bWJlciB9O1xudHlwZSBVcGxvYWRTdGFydExpc3RlbmVyID0gTGlzdGVuZXI8VXBsb2FkU3RhcnRBcmc+O1xudHlwZSBVcGxvYWREYXRhQXJnID0geyBkb21haW46IHN0cmluZywgZGF0YTogQnVmZmVyLCBwb3M6IG51bWJlciB9O1xuZXhwb3J0IHR5cGUgVXBsb2FkRGF0YUxpc3RlbmVyID0gTGlzdGVuZXI8VXBsb2FkRGF0YUFyZz47XG50eXBlIFVwbG9hZEZpbmlzaEFyZyA9IHsgZG9tYWluOiBzdHJpbmcsIG9mZnNldDogbnVtYmVyLCBkYXRhOiBCdWZmZXIgfTtcbnR5cGUgVXBsb2FkRmluaXNoTGlzdGVuZXIgPSBMaXN0ZW5lcjxVcGxvYWRGaW5pc2hBcmc+O1xudHlwZSBEb3dubG9hZFN0YXJ0QXJnID0geyBkb21haW46IHN0cmluZywgZG9tYWluU2l6ZTogbnVtYmVyLCBvZmZzZXQ6IG51bWJlciwgc2l6ZTogbnVtYmVyIH07XG50eXBlIERvd25sb2FkU3RhcnRMaXN0ZW5lciA9IExpc3RlbmVyPERvd25sb2FkU3RhcnRBcmc+O1xudHlwZSBEb3dubG9hZERhdGFBcmcgPSB7IGRvbWFpbjogc3RyaW5nLCBsZW5ndGg6IG51bWJlciB9O1xuZXhwb3J0IHR5cGUgRG93bmxvYWREYXRhTGlzdGVuZXIgPSBMaXN0ZW5lcjxEb3dubG9hZERhdGFBcmc+O1xudHlwZSBEb3dubG9hZEZpbmlzaEFyZyA9IHsgZG9tYWluOiBzdHJpbmc7IG9mZnNldDogbnVtYmVyLCBzaXplOiBudW1iZXIgfTtcbnR5cGUgRG93bmxvYWRGaW5pc2hMaXN0ZW5lciA9IExpc3RlbmVyPERvd25sb2FkRmluaXNoQXJnPjtcblxuZXhwb3J0IGludGVyZmFjZSBJRGV2aWNlIHtcbiAgcmVhZG9ubHkgYWRkcmVzczogQWRkcmVzcztcbiAgZHJhaW4oKTogUHJvbWlzZTxudW1iZXJbXT47XG4gIHdyaXRlKC4uLmlkczogbnVtYmVyW10pOiBQcm9taXNlPG51bWJlcltdPjtcbiAgcmVhZCguLi5pZHM6IG51bWJlcltdKTogUHJvbWlzZTx7IFtuYW1lOiBzdHJpbmddOiBhbnkgfT47XG4gIHVwbG9hZChkb21haW46IHN0cmluZywgb2Zmc2V0PzogbnVtYmVyLCBzaXplPzogbnVtYmVyKTogUHJvbWlzZTxVaW50OEFycmF5PjtcbiAgZG93bmxvYWQoZG9tYWluOiBzdHJpbmcsIGRhdGE6IEJ1ZmZlciwgb2Zmc2V0PzogbnVtYmVyLCBub1Rlcm0/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPjtcbiAgZXhlY3V0ZShcbiAgICBwcm9ncmFtOiBzdHJpbmcsXG4gICAgYXJncz86IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPE5tc0RhdGFncmFtIHwgTm1zRGF0YWdyYW1bXSB8IHVuZGVmaW5lZD47XG4gIGNvbm5lY3Rpb24/OiBOaWJ1c0Nvbm5lY3Rpb247XG4gIHJlbGVhc2UoKTogbnVtYmVyO1xuICBnZXRJZChpZE9yTmFtZTogc3RyaW5nIHwgbnVtYmVyKTogbnVtYmVyO1xuICBnZXROYW1lKGlkT3JOYW1lOiBzdHJpbmcgfCBudW1iZXIpOiBzdHJpbmc7XG4gIGdldFJhd1ZhbHVlKGlkT3JOYW1lOiBudW1iZXIgfCBzdHJpbmcpOiBhbnk7XG4gIGdldEVycm9yKGlkT3JOYW1lOiBudW1iZXIgfCBzdHJpbmcpOiBhbnk7XG4gIFttaWJQcm9wZXJ0eTogc3RyaW5nXTogYW55O1xuXG4gIG9uKGV2ZW50OiAnY29ubmVjdGVkJyB8ICdkaXNjb25uZWN0ZWQnLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCk6IHRoaXM7XG4gIG9uKGV2ZW50OiAnY2hhbmdpbmcnIHwgJ2NoYW5nZWQnLCBsaXN0ZW5lcjogQ2hhbmdlZExpc3RlbmVyKTogdGhpcztcbiAgb24oZXZlbnQ6ICd1cGxvYWRTdGFydCcsIGxpc3RlbmVyOiBVcGxvYWRTdGFydExpc3RlbmVyKTogdGhpcztcbiAgb24oZXZlbnQ6ICd1cGxvYWREYXRhJywgbGlzdGVuZXI6IFVwbG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAndXBsb2FkRmluaXNoJywgbGlzdGVuZXI6IFVwbG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcbiAgb24oZXZlbnQ6ICdkb3dubG9hZFN0YXJ0JywgbGlzdGVuZXI6IERvd25sb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAnZG93bmxvYWREYXRhJywgbGlzdGVuZXI6IERvd25sb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgb24oZXZlbnQ6ICdkb3dubG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBEb3dubG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcblxuICBvbmNlKGV2ZW50OiAnY29ubmVjdGVkJyB8ICdkaXNjb25uZWN0ZWQnLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCk6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICdjaGFuZ2luZycgfCAnY2hhbmdlZCcsIGxpc3RlbmVyOiBDaGFuZ2VkTGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAndXBsb2FkU3RhcnQnLCBsaXN0ZW5lcjogVXBsb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICd1cGxvYWREYXRhJywgbGlzdGVuZXI6IFVwbG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICd1cGxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogVXBsb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnZG93bmxvYWRTdGFydCcsIGxpc3RlbmVyOiBEb3dubG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnZG93bmxvYWREYXRhJywgbGlzdGVuZXI6IERvd25sb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgb25jZShldmVudDogJ2Rvd25sb2FkRmluaXNoJywgbGlzdGVuZXI6IERvd25sb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuXG4gIGFkZExpc3RlbmVyKGV2ZW50OiAnY29ubmVjdGVkJyB8ICdkaXNjb25uZWN0ZWQnLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCk6IHRoaXM7XG4gIGFkZExpc3RlbmVyKGV2ZW50OiAnY2hhbmdpbmcnIHwgJ2NoYW5nZWQnLCBsaXN0ZW5lcjogQ2hhbmdlZExpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICd1cGxvYWRTdGFydCcsIGxpc3RlbmVyOiBVcGxvYWRTdGFydExpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICd1cGxvYWREYXRhJywgbGlzdGVuZXI6IFVwbG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIGFkZExpc3RlbmVyKGV2ZW50OiAndXBsb2FkRmluaXNoJywgbGlzdGVuZXI6IFVwbG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICdkb3dubG9hZFN0YXJ0JywgbGlzdGVuZXI6IERvd25sb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIGFkZExpc3RlbmVyKGV2ZW50OiAnZG93bmxvYWREYXRhJywgbGlzdGVuZXI6IERvd25sb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICdkb3dubG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBEb3dubG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcblxuICBvZmYoZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcsIGxpc3RlbmVyOiAoKSA9PiB2b2lkKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAnY2hhbmdpbmcnIHwgJ2NoYW5nZWQnLCBsaXN0ZW5lcjogQ2hhbmdlZExpc3RlbmVyKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAndXBsb2FkU3RhcnQnLCBsaXN0ZW5lcjogVXBsb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIG9mZihldmVudDogJ3VwbG9hZERhdGEnLCBsaXN0ZW5lcjogVXBsb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAndXBsb2FkRmluaXNoJywgbGlzdGVuZXI6IFVwbG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAnZG93bmxvYWRTdGFydCcsIGxpc3RlbmVyOiBEb3dubG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICdkb3dubG9hZERhdGEnLCBsaXN0ZW5lcjogRG93bmxvYWREYXRhTGlzdGVuZXIpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICdkb3dubG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBEb3dubG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcblxuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ2NoYW5naW5nJyB8ICdjaGFuZ2VkJywgbGlzdGVuZXI6IENoYW5nZWRMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAndXBsb2FkU3RhcnQnLCBsaXN0ZW5lcjogVXBsb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAndXBsb2FkRGF0YScsIGxpc3RlbmVyOiBVcGxvYWREYXRhTGlzdGVuZXIpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ3VwbG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBVcGxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAnZG93bmxvYWRTdGFydCcsIGxpc3RlbmVyOiBEb3dubG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ2Rvd25sb2FkRGF0YScsIGxpc3RlbmVyOiBEb3dubG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAnZG93bmxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogRG93bmxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG5cbiAgZW1pdChldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJyk6IGJvb2xlYW47XG4gIGVtaXQoZXZlbnQ6ICdjaGFuZ2luZycgfCAnY2hhbmdlZCcsIGFyZzogQ2hhbmdlZEFyZyk6IGJvb2xlYW47XG4gIGVtaXQoZXZlbnQ6ICd1cGxvYWRTdGFydCcsIGFyZzogVXBsb2FkU3RhcnRBcmcpOiBib29sZWFuO1xuICBlbWl0KGV2ZW50OiAndXBsb2FkRGF0YScsIGFyZzogVXBsb2FkRGF0YUFyZyk6IGJvb2xlYW47XG4gIGVtaXQoZXZlbnQ6ICd1cGxvYWRGaW5pc2gnLCBhcmc6IFVwbG9hZEZpbmlzaEFyZyk6IGJvb2xlYW47XG4gIGVtaXQoZXZlbnQ6ICdkb3dubG9hZFN0YXJ0JywgYXJnOiBEb3dubG9hZFN0YXJ0QXJnKTogYm9vbGVhbjtcbiAgZW1pdChldmVudDogJ2Rvd25sb2FkRGF0YScsIGFyZzogRG93bmxvYWREYXRhQXJnKTogYm9vbGVhbjtcbiAgZW1pdChldmVudDogJ2Rvd25sb2FkRmluaXNoJywgYXJnOiBEb3dubG9hZEZpbmlzaEFyZyk6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBJU3Vicm91dGluZURlc2Mge1xuICBpZDogbnVtYmVyO1xuICAvLyBuYW1lOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gIG5vdFJlcGx5PzogYm9vbGVhbjtcbiAgYXJncz86IHsgbmFtZTogc3RyaW5nLCB0eXBlOiBObXNWYWx1ZVR5cGUsIGRlc2M/OiBzdHJpbmcgfVtdO1xufVxuXG5pbnRlcmZhY2UgSVByb3BlcnR5RGVzY3JpcHRvcjxPd25lcj4ge1xuICBjb25maWd1cmFibGU/OiBib29sZWFuO1xuICBlbnVtZXJhYmxlPzogYm9vbGVhbjtcbiAgdmFsdWU/OiBhbnk7XG4gIHdyaXRhYmxlPzogYm9vbGVhbjtcblxuICBnZXQ/KHRoaXM6IE93bmVyKTogYW55O1xuXG4gIHNldD8odGhpczogT3duZXIsIHY6IGFueSk6IHZvaWQ7XG59XG5cbmZ1bmN0aW9uIGdldEJhc2VUeXBlKHR5cGVzOiBJTWliRGV2aWNlWyd0eXBlcyddLCB0eXBlOiBzdHJpbmcpOiBzdHJpbmcge1xuICBsZXQgYmFzZSA9IHR5cGU7XG4gIGZvciAobGV0IHN1cGVyVHlwZTogSU1pYlR5cGUgPSB0eXBlc1tiYXNlXSBhcyBJTWliVHlwZTsgc3VwZXJUeXBlICE9IG51bGw7XG4gICAgICAgc3VwZXJUeXBlID0gdHlwZXNbc3VwZXJUeXBlLmJhc2VdIGFzIElNaWJUeXBlKSB7XG4gICAgYmFzZSA9IHN1cGVyVHlwZS5iYXNlO1xuICB9XG4gIHJldHVybiBiYXNlO1xufVxuXG5mdW5jdGlvbiBkZWZpbmVNaWJQcm9wZXJ0eShcbiAgdGFyZ2V0OiBEZXZpY2VQcm90b3R5cGUsXG4gIGtleTogc3RyaW5nLFxuICB0eXBlczogSU1pYkRldmljZVsndHlwZXMnXSxcbiAgcHJvcDogSU1pYlByb3BlcnR5KTogW251bWJlciwgc3RyaW5nXSB7XG4gIGNvbnN0IHByb3BlcnR5S2V5ID0gdmFsaWRKc05hbWUoa2V5KTtcbiAgY29uc3QgeyBhcHBpbmZvIH0gPSBwcm9wO1xuICBjb25zdCBpZCA9IHRvSW50KGFwcGluZm8ubm1zX2lkKTtcbiAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnaWQnLCBpZCwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIGNvbnN0IHNpbXBsZVR5cGUgPSBnZXRCYXNlVHlwZSh0eXBlcywgcHJvcC50eXBlKTtcbiAgY29uc3QgdHlwZSA9IHR5cGVzW3Byb3AudHlwZV0gYXMgSU1pYlR5cGU7XG4gIGNvbnN0IGNvbnZlcnRlcnM6IElDb252ZXJ0ZXJbXSA9IFtdO1xuICBjb25zdCBpc1JlYWRhYmxlID0gYXBwaW5mby5hY2Nlc3MuaW5kZXhPZigncicpID4gLTE7XG4gIGNvbnN0IGlzV3JpdGFibGUgPSBhcHBpbmZvLmFjY2Vzcy5pbmRleE9mKCd3JykgPiAtMTtcbiAgaWYgKHR5cGUgIT0gbnVsbCkge1xuICAgIGNvbnN0IHsgYXBwaW5mbzogaW5mbyA9IHt9LCBlbnVtZXJhdGlvbiwgbWluSW5jbHVzaXZlLCBtYXhJbmNsdXNpdmUgfSA9IHR5cGU7XG4gICAgY29uc3QgeyB1bml0cywgcHJlY2lzaW9uLCByZXByZXNlbnRhdGlvbiB9ID0gaW5mbztcbiAgICBjb25zdCBzaXplID0gZ2V0SW50U2l6ZShzaW1wbGVUeXBlKTtcbiAgICB1bml0cyAmJiBjb252ZXJ0ZXJzLnB1c2godW5pdENvbnZlcnRlcih1bml0cykpO1xuICAgIHByZWNpc2lvbiAmJiBjb252ZXJ0ZXJzLnB1c2gocHJlY2lzaW9uQ29udmVydGVyKHByZWNpc2lvbikpO1xuICAgIGVudW1lcmF0aW9uICYmIGNvbnZlcnRlcnMucHVzaChlbnVtZXJhdGlvbkNvbnZlcnRlcihlbnVtZXJhdGlvbikpO1xuICAgIHJlcHJlc2VudGF0aW9uICYmIHNpemUgJiYgY29udmVydGVycy5wdXNoKHJlcHJlc2VudGF0aW9uQ29udmVydGVyKHJlcHJlc2VudGF0aW9uLCBzaXplKSk7XG4gICAgbWluSW5jbHVzaXZlICYmIGNvbnZlcnRlcnMucHVzaChtaW5JbmNsdXNpdmVDb252ZXJ0ZXIobWluSW5jbHVzaXZlKSk7XG4gICAgbWF4SW5jbHVzaXZlICYmIGNvbnZlcnRlcnMucHVzaChtYXhJbmNsdXNpdmVDb252ZXJ0ZXIobWF4SW5jbHVzaXZlKSk7XG4gIH1cbiAgaWYgKGtleSA9PT0gJ2JyaWdodG5lc3MnICYmIHByb3AudHlwZSA9PT0gJ3hzOnVuc2lnbmVkQnl0ZScpIHtcbiAgICBjb252ZXJ0ZXJzLnB1c2gocGVyY2VudENvbnZlcnRlcik7XG4gIH1cbiAgc3dpdGNoIChzaW1wbGVUeXBlKSB7XG4gICAgY2FzZSAncGFja2VkOEZsb2F0JzpcbiAgICAgIGNvbnZlcnRlcnMucHVzaChwYWNrZWQ4ZmxvYXRDb252ZXJ0ZXIodHlwZSkpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnZml4ZWRQb2ludE51bWJlcjQnOlxuICAgICAgY29udmVydGVycy5wdXNoKGZpeGVkUG9pbnROdW1iZXI0Q29udmVydGVyKTtcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICBicmVhaztcbiAgfVxuICBpZiAocHJvcC50eXBlID09PSAndmVyc2lvblR5cGUnKSB7XG4gICAgY29udmVydGVycy5wdXNoKHZlcnNpb25UeXBlQ29udmVydGVyKTtcbiAgfVxuICBpZiAoc2ltcGxlVHlwZSA9PT0gJ3hzOmJvb2xlYW4nKSB7XG4gICAgY29udmVydGVycy5wdXNoKGJvb2xlYW5Db252ZXJ0ZXIpO1xuICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2VudW0nLCBbeyDQlNCwOiB0cnVlIH0sIHsg0J3QtdGCOiBmYWxzZSB9XSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIH1cbiAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnaXNXcml0YWJsZScsIGlzV3JpdGFibGUsIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdpc1JlYWRhYmxlJywgaXNSZWFkYWJsZSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ3R5cGUnLCBwcm9wLnR5cGUsIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdzaW1wbGVUeXBlJywgc2ltcGxlVHlwZSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoXG4gICAgJ2Rpc3BsYXlOYW1lJyxcbiAgICBwcm9wLmFubm90YXRpb24gPyBwcm9wLmFubm90YXRpb24gOiBuYW1lLFxuICAgIHRhcmdldCxcbiAgICBwcm9wZXJ0eUtleSxcbiAgKTtcbiAgYXBwaW5mby5jYXRlZ29yeSAmJiBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdjYXRlZ29yeScsIGFwcGluZm8uY2F0ZWdvcnksIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdubXNUeXBlJywgZ2V0Tm1zVHlwZShzaW1wbGVUeXBlKSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIGNvbnN0IGF0dHJpYnV0ZXM6IElQcm9wZXJ0eURlc2NyaXB0b3I8RGV2aWNlUHJvdG90eXBlPiA9IHtcbiAgICBlbnVtZXJhYmxlOiBpc1JlYWRhYmxlLFxuICB9O1xuICAvLyBpZiAoaXNSZWFkYWJsZSkge1xuICBhdHRyaWJ1dGVzLmdldCA9IGZ1bmN0aW9uICgpIHtcbiAgICBjb25zb2xlLmFzc2VydChSZWZsZWN0LmdldCh0aGlzLCAnJGNvdW50UmVmJykgPiAwLCAnRGV2aWNlIHdhcyByZWxlYXNlZCcpO1xuICAgIGxldCB2YWx1ZTtcbiAgICBpZiAoIXRoaXMuZ2V0RXJyb3IoaWQpKSB7XG4gICAgICB2YWx1ZSA9IGNvbnZlcnRUbyhjb252ZXJ0ZXJzKSh0aGlzLmdldFJhd1ZhbHVlKGlkKSk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcbiAgLy8gfVxuICBpZiAoaXNXcml0YWJsZSkge1xuICAgIGF0dHJpYnV0ZXMuc2V0ID0gZnVuY3Rpb24gKG5ld1ZhbHVlOiBhbnkpIHtcbiAgICAgIGNvbnNvbGUuYXNzZXJ0KFJlZmxlY3QuZ2V0KHRoaXMsICckY291bnRSZWYnKSA+IDAsICdEZXZpY2Ugd2FzIHJlbGVhc2VkJyk7XG4gICAgICBjb25zdCB2YWx1ZSA9IGNvbnZlcnRGcm9tKGNvbnZlcnRlcnMpKG5ld1ZhbHVlKTtcbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IE51bWJlci5pc05hTih2YWx1ZSBhcyBudW1iZXIpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB2YWx1ZTogJHtKU09OLnN0cmluZ2lmeShuZXdWYWx1ZSl9YCk7XG4gICAgICB9XG4gICAgICB0aGlzLnNldFJhd1ZhbHVlKGlkLCB2YWx1ZSk7XG4gICAgfTtcbiAgfVxuICBSZWZsZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgcHJvcGVydHlLZXksIGF0dHJpYnV0ZXMpO1xuICByZXR1cm4gW2lkLCBwcm9wZXJ0eUtleV07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRNaWJGaWxlKG1pYm5hbWU6IHN0cmluZykge1xuICByZXR1cm4gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL21pYnMvJywgYCR7bWlibmFtZX0ubWliLmpzb25gKTtcbn1cblxuY2xhc3MgRGV2aWNlUHJvdG90eXBlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIGltcGxlbWVudHMgSURldmljZSB7XG4gIC8vIHdpbGwgYmUgb3ZlcnJpZGUgZm9yIGFuIGluc3RhbmNlXG4gICRjb3VudFJlZiA9IDE7XG5cbiAgLy8gcHJpdmF0ZSAkZGVib3VuY2VEcmFpbiA9IF8uZGVib3VuY2UodGhpcy5kcmFpbiwgMjUpO1xuXG4gIGNvbnN0cnVjdG9yKG1pYm5hbWU6IHN0cmluZykge1xuICAgIHN1cGVyKCk7XG4gICAgY29uc3QgbWliZmlsZSA9IGdldE1pYkZpbGUobWlibmFtZSk7XG4gICAgY29uc3QgbWliVmFsaWRhdGlvbiA9IE1pYkRldmljZVYuZGVjb2RlKHJlcXVpcmUobWliZmlsZSkpO1xuICAgIGlmIChtaWJWYWxpZGF0aW9uLmlzTGVmdCgpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgbWliIGZpbGUgJHttaWJmaWxlfSAke1BhdGhSZXBvcnRlci5yZXBvcnQobWliVmFsaWRhdGlvbil9YCk7XG4gICAgfVxuICAgIGNvbnN0IG1pYiA9IG1pYlZhbGlkYXRpb24udmFsdWU7XG4gICAgY29uc3QgeyB0eXBlcywgc3Vicm91dGluZXMgfSA9IG1pYjtcbiAgICBjb25zdCBkZXZpY2UgPSB0eXBlc1ttaWIuZGV2aWNlXSBhcyBJTWliRGV2aWNlVHlwZTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtaWInLCBtaWJuYW1lLCB0aGlzKTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtaWJmaWxlJywgbWliZmlsZSwgdGhpcyk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnYW5ub3RhdGlvbicsIGRldmljZS5hbm5vdGF0aW9uLCB0aGlzKTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtaWJWZXJzaW9uJywgZGV2aWNlLmFwcGluZm8ubWliX3ZlcnNpb24sIHRoaXMpO1xuICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2RldmljZVR5cGUnLCB0b0ludChkZXZpY2UuYXBwaW5mby5kZXZpY2VfdHlwZSksIHRoaXMpO1xuICAgIGRldmljZS5hcHBpbmZvLmxvYWRlcl90eXBlICYmIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2xvYWRlclR5cGUnLFxuICAgICAgdG9JbnQoZGV2aWNlLmFwcGluZm8ubG9hZGVyX3R5cGUpLCB0aGlzLFxuICAgICk7XG4gICAgZGV2aWNlLmFwcGluZm8uZmlybXdhcmUgJiYgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnZmlybXdhcmUnLFxuICAgICAgZGV2aWNlLmFwcGluZm8uZmlybXdhcmUsIHRoaXMsXG4gICAgKTtcbiAgICBkZXZpY2UuYXBwaW5mby5taW5fdmVyc2lvbiAmJiBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtaW5fdmVyc2lvbicsXG4gICAgICBkZXZpY2UuYXBwaW5mby5taW5fdmVyc2lvbiwgdGhpcyxcbiAgICApO1xuICAgIHR5cGVzLmVycm9yVHlwZSAmJiBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKFxuICAgICAgJ2Vycm9yVHlwZScsICh0eXBlcy5lcnJvclR5cGUgYXMgSU1pYlR5cGUpLmVudW1lcmF0aW9uLCB0aGlzKTtcblxuICAgIGlmIChzdWJyb3V0aW5lcykge1xuICAgICAgY29uc3QgbWV0YXN1YnMgPSBfLnRyYW5zZm9ybShcbiAgICAgICAgc3Vicm91dGluZXMsXG4gICAgICAgIChyZXN1bHQsIHN1YiwgbmFtZSkgPT4ge1xuICAgICAgICAgIHJlc3VsdFtuYW1lXSA9IHtcbiAgICAgICAgICAgIGlkOiB0b0ludChzdWIuYXBwaW5mby5ubXNfaWQpLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IHN1Yi5hbm5vdGF0aW9uLFxuICAgICAgICAgICAgYXJnczogc3ViLnByb3BlcnRpZXMgJiYgT2JqZWN0LmVudHJpZXMoc3ViLnByb3BlcnRpZXMpXG4gICAgICAgICAgICAgIC5tYXAoKFtuYW1lLCBwcm9wXSkgPT4gKHtcbiAgICAgICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgICAgIHR5cGU6IGdldE5tc1R5cGUocHJvcC50eXBlKSxcbiAgICAgICAgICAgICAgICBkZXNjOiBwcm9wLmFubm90YXRpb24sXG4gICAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICB9O1xuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0sXG4gICAgICAgIHt9IGFzIFJlY29yZDxzdHJpbmcsIElTdWJyb3V0aW5lRGVzYz4sXG4gICAgICApO1xuICAgICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnc3Vicm91dGluZXMnLCBtZXRhc3VicywgdGhpcyk7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogY2F0ZWdvcnlcbiAgICAvLyBjb25zdCBtaWJDYXRlZ29yeSA9IF8uZmluZChkZXRlY3Rvci5kZXRlY3Rpb24hLm1pYkNhdGVnb3JpZXMsIHsgbWliOiBtaWJuYW1lIH0pO1xuICAgIC8vIGlmIChtaWJDYXRlZ29yeSkge1xuICAgIC8vICAgY29uc3QgeyBjYXRlZ29yeSwgZGlzYWJsZUJhdGNoUmVhZGluZyB9ID0gbWliQ2F0ZWdvcnk7XG4gICAgLy8gICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdjYXRlZ29yeScsIGNhdGVnb3J5LCB0aGlzKTtcbiAgICAvLyAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2Rpc2FibGVCYXRjaFJlYWRpbmcnLCAhIWRpc2FibGVCYXRjaFJlYWRpbmcsIHRoaXMpO1xuICAgIC8vIH1cblxuICAgIGNvbnN0IGtleXMgPSBSZWZsZWN0Lm93bktleXMoZGV2aWNlLnByb3BlcnRpZXMpIGFzIHN0cmluZ1tdO1xuICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ21pYlByb3BlcnRpZXMnLCBrZXlzLm1hcCh2YWxpZEpzTmFtZSksIHRoaXMpO1xuICAgIGNvbnN0IG1hcDogeyBbaWQ6IG51bWJlcl06IHN0cmluZ1tdIH0gPSB7fTtcbiAgICBrZXlzLmZvckVhY2goKGtleTogc3RyaW5nKSA9PiB7XG4gICAgICBjb25zdCBbaWQsIHByb3BOYW1lXSA9IGRlZmluZU1pYlByb3BlcnR5KHRoaXMsIGtleSwgdHlwZXMsIGRldmljZS5wcm9wZXJ0aWVzW2tleV0pO1xuICAgICAgaWYgKCFtYXBbaWRdKSB7XG4gICAgICAgIG1hcFtpZF0gPSBbcHJvcE5hbWVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWFwW2lkXS5wdXNoKHByb3BOYW1lKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtYXAnLCBtYXAsIHRoaXMpO1xuICB9XG5cbiAgcHVibGljIGdldCBjb25uZWN0aW9uKCk6IE5pYnVzQ29ubmVjdGlvbiB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgeyBbJHZhbHVlc106IHZhbHVlcyB9ID0gdGhpcztcbiAgICByZXR1cm4gdmFsdWVzW1ByaXZhdGVQcm9wcy5jb25uZWN0aW9uXTtcbiAgfVxuXG4gIHB1YmxpYyBzZXQgY29ubmVjdGlvbih2YWx1ZTogTmlidXNDb25uZWN0aW9uIHwgdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgeyBbJHZhbHVlc106IHZhbHVlcyB9ID0gdGhpcztcbiAgICBjb25zdCBwcmV2ID0gdmFsdWVzW1ByaXZhdGVQcm9wcy5jb25uZWN0aW9uXTtcbiAgICBpZiAocHJldiA9PT0gdmFsdWUpIHJldHVybjtcbiAgICB2YWx1ZXNbUHJpdmF0ZVByb3BzLmNvbm5lY3Rpb25dID0gdmFsdWU7XG4gICAgLyoqXG4gICAgICogRGV2aWNlIGNvbm5lY3RlZCBldmVudFxuICAgICAqIEBldmVudCBJRGV2aWNlI2Nvbm5lY3RlZFxuICAgICAqIEBldmVudCBJRGV2aWNlI2Rpc2Nvbm5lY3RlZFxuICAgICAqL1xuICAgIHRoaXMuZW1pdCh2YWx1ZSAhPSBudWxsID8gJ2Nvbm5lY3RlZCcgOiAnZGlzY29ubmVjdGVkJyk7XG4gICAgLy8gaWYgKHZhbHVlKSB7XG4gICAgLy8gICB0aGlzLmRyYWluKCkuY2F0Y2goKCkgPT4ge30pO1xuICAgIC8vIH1cbiAgfVxuXG4gIC8vIG5vaW5zcGVjdGlvbiBKU1VudXNlZEdsb2JhbFN5bWJvbHNcbiAgcHVibGljIHRvSlNPTigpOiBhbnkge1xuICAgIGNvbnN0IGpzb246IGFueSA9IHtcbiAgICAgIG1pYjogUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWliJywgdGhpcyksXG4gICAgfTtcbiAgICBjb25zdCBrZXlzOiBzdHJpbmdbXSA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21pYlByb3BlcnRpZXMnLCB0aGlzKTtcbiAgICBrZXlzLmZvckVhY2goKGtleSkgPT4ge1xuICAgICAgaWYgKHRoaXNba2V5XSAhPT0gdW5kZWZpbmVkKSBqc29uW2tleV0gPSB0aGlzW2tleV07XG4gICAgfSk7XG4gICAganNvbi5hZGRyZXNzID0gdGhpcy5hZGRyZXNzLnRvU3RyaW5nKCk7XG4gICAgcmV0dXJuIGpzb247XG4gIH1cblxuICBwdWJsaWMgZ2V0SWQoaWRPck5hbWU6IHN0cmluZyB8IG51bWJlcik6IG51bWJlciB7XG4gICAgbGV0IGlkOiBudW1iZXI7XG4gICAgaWYgKHR5cGVvZiBpZE9yTmFtZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGlkID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnaWQnLCB0aGlzLCBpZE9yTmFtZSk7XG4gICAgICBpZiAoTnVtYmVyLmlzSW50ZWdlcihpZCkpIHJldHVybiBpZDtcbiAgICAgIGlkID0gdG9JbnQoaWRPck5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZCA9IGlkT3JOYW1lO1xuICAgIH1cbiAgICBjb25zdCBtYXAgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBpZiAoIVJlZmxlY3QuaGFzKG1hcCwgaWQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gcHJvcGVydHkgJHtpZE9yTmFtZX1gKTtcbiAgICB9XG4gICAgcmV0dXJuIGlkO1xuICB9XG5cbiAgcHVibGljIGdldE5hbWUoaWRPck5hbWU6IHN0cmluZyB8IG51bWJlcik6IHN0cmluZyB7XG4gICAgY29uc3QgbWFwID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWFwJywgdGhpcyk7XG4gICAgaWYgKFJlZmxlY3QuaGFzKG1hcCwgaWRPck5hbWUpKSB7XG4gICAgICByZXR1cm4gbWFwW2lkT3JOYW1lXVswXTtcbiAgICB9XG4gICAgY29uc3Qga2V5czogc3RyaW5nW10gPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtaWJQcm9wZXJ0aWVzJywgdGhpcyk7XG4gICAgaWYgKHR5cGVvZiBpZE9yTmFtZSA9PT0gJ3N0cmluZycgJiYga2V5cy5pbmNsdWRlcyhpZE9yTmFtZSkpIHJldHVybiBpZE9yTmFtZTtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gcHJvcGVydHkgJHtpZE9yTmFtZX1gKTtcbiAgfVxuXG4gIC8qXG4gICAgcHVibGljIHRvSWRzKGlkc09yTmFtZXM6IChzdHJpbmcgfCBudW1iZXIpW10pOiBudW1iZXJbXSB7XG4gICAgICBjb25zdCBtYXAgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICAgIHJldHVybiBpZHNPck5hbWVzLm1hcCgoaWRPck5hbWUpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBpZE9yTmFtZSA9PT0gJ3N0cmluZycpXG4gICAgICB9KTtcbiAgICB9XG4gICovXG4gIHB1YmxpYyBnZXRSYXdWYWx1ZShpZE9yTmFtZTogbnVtYmVyIHwgc3RyaW5nKTogYW55IHtcbiAgICBjb25zdCBpZCA9IHRoaXMuZ2V0SWQoaWRPck5hbWUpO1xuICAgIGNvbnN0IHsgWyR2YWx1ZXNdOiB2YWx1ZXMgfSA9IHRoaXM7XG4gICAgcmV0dXJuIHZhbHVlc1tpZF07XG4gIH1cblxuICBwdWJsaWMgc2V0UmF3VmFsdWUoaWRPck5hbWU6IG51bWJlciB8IHN0cmluZywgdmFsdWU6IGFueSwgaXNEaXJ0eSA9IHRydWUpIHtcbiAgICAvLyBkZWJ1Zyhgc2V0UmF3VmFsdWUoJHtpZE9yTmFtZX0sICR7SlNPTi5zdHJpbmdpZnkoc2FmZU51bWJlcih2YWx1ZSkpfSlgKTtcbiAgICBjb25zdCBpZCA9IHRoaXMuZ2V0SWQoaWRPck5hbWUpO1xuICAgIGNvbnN0IHsgWyR2YWx1ZXNdOiB2YWx1ZXMsIFskZXJyb3JzXTogZXJyb3JzIH0gPSB0aGlzO1xuICAgIHZhbHVlc1tpZF0gPSBzYWZlTnVtYmVyKHZhbHVlKTtcbiAgICBkZWxldGUgZXJyb3JzW2lkXTtcbiAgICB0aGlzLnNldERpcnR5KGlkLCBpc0RpcnR5KTtcbiAgfVxuXG4gIHB1YmxpYyBnZXRFcnJvcihpZE9yTmFtZTogbnVtYmVyIHwgc3RyaW5nKTogYW55IHtcbiAgICBjb25zdCBpZCA9IHRoaXMuZ2V0SWQoaWRPck5hbWUpO1xuICAgIGNvbnN0IHsgWyRlcnJvcnNdOiBlcnJvcnMgfSA9IHRoaXM7XG4gICAgcmV0dXJuIGVycm9yc1tpZF07XG4gIH1cblxuICBwdWJsaWMgc2V0RXJyb3IoaWRPck5hbWU6IG51bWJlciB8IHN0cmluZywgZXJyb3I/OiBFcnJvcikge1xuICAgIGNvbnN0IGlkID0gdGhpcy5nZXRJZChpZE9yTmFtZSk7XG4gICAgY29uc3QgeyBbJGVycm9yc106IGVycm9ycyB9ID0gdGhpcztcbiAgICBpZiAoZXJyb3IgIT0gbnVsbCkge1xuICAgICAgZXJyb3JzW2lkXSA9IGVycm9yO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgZXJyb3JzW2lkXTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgaXNEaXJ0eShpZE9yTmFtZTogc3RyaW5nIHwgbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgY29uc3QgaWQgPSB0aGlzLmdldElkKGlkT3JOYW1lKTtcbiAgICBjb25zdCB7IFskZGlydGllc106IGRpcnRpZXMgfSA9IHRoaXM7XG4gICAgcmV0dXJuICEhZGlydGllc1tpZF07XG4gIH1cblxuICBwdWJsaWMgc2V0RGlydHkoaWRPck5hbWU6IHN0cmluZyB8IG51bWJlciwgaXNEaXJ0eSA9IHRydWUpIHtcbiAgICBjb25zdCBpZCA9IHRoaXMuZ2V0SWQoaWRPck5hbWUpO1xuICAgIGNvbnN0IG1hcDogeyBbaWQ6IG51bWJlcl06IHN0cmluZ1tdIH0gPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBjb25zdCB7IFskZGlydGllc106IGRpcnRpZXMgfSA9IHRoaXM7XG4gICAgaWYgKGlzRGlydHkpIHtcbiAgICAgIGRpcnRpZXNbaWRdID0gdHJ1ZTtcbiAgICAgIC8vIFRPRE86IGltcGxlbWVudCBhdXRvc2F2ZVxuICAgICAgLy8gdGhpcy53cml0ZShpZCkuY2F0Y2goKCkgPT4ge30pO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgZGlydGllc1tpZF07XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEBldmVudCBJRGV2aWNlI2NoYW5nZWRcbiAgICAgKiBAZXZlbnQgSURldmljZSNjaGFuZ2luZ1xuICAgICAqL1xuICAgIGNvbnN0IG5hbWVzID0gbWFwW2lkXSB8fCBbXTtcbiAgICB0aGlzLmVtaXQoXG4gICAgICBpc0RpcnR5ID8gJ2NoYW5naW5nJyA6ICdjaGFuZ2VkJyxcbiAgICAgIHtcbiAgICAgICAgaWQsXG4gICAgICAgIG5hbWVzLFxuICAgICAgfSxcbiAgICApO1xuICB9XG5cbiAgcHVibGljIGFkZHJlZigpIHtcbiAgICB0aGlzLiRjb3VudFJlZiArPSAxO1xuICAgIHJldHVybiB0aGlzLiRjb3VudFJlZjtcbiAgfVxuXG4gIHB1YmxpYyByZWxlYXNlKCkge1xuICAgIHRoaXMuJGNvdW50UmVmIC09IDE7XG4gICAgaWYgKHRoaXMuJGNvdW50UmVmIDw9IDApIHtcbiAgICAgIGRlbGV0ZSBkZXZpY2VNYXBbdGhpcy5hZGRyZXNzLnRvU3RyaW5nKCldO1xuICAgICAgLyoqXG4gICAgICAgKiBAZXZlbnQgRGV2aWNlcyNkZWxldGVcbiAgICAgICAqL1xuICAgICAgZGV2aWNlcy5lbWl0KCdkZWxldGUnLCB0aGlzKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuJGNvdW50UmVmO1xuICB9XG5cbiAgcHVibGljIGRyYWluKCk6IFByb21pc2U8bnVtYmVyW10+IHtcbiAgICBkZWJ1ZyhgZHJhaW4gWyR7dGhpcy5hZGRyZXNzfV1gKTtcbiAgICBjb25zdCB7IFskZGlydGllc106IGRpcnRpZXMgfSA9IHRoaXM7XG4gICAgY29uc3QgaWRzID0gT2JqZWN0LmtleXMoZGlydGllcykubWFwKE51bWJlcikuZmlsdGVyKGlkID0+IGRpcnRpZXNbaWRdKTtcbiAgICByZXR1cm4gaWRzLmxlbmd0aCA+IDAgPyB0aGlzLndyaXRlKC4uLmlkcykuY2F0Y2goKCkgPT4gW10pIDogUHJvbWlzZS5yZXNvbHZlKFtdKTtcbiAgfVxuXG4gIHByaXZhdGUgd3JpdGVBbGwoKSB7XG4gICAgY29uc3QgeyBbJHZhbHVlc106IHZhbHVlcyB9ID0gdGhpcztcbiAgICBjb25zdCBtYXAgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBjb25zdCBpZHMgPSBPYmplY3QuZW50cmllcyh2YWx1ZXMpXG4gICAgICAuZmlsdGVyKChbLCB2YWx1ZV0pID0+IHZhbHVlICE9IG51bGwpXG4gICAgICAubWFwKChbaWRdKSA9PiBOdW1iZXIoaWQpKVxuICAgICAgLmZpbHRlcigoaWQgPT4gUmVmbGVjdC5nZXRNZXRhZGF0YSgnaXNXcml0YWJsZScsIHRoaXMsIG1hcFtpZF1bMF0pKSk7XG4gICAgcmV0dXJuIGlkcy5sZW5ndGggPiAwID8gdGhpcy53cml0ZSguLi5pZHMpIDogUHJvbWlzZS5yZXNvbHZlKFtdKTtcbiAgfVxuXG4gIHB1YmxpYyB3cml0ZSguLi5pZHM6IG51bWJlcltdKTogUHJvbWlzZTxudW1iZXJbXT4ge1xuICAgIGNvbnN0IHsgY29ubmVjdGlvbiB9ID0gdGhpcztcbiAgICBpZiAoIWNvbm5lY3Rpb24pIHJldHVybiBQcm9taXNlLnJlamVjdChgJHt0aGlzLmFkZHJlc3N9IGlzIGRpc2Nvbm5lY3RlZGApO1xuICAgIGlmIChpZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gdGhpcy53cml0ZUFsbCgpO1xuICAgIH1cbiAgICBkZWJ1Zyhgd3JpdGluZyAke2lkcy5qb2luKCl9IHRvIFske3RoaXMuYWRkcmVzc31dYCk7XG4gICAgY29uc3QgbWFwID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWFwJywgdGhpcyk7XG4gICAgY29uc3QgcmVxdWVzdHMgPSBpZHMucmVkdWNlKFxuICAgICAgKGFjYzogTm1zRGF0YWdyYW1bXSwgaWQpID0+IHtcbiAgICAgICAgY29uc3QgW25hbWVdID0gbWFwW2lkXTtcbiAgICAgICAgaWYgKCFuYW1lKSB7XG4gICAgICAgICAgZGVidWcoYFVua25vd24gaWQ6ICR7aWR9IGZvciAke1JlZmxlY3QuZ2V0TWV0YWRhdGEoJ21pYicsIHRoaXMpfWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGFjYy5wdXNoKGNyZWF0ZU5tc1dyaXRlKFxuICAgICAgICAgICAgdGhpcy5hZGRyZXNzLFxuICAgICAgICAgICAgaWQsXG4gICAgICAgICAgICBSZWZsZWN0LmdldE1ldGFkYXRhKCdubXNUeXBlJywgdGhpcywgbmFtZSksXG4gICAgICAgICAgICB0aGlzLmdldFJhd1ZhbHVlKGlkKSxcbiAgICAgICAgICApKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgfSxcbiAgICAgIFtdLFxuICAgICk7XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKFxuICAgICAgcmVxdWVzdHNcbiAgICAgICAgLm1hcChkYXRhZ3JhbSA9PiBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShkYXRhZ3JhbSlcbiAgICAgICAgICAudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHsgc3RhdHVzIH0gPSByZXNwb25zZSBhcyBObXNEYXRhZ3JhbTtcbiAgICAgICAgICAgIGlmIChzdGF0dXMgPT09IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5zZXREaXJ0eShkYXRhZ3JhbS5pZCwgZmFsc2UpO1xuICAgICAgICAgICAgICByZXR1cm4gZGF0YWdyYW0uaWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnNldEVycm9yKGRhdGFncmFtLmlkLCBuZXcgTmlidXNFcnJvcihzdGF0dXMhLCB0aGlzKSk7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgfSwgKHJlYXNvbikgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXRFcnJvcihkYXRhZ3JhbS5pZCwgcmVhc29uKTtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICB9KSkpXG4gICAgICAudGhlbihpZHMgPT4gaWRzLmZpbHRlcihpZCA9PiBpZCA+IDApKTtcbiAgfVxuXG4gIHB1YmxpYyB3cml0ZVZhbHVlcyhzb3VyY2U6IG9iamVjdCwgc3Ryb25nID0gdHJ1ZSk6IFByb21pc2U8bnVtYmVyW10+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgaWRzID0gT2JqZWN0LmtleXMoc291cmNlKS5tYXAobmFtZSA9PiB0aGlzLmdldElkKG5hbWUpKTtcbiAgICAgIGlmIChpZHMubGVuZ3RoID09PSAwKSByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IFR5cGVFcnJvcigndmFsdWUgaXMgZW1wdHknKSk7XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMsIHNvdXJjZSk7XG4gICAgICByZXR1cm4gdGhpcy53cml0ZSguLi5pZHMpXG4gICAgICAgIC50aGVuKCh3cml0dGVuKSA9PiB7XG4gICAgICAgICAgaWYgKHdyaXR0ZW4ubGVuZ3RoID09PSAwIHx8IChzdHJvbmcgJiYgd3JpdHRlbi5sZW5ndGggIT09IGlkcy5sZW5ndGgpKSB7XG4gICAgICAgICAgICB0aHJvdyB0aGlzLmdldEVycm9yKGlkc1swXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB3cml0dGVuO1xuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcmVhZEFsbCgpOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IG1hcDogeyBbaWQ6IHN0cmluZ106IHN0cmluZ1tdIH0gPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBjb25zdCBpZHMgPSBPYmplY3QuZW50cmllcyhtYXApXG4gICAgICAuZmlsdGVyKChbLCBuYW1lc10pID0+IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ2lzUmVhZGFibGUnLCB0aGlzLCBuYW1lc1swXSkpXG4gICAgICAubWFwKChbaWRdKSA9PiBOdW1iZXIoaWQpKTtcbiAgICByZXR1cm4gaWRzLmxlbmd0aCA+IDAgPyB0aGlzLnJlYWQoLi4uaWRzKSA6IFByb21pc2UucmVzb2x2ZShbXSk7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcmVhZCguLi5pZHM6IG51bWJlcltdKTogUHJvbWlzZTx7IFtuYW1lOiBzdHJpbmddOiBhbnkgfT4ge1xuICAgIGNvbnN0IHsgY29ubmVjdGlvbiB9ID0gdGhpcztcbiAgICBpZiAoIWNvbm5lY3Rpb24pIHJldHVybiBQcm9taXNlLnJlamVjdCgnZGlzY29ubmVjdGVkJyk7XG4gICAgaWYgKGlkcy5sZW5ndGggPT09IDApIHJldHVybiB0aGlzLnJlYWRBbGwoKTtcbiAgICAvLyBkZWJ1ZyhgcmVhZCAke2lkcy5qb2luKCl9IGZyb20gWyR7dGhpcy5hZGRyZXNzfV1gKTtcbiAgICBjb25zdCBkaXNhYmxlQmF0Y2hSZWFkaW5nID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnZGlzYWJsZUJhdGNoUmVhZGluZycsIHRoaXMpO1xuICAgIGNvbnN0IG1hcDogeyBbaWQ6IHN0cmluZ106IHN0cmluZ1tdIH0gPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBjb25zdCBjaHVua3MgPSBjaHVua0FycmF5KGlkcywgZGlzYWJsZUJhdGNoUmVhZGluZyA/IDEgOiAyMSk7XG4gICAgZGVidWcoYHJlYWQgWyR7Y2h1bmtzLm1hcChjaHVuayA9PiBgWyR7Y2h1bmsuam9pbigpfV1gKS5qb2luKCl9XSBmcm9tIFske3RoaXMuYWRkcmVzc31dYCk7XG4gICAgY29uc3QgcmVxdWVzdHMgPSBjaHVua3MubWFwKGNodW5rID0+IGNyZWF0ZU5tc1JlYWQodGhpcy5hZGRyZXNzLCAuLi5jaHVuaykpO1xuICAgIHJldHVybiByZXF1ZXN0cy5yZWR1Y2UoXG4gICAgICBhc3luYyAocHJvbWlzZSwgZGF0YWdyYW0pID0+IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvbWlzZTtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShkYXRhZ3JhbSk7XG4gICAgICAgIGNvbnN0IGRhdGFncmFtczogTm1zRGF0YWdyYW1bXSA9IEFycmF5LmlzQXJyYXkocmVzcG9uc2UpXG4gICAgICAgICAgPyByZXNwb25zZSBhcyBObXNEYXRhZ3JhbVtdXG4gICAgICAgICAgOiBbcmVzcG9uc2UgYXMgTm1zRGF0YWdyYW1dO1xuICAgICAgICBkYXRhZ3JhbXMuZm9yRWFjaCgoeyBpZCwgdmFsdWUsIHN0YXR1cyB9KSA9PiB7XG4gICAgICAgICAgaWYgKHN0YXR1cyA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5zZXRSYXdWYWx1ZShpZCwgdmFsdWUsIGZhbHNlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zZXRFcnJvcihpZCwgbmV3IE5pYnVzRXJyb3Ioc3RhdHVzISwgdGhpcykpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBuYW1lcyA9IG1hcFtpZF07XG4gICAgICAgICAgY29uc29sZS5hc3NlcnQobmFtZXMgJiYgbmFtZXMubGVuZ3RoID4gMCwgYEludmFsaWQgaWQgJHtpZH1gKTtcbiAgICAgICAgICBuYW1lcy5mb3JFYWNoKChwcm9wTmFtZSkgPT4ge1xuICAgICAgICAgICAgcmVzdWx0W3Byb3BOYW1lXSA9IHN0YXR1cyA9PT0gMFxuICAgICAgICAgICAgICA/IHRoaXNbcHJvcE5hbWVdXG4gICAgICAgICAgICAgIDogeyBlcnJvcjogKHRoaXMuZ2V0RXJyb3IoaWQpIHx8IHt9KS5tZXNzYWdlIHx8ICdlcnJvcicgfTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9LFxuICAgICAgUHJvbWlzZS5yZXNvbHZlKHt9IGFzIHsgW25hbWU6IHN0cmluZ106IGFueSB9KSxcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgdXBsb2FkKGRvbWFpbjogc3RyaW5nLCBvZmZzZXQgPSAwLCBzaXplPzogbnVtYmVyKTogUHJvbWlzZTxCdWZmZXI+IHtcbiAgICBjb25zdCB7IGNvbm5lY3Rpb24gfSA9IHRoaXM7XG4gICAgdHJ5IHtcbiAgICAgIGlmICghY29ubmVjdGlvbikgdGhyb3cgbmV3IEVycm9yKCdkaXNjb25uZWN0ZWQnKTtcbiAgICAgIGNvbnN0IHJlcVVwbG9hZCA9IGNyZWF0ZU5tc1JlcXVlc3REb21haW5VcGxvYWQodGhpcy5hZGRyZXNzLCBkb21haW4ucGFkRW5kKDgsICdcXDAnKSk7XG4gICAgICBjb25zdCB7IGlkLCB2YWx1ZTogZG9tYWluU2l6ZSwgc3RhdHVzIH0gPVxuICAgICAgICBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShyZXFVcGxvYWQpIGFzIE5tc0RhdGFncmFtO1xuICAgICAgaWYgKHN0YXR1cyAhPT0gMCkge1xuICAgICAgICAvLyBkZWJ1ZygnPGVycm9yPicsIHN0YXR1cyk7XG4gICAgICAgIHRocm93IG5ldyBOaWJ1c0Vycm9yKHN0YXR1cyEsIHRoaXMsICdSZXF1ZXN0IHVwbG9hZCBkb21haW4gZXJyb3InKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGluaXRVcGxvYWQgPSBjcmVhdGVObXNJbml0aWF0ZVVwbG9hZFNlcXVlbmNlKHRoaXMuYWRkcmVzcywgaWQpO1xuICAgICAgY29uc3QgeyBzdGF0dXM6IGluaXRTdGF0IH0gPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShpbml0VXBsb2FkKSBhcyBObXNEYXRhZ3JhbTtcbiAgICAgIGlmIChpbml0U3RhdCAhPT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgTmlidXNFcnJvcihpbml0U3RhdCEsIHRoaXMsICdJbml0aWF0ZSB1cGxvYWQgZG9tYWluIGVycm9yJyk7XG4gICAgICB9XG4gICAgICBjb25zdCB0b3RhbCA9IHNpemUgfHwgKGRvbWFpblNpemUgLSBvZmZzZXQpO1xuICAgICAgbGV0IHJlc3QgPSB0b3RhbDtcbiAgICAgIGxldCBwb3MgPSBvZmZzZXQ7XG4gICAgICB0aGlzLmVtaXQoXG4gICAgICAgICd1cGxvYWRTdGFydCcsXG4gICAgICAgIHtcbiAgICAgICAgICBkb21haW4sXG4gICAgICAgICAgZG9tYWluU2l6ZSxcbiAgICAgICAgICBvZmZzZXQsXG4gICAgICAgICAgc2l6ZTogdG90YWwsXG4gICAgICAgIH0sXG4gICAgICApO1xuICAgICAgY29uc3QgYnVmczogQnVmZmVyW10gPSBbXTtcbiAgICAgIHdoaWxlIChyZXN0ID4gMCkge1xuICAgICAgICBjb25zdCBsZW5ndGggPSBNYXRoLm1pbigyNTUsIHJlc3QpO1xuICAgICAgICBjb25zdCB1cGxvYWRTZWdtZW50ID0gY3JlYXRlTm1zVXBsb2FkU2VnbWVudCh0aGlzLmFkZHJlc3MsIGlkLCBwb3MsIGxlbmd0aCk7XG4gICAgICAgIGNvbnN0IHsgc3RhdHVzOiB1cGxvYWRTdGF0dXMsIHZhbHVlOiByZXN1bHQgfSA9XG4gICAgICAgICAgYXdhaXQgY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0odXBsb2FkU2VnbWVudCkgYXMgTm1zRGF0YWdyYW07XG4gICAgICAgIGlmICh1cGxvYWRTdGF0dXMgIT09IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgTmlidXNFcnJvcih1cGxvYWRTdGF0dXMhLCB0aGlzLCAnVXBsb2FkIHNlZ21lbnQgZXJyb3InKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVzdWx0LmRhdGEubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgYnVmcy5wdXNoKHJlc3VsdC5kYXRhKTtcbiAgICAgICAgdGhpcy5lbWl0KFxuICAgICAgICAgICd1cGxvYWREYXRhJyxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBkb21haW4sXG4gICAgICAgICAgICBwb3MsXG4gICAgICAgICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgICAgICB9LFxuICAgICAgICApO1xuICAgICAgICByZXN0IC09IHJlc3VsdC5kYXRhLmxlbmd0aDtcbiAgICAgICAgcG9zICs9IHJlc3VsdC5kYXRhLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHJlc3VsdCA9IEJ1ZmZlci5jb25jYXQoYnVmcyk7XG4gICAgICB0aGlzLmVtaXQoXG4gICAgICAgICd1cGxvYWRGaW5pc2gnLFxuICAgICAgICB7XG4gICAgICAgICAgZG9tYWluLFxuICAgICAgICAgIG9mZnNldCxcbiAgICAgICAgICBkYXRhOiByZXN1bHQsXG4gICAgICAgIH0sXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLmVtaXQoJ3VwbG9hZEVycm9yJywgZSk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGRvd25sb2FkKGRvbWFpbjogc3RyaW5nLCBidWZmZXI6IEJ1ZmZlciwgb2Zmc2V0ID0gMCwgbm9UZXJtID0gZmFsc2UpIHtcbiAgICBjb25zdCB7IGNvbm5lY3Rpb24gfSA9IHRoaXM7XG4gICAgaWYgKCFjb25uZWN0aW9uKSB0aHJvdyBuZXcgRXJyb3IoJ2Rpc2Nvbm5lY3RlZCcpO1xuICAgIGNvbnN0IHJlcURvd25sb2FkID0gY3JlYXRlTm1zUmVxdWVzdERvbWFpbkRvd25sb2FkKHRoaXMuYWRkcmVzcywgZG9tYWluLnBhZEVuZCg4LCAnXFwwJykpO1xuICAgIGNvbnN0IHsgaWQsIHZhbHVlOiBtYXgsIHN0YXR1cyB9ID0gYXdhaXQgY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0ocmVxRG93bmxvYWQpIGFzIE5tc0RhdGFncmFtO1xuICAgIGlmIChzdGF0dXMgIT09IDApIHtcbiAgICAgIC8vIGRlYnVnKCc8ZXJyb3I+Jywgc3RhdHVzKTtcbiAgICAgIHRocm93IG5ldyBOaWJ1c0Vycm9yKHN0YXR1cyEsIHRoaXMsICdSZXF1ZXN0IGRvd25sb2FkIGRvbWFpbiBlcnJvcicpO1xuICAgIH1cbiAgICBjb25zdCB0ZXJtaW5hdGUgPSBhc3luYyAoZXJyPzogRXJyb3IpID0+IHtcbiAgICAgIGxldCB0ZXJtU3RhdCA9IDA7XG4gICAgICBpZiAoIW5vVGVybSkge1xuICAgICAgICBjb25zdCByZXEgPSBjcmVhdGVObXNUZXJtaW5hdGVEb3dubG9hZFNlcXVlbmNlKHRoaXMuYWRkcmVzcywgaWQpO1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShyZXEpIGFzIE5tc0RhdGFncmFtO1xuICAgICAgICB0ZXJtU3RhdCA9IHJlcy5zdGF0dXMhO1xuICAgICAgfVxuICAgICAgaWYgKGVycikgdGhyb3cgZXJyO1xuICAgICAgaWYgKHRlcm1TdGF0ICE9PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBOaWJ1c0Vycm9yKFxuICAgICAgICAgIHRlcm1TdGF0ISxcbiAgICAgICAgICB0aGlzLFxuICAgICAgICAgICdUZXJtaW5hdGUgZG93bmxvYWQgc2VxdWVuY2UgZXJyb3IsIG1heWJlIG5lZWQgLS1uby10ZXJtJyk7XG4gICAgICB9XG4gICAgfTtcbiAgICBpZiAoYnVmZmVyLmxlbmd0aCA+IG1heCAtIG9mZnNldCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBCdWZmZXIgdG8gbGFyZ2UuIEV4cGVjdGVkICR7bWF4IC0gb2Zmc2V0fSBieXRlc2ApO1xuICAgIH1cbiAgICBjb25zdCBpbml0RG93bmxvYWQgPSBjcmVhdGVObXNJbml0aWF0ZURvd25sb2FkU2VxdWVuY2UodGhpcy5hZGRyZXNzLCBpZCk7XG4gICAgY29uc3QgeyBzdGF0dXM6IGluaXRTdGF0IH0gPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShpbml0RG93bmxvYWQpIGFzIE5tc0RhdGFncmFtO1xuICAgIGlmIChpbml0U3RhdCAhPT0gMCkge1xuICAgICAgdGhyb3cgbmV3IE5pYnVzRXJyb3IoaW5pdFN0YXQhLCB0aGlzLCAnSW5pdGlhdGUgZG93bmxvYWQgZG9tYWluIGVycm9yJyk7XG4gICAgfVxuICAgIHRoaXMuZW1pdChcbiAgICAgICdkb3dubG9hZFN0YXJ0JyxcbiAgICAgIHtcbiAgICAgICAgZG9tYWluLFxuICAgICAgICBvZmZzZXQsXG4gICAgICAgIGRvbWFpblNpemU6IG1heCxcbiAgICAgICAgc2l6ZTogYnVmZmVyLmxlbmd0aCxcbiAgICAgIH0sXG4gICAgKTtcbiAgICBjb25zdCBjcmMgPSBjcmMxNmNjaXR0KGJ1ZmZlciwgMCk7XG4gICAgY29uc3QgY2h1bmtTaXplID0gTk1TX01BWF9EQVRBX0xFTkdUSCAtIDQ7XG4gICAgY29uc3QgY2h1bmtzID0gY2h1bmtBcnJheShidWZmZXIsIGNodW5rU2l6ZSk7XG4gICAgYXdhaXQgY2h1bmtzLnJlZHVjZShhc3luYyAocHJldiwgY2h1bms6IEJ1ZmZlciwgaSkgPT4ge1xuICAgICAgYXdhaXQgcHJldjtcbiAgICAgIGNvbnN0IHBvcyA9IGkgKiBjaHVua1NpemUgKyBvZmZzZXQ7XG4gICAgICBjb25zdCBzZWdtZW50RG93bmxvYWQgPVxuICAgICAgICBjcmVhdGVObXNEb3dubG9hZFNlZ21lbnQodGhpcy5hZGRyZXNzLCBpZCEsIHBvcywgY2h1bmspO1xuICAgICAgY29uc3QgeyBzdGF0dXM6IGRvd25sb2FkU3RhdCB9ID1cbiAgICAgICAgYXdhaXQgY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0oc2VnbWVudERvd25sb2FkKSBhcyBObXNEYXRhZ3JhbTtcbiAgICAgIGlmIChkb3dubG9hZFN0YXQgIT09IDApIHtcbiAgICAgICAgYXdhaXQgdGVybWluYXRlKG5ldyBOaWJ1c0Vycm9yKGRvd25sb2FkU3RhdCEsIHRoaXMsICdEb3dubG9hZCBzZWdtZW50IGVycm9yJykpO1xuICAgICAgfVxuICAgICAgdGhpcy5lbWl0KFxuICAgICAgICAnZG93bmxvYWREYXRhJyxcbiAgICAgICAge1xuICAgICAgICAgIGRvbWFpbixcbiAgICAgICAgICBsZW5ndGg6IGNodW5rLmxlbmd0aCxcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgfSwgUHJvbWlzZS5yZXNvbHZlKCkpO1xuICAgIGNvbnN0IHZlcmlmeSA9IGNyZWF0ZU5tc1ZlcmlmeURvbWFpbkNoZWNrc3VtKHRoaXMuYWRkcmVzcywgaWQsIG9mZnNldCwgYnVmZmVyLmxlbmd0aCwgY3JjKTtcbiAgICBjb25zdCB7IHN0YXR1czogdmVyaWZ5U3RhdCB9ID0gYXdhaXQgY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0odmVyaWZ5KSBhcyBObXNEYXRhZ3JhbTtcbiAgICBpZiAodmVyaWZ5U3RhdCAhPT0gMCkge1xuICAgICAgYXdhaXQgdGVybWluYXRlKG5ldyBOaWJ1c0Vycm9yKHZlcmlmeVN0YXQhLCB0aGlzLCAnRG93bmxvYWQgc2VnbWVudCBlcnJvcicpKTtcbiAgICB9XG4gICAgYXdhaXQgdGVybWluYXRlKCk7XG4gICAgdGhpcy5lbWl0KFxuICAgICAgJ2Rvd25sb2FkRmluaXNoJyxcbiAgICAgIHtcbiAgICAgICAgZG9tYWluLFxuICAgICAgICBvZmZzZXQsXG4gICAgICAgIHNpemU6IGJ1ZmZlci5sZW5ndGgsXG4gICAgICB9LFxuICAgICk7XG4gIH1cblxuICBhc3luYyBleGVjdXRlKHByb2dyYW06IHN0cmluZywgYXJncz86IFJlY29yZDxzdHJpbmcsIGFueT4pIHtcbiAgICBjb25zdCB7IGNvbm5lY3Rpb24gfSA9IHRoaXM7XG4gICAgaWYgKCFjb25uZWN0aW9uKSB0aHJvdyBuZXcgRXJyb3IoJ2Rpc2Nvbm5lY3RlZCcpO1xuICAgIGNvbnN0IHN1YnJvdXRpbmVzID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnc3Vicm91dGluZXMnLCB0aGlzKSBhcyBSZWNvcmQ8c3RyaW5nLCBJU3Vicm91dGluZURlc2M+O1xuICAgIGlmICghc3Vicm91dGluZXMgfHwgIVJlZmxlY3QuaGFzKHN1YnJvdXRpbmVzLCBwcm9ncmFtKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHByb2dyYW0gJHtwcm9ncmFtfWApO1xuICAgIH1cbiAgICBjb25zdCBzdWJyb3V0aW5lID0gc3Vicm91dGluZXNbcHJvZ3JhbV07XG4gICAgY29uc3QgcHJvcHM6IFR5cGVkVmFsdWVbXSA9IFtdO1xuICAgIGlmIChzdWJyb3V0aW5lLmFyZ3MpIHtcbiAgICAgIE9iamVjdC5lbnRyaWVzKHN1YnJvdXRpbmUuYXJncykuZm9yRWFjaCgoW25hbWUsIGRlc2NdKSA9PiB7XG4gICAgICAgIGNvbnN0IGFyZyA9IGFyZ3MgJiYgYXJnc1tuYW1lXTtcbiAgICAgICAgaWYgKCFhcmcpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgYXJnICR7bmFtZX0gaW4gcHJvZ3JhbSAke3Byb2dyYW19YCk7XG4gICAgICAgIHByb3BzLnB1c2goW2Rlc2MudHlwZSwgYXJnXSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgY29uc3QgcmVxID0gY3JlYXRlRXhlY3V0ZVByb2dyYW1JbnZvY2F0aW9uKFxuICAgICAgdGhpcy5hZGRyZXNzLFxuICAgICAgc3Vicm91dGluZS5pZCxcbiAgICAgIHN1YnJvdXRpbmUubm90UmVwbHksXG4gICAgICAuLi5wcm9wcyxcbiAgICApO1xuICAgIHJldHVybiBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShyZXEpO1xuICB9XG59XG5cbi8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZVxuaW50ZXJmYWNlIERldmljZVByb3RvdHlwZSB7XG4gIHJlYWRvbmx5IGFkZHJlc3M6IEFkZHJlc3M7XG4gIFttaWJQcm9wZXJ0eTogc3RyaW5nXTogYW55O1xuICAkY291bnRSZWY6IG51bWJlcjtcbiAgWyR2YWx1ZXNdOiB7IFtpZDogbnVtYmVyXTogYW55IH07XG4gIFskZXJyb3JzXTogeyBbaWQ6IG51bWJlcl06IEVycm9yIH07XG4gIFskZGlydGllc106IHsgW2lkOiBudW1iZXJdOiBib29sZWFuIH07XG59XG5cbmZ1bmN0aW9uIGZpbmRNaWJCeVR5cGUodHlwZTogbnVtYmVyLCB2ZXJzaW9uPzogbnVtYmVyKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgY29uc3QgY29uZiA9IHBhdGgucmVzb2x2ZShjb25maWdEaXIgfHwgJy90bXAnLCAnY29uZmlnc3RvcmUnLCBwa2dOYW1lKTtcbiAgY29uc3QgdmFsaWRhdGUgPSBDb25maWdWLmRlY29kZShyZXF1aXJlKGNvbmYpKTtcbiAgaWYgKHZhbGlkYXRlLmlzTGVmdCgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGNvbmZpZyBmaWxlICR7Y29uZn1cbiAgJHtQYXRoUmVwb3J0ZXIucmVwb3J0KHZhbGlkYXRlKX1gKTtcbiAgfVxuICBjb25zdCB7IG1pYlR5cGVzIH0gPSB2YWxpZGF0ZS52YWx1ZTtcbiAgY29uc3QgbWlicyA9IG1pYlR5cGVzIVt0eXBlXTtcbiAgaWYgKG1pYnMgJiYgbWlicy5sZW5ndGgpIHtcbiAgICBsZXQgbWliVHlwZSA9IG1pYnNbMF07XG4gICAgaWYgKHZlcnNpb24gJiYgbWlicy5sZW5ndGggPiAxKSB7XG4gICAgICBtaWJUeXBlID0gXy5maW5kTGFzdChtaWJzLCAoeyBtaW5WZXJzaW9uID0gMCB9KSA9PiBtaW5WZXJzaW9uIDw9IHZlcnNpb24pIHx8IG1pYlR5cGU7XG4gICAgfVxuICAgIHJldHVybiBtaWJUeXBlLm1pYjtcbiAgfVxuICAvLyBjb25zdCBjYWNoZU1pYnMgPSBPYmplY3Qua2V5cyhtaWJUeXBlc0NhY2hlKTtcbiAgLy8gY29uc3QgY2FjaGVkID0gY2FjaGVNaWJzLmZpbmQobWliID0+XG4gIC8vICAgUmVmbGVjdC5nZXRNZXRhZGF0YSgnZGV2aWNlVHlwZScsIG1pYlR5cGVzQ2FjaGVbbWliXS5wcm90b3R5cGUpID09PSB0eXBlKTtcbiAgLy8gaWYgKGNhY2hlZCkgcmV0dXJuIGNhY2hlZDtcbiAgLy8gY29uc3QgbWlicyA9IGdldE1pYnNTeW5jKCk7XG4gIC8vIHJldHVybiBfLmRpZmZlcmVuY2UobWlicywgY2FjaGVNaWJzKS5maW5kKChtaWJOYW1lKSA9PiB7XG4gIC8vICAgY29uc3QgbWliZmlsZSA9IGdldE1pYkZpbGUobWliTmFtZSk7XG4gIC8vICAgY29uc3QgbWliOiBJTWliRGV2aWNlID0gcmVxdWlyZShtaWJmaWxlKTtcbiAgLy8gICBjb25zdCB7IHR5cGVzIH0gPSBtaWI7XG4gIC8vICAgY29uc3QgZGV2aWNlID0gdHlwZXNbbWliLmRldmljZV0gYXMgSU1pYkRldmljZVR5cGU7XG4gIC8vICAgcmV0dXJuIHRvSW50KGRldmljZS5hcHBpbmZvLmRldmljZV90eXBlKSA9PT0gdHlwZTtcbiAgLy8gfSk7XG59XG5cbmRlY2xhcmUgaW50ZXJmYWNlIERldmljZXMge1xuICBvbihldmVudDogJ25ldycgfCAnZGVsZXRlJywgZGV2aWNlTGlzdGVuZXI6IChkZXZpY2U6IElEZXZpY2UpID0+IHZvaWQpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnbmV3JyB8ICdkZWxldGUnLCBkZXZpY2VMaXN0ZW5lcjogKGRldmljZTogSURldmljZSkgPT4gdm9pZCk6IHRoaXM7XG4gIGFkZExpc3RlbmVyKGV2ZW50OiAnbmV3JyB8ICdkZWxldGUnLCBkZXZpY2VMaXN0ZW5lcjogKGRldmljZTogSURldmljZSkgPT4gdm9pZCk6IHRoaXM7XG59XG5cbmZ1bmN0aW9uIGdldENvbnN0cnVjdG9yKG1pYjogc3RyaW5nKTogRnVuY3Rpb24ge1xuICBsZXQgY29uc3RydWN0b3IgPSBtaWJUeXBlc0NhY2hlW21pYl07XG4gIGlmICghY29uc3RydWN0b3IpIHtcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmVcbiAgICBmdW5jdGlvbiBEZXZpY2UodGhpczogRGV2aWNlUHJvdG90eXBlLCBhZGRyZXNzOiBBZGRyZXNzKSB7XG4gICAgICBFdmVudEVtaXR0ZXIuYXBwbHkodGhpcyk7XG4gICAgICB0aGlzWyR2YWx1ZXNdID0ge307XG4gICAgICB0aGlzWyRlcnJvcnNdID0ge307XG4gICAgICB0aGlzWyRkaXJ0aWVzXSA9IHt9O1xuICAgICAgUmVmbGVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnYWRkcmVzcycsIHdpdGhWYWx1ZShhZGRyZXNzKSk7XG4gICAgICB0aGlzLiRjb3VudFJlZiA9IDE7XG4gICAgICAvLyB0aGlzLiRkZWJvdW5jZURyYWluID0gXy5kZWJvdW5jZSh0aGlzLmRyYWluLCAyNSk7XG4gICAgfVxuXG4gICAgY29uc3QgcHJvdG90eXBlID0gbmV3IERldmljZVByb3RvdHlwZShtaWIpO1xuICAgIERldmljZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHByb3RvdHlwZSk7XG4gICAgY29uc3RydWN0b3IgPSBEZXZpY2U7XG4gICAgbWliVHlwZXNDYWNoZVttaWJdID0gY29uc3RydWN0b3I7XG4gIH1cbiAgcmV0dXJuIGNvbnN0cnVjdG9yO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TWliUHJvdG90eXBlKG1pYjogc3RyaW5nKTogT2JqZWN0IHtcbiAgcmV0dXJuIGdldENvbnN0cnVjdG9yKG1pYikucHJvdG90eXBlO1xufVxuXG5jbGFzcyBEZXZpY2VzIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgZ2V0ID0gKCk6IElEZXZpY2VbXSA9PiBfLnZhbHVlcyhkZXZpY2VNYXApO1xuXG4gIGZpbmQgPSAoYWRkcmVzczogQWRkcmVzc1BhcmFtKTogSURldmljZSB8IHVuZGVmaW5lZCA9PiB7XG4gICAgY29uc3QgdGFyZ2V0QWRkcmVzcyA9IG5ldyBBZGRyZXNzKGFkZHJlc3MpO1xuICAgIHJldHVybiBkZXZpY2VNYXBbdGFyZ2V0QWRkcmVzcy50b1N0cmluZygpXTtcbiAgfTtcblxuICBjcmVhdGUoYWRkcmVzczogQWRkcmVzc1BhcmFtLCBtaWI6IHN0cmluZyk6IElEZXZpY2U7XG4gIGNyZWF0ZShhZGRyZXNzOiBBZGRyZXNzUGFyYW0sIHR5cGU6IG51bWJlciwgdmVyc2lvbj86IG51bWJlcik6IElEZXZpY2U7XG4gIGNyZWF0ZShhZGRyZXNzOiBBZGRyZXNzUGFyYW0sIG1pYk9yVHlwZTogYW55LCB2ZXJzaW9uPzogbnVtYmVyKTogSURldmljZSB7XG4gICAgbGV0IG1pYjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgIGlmICh0eXBlb2YgbWliT3JUeXBlID09PSAnbnVtYmVyJykge1xuICAgICAgbWliID0gZmluZE1pYkJ5VHlwZShtaWJPclR5cGUsIHZlcnNpb24pO1xuICAgICAgaWYgKG1pYiA9PT0gdW5kZWZpbmVkKSB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gbWliIHR5cGUnKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBtaWJPclR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICBtaWIgPSBTdHJpbmcobWliT3JUeXBlIHx8ICdtaW5paG9zdF92Mi4wNmInKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtaWIgb3IgdHlwZSBleHBlY3RlZCwgZ290ICR7bWliT3JUeXBlfWApO1xuICAgIH1cbiAgICBjb25zdCB0YXJnZXRBZGRyZXNzID0gbmV3IEFkZHJlc3MoYWRkcmVzcyk7XG4gICAgbGV0IGRldmljZSA9IGRldmljZU1hcFt0YXJnZXRBZGRyZXNzLnRvU3RyaW5nKCldO1xuICAgIGlmIChkZXZpY2UpIHtcbiAgICAgIGNvbnNvbGUuYXNzZXJ0KFxuICAgICAgICBSZWZsZWN0LmdldE1ldGFkYXRhKCdtaWInLCBkZXZpY2UpID09PSBtaWIsXG4gICAgICAgIGBtaWJzIGFyZSBkaWZmZXJlbnQsIGV4cGVjdGVkICR7bWlifWAsXG4gICAgICApO1xuICAgICAgZGV2aWNlLmFkZHJlZigpO1xuICAgICAgcmV0dXJuIGRldmljZTtcbiAgICB9XG5cbiAgICBjb25zdCBjb25zdHJ1Y3RvciA9IGdldENvbnN0cnVjdG9yKG1pYik7XG4gICAgZGV2aWNlID0gUmVmbGVjdC5jb25zdHJ1Y3QoY29uc3RydWN0b3IsIFt0YXJnZXRBZGRyZXNzXSk7XG4gICAgaWYgKCF0YXJnZXRBZGRyZXNzLmlzRW1wdHkpIHtcbiAgICAgIGRldmljZU1hcFt0YXJnZXRBZGRyZXNzLnRvU3RyaW5nKCldID0gZGV2aWNlO1xuICAgICAgcHJvY2Vzcy5uZXh0VGljaygoKSA9PiB0aGlzLmVtaXQoJ25ldycsIGRldmljZSkpO1xuICAgIH1cbiAgICByZXR1cm4gZGV2aWNlO1xuICB9XG59XG5cbmNvbnN0IGRldmljZXMgPSBuZXcgRGV2aWNlcygpO1xuXG5leHBvcnQgZGVmYXVsdCBkZXZpY2VzO1xuIl19