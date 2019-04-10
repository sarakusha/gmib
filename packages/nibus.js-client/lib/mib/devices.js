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

var _timeid = _interopRequireDefault(require("../timeid"));

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

  if (type != null) {
    const {
      appinfo: info = {},
      minInclusive,
      maxInclusive
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

    if (minInclusive) {
      converters.push((0, _mib.minInclusiveConverter)(minInclusive));
      Reflect.defineMetadata('min', minInclusive, target, propertyKey);
    }

    if (maxInclusive) {
      converters.push((0, _mib.maxInclusiveConverter)(maxInclusive));
      Reflect.defineMetadata('max', maxInclusive, target, propertyKey);
    }
  }

  if (key === 'brightness' && prop.type === 'xs:unsignedByte') {
    converters.push(_mib.percentConverter);
    Reflect.defineMetadata('unit', '%', target, propertyKey);
    Reflect.defineMetadata('min', 0, target, propertyKey);
    Reflect.defineMetadata('max', 100, target, propertyKey);
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

    _defineProperty(this, "id", (0, _timeid.default)());

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
      this.$countRef = 1;
      debug(new Error('CREATE').stack); // this.$debounceDrain = _.debounce(this.drain, 25);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taWIvZGV2aWNlcy50cyJdLCJuYW1lcyI6WyJwa2dOYW1lIiwiZGVidWciLCIkdmFsdWVzIiwiU3ltYm9sIiwiJGVycm9ycyIsIiRkaXJ0aWVzIiwic2FmZU51bWJlciIsInZhbCIsIm51bSIsInBhcnNlRmxvYXQiLCJOdW1iZXIiLCJpc05hTiIsIlByaXZhdGVQcm9wcyIsImRldmljZU1hcCIsIm1pYlR5cGVzQ2FjaGUiLCJNaWJQcm9wZXJ0eUFwcEluZm9WIiwidCIsImludGVyc2VjdGlvbiIsInR5cGUiLCJubXNfaWQiLCJ1bmlvbiIsInN0cmluZyIsIkludCIsImFjY2VzcyIsInBhcnRpYWwiLCJjYXRlZ29yeSIsIk1pYlByb3BlcnR5ViIsImFubm90YXRpb24iLCJhcHBpbmZvIiwiTWliRGV2aWNlQXBwSW5mb1YiLCJtaWJfdmVyc2lvbiIsImRldmljZV90eXBlIiwibG9hZGVyX3R5cGUiLCJmaXJtd2FyZSIsIm1pbl92ZXJzaW9uIiwiTWliRGV2aWNlVHlwZVYiLCJwcm9wZXJ0aWVzIiwicmVjb3JkIiwiTWliVHlwZVYiLCJiYXNlIiwiemVybyIsInVuaXRzIiwicHJlY2lzaW9uIiwicmVwcmVzZW50YXRpb24iLCJtaW5JbmNsdXNpdmUiLCJtYXhJbmNsdXNpdmUiLCJlbnVtZXJhdGlvbiIsIk1pYlN1YnJvdXRpbmVWIiwicmVzcG9uc2UiLCJTdWJyb3V0aW5lVHlwZVYiLCJpZCIsImxpdGVyYWwiLCJNaWJEZXZpY2VWIiwiZGV2aWNlIiwidHlwZXMiLCJzdWJyb3V0aW5lcyIsImdldEJhc2VUeXBlIiwic3VwZXJUeXBlIiwiZGVmaW5lTWliUHJvcGVydHkiLCJ0YXJnZXQiLCJrZXkiLCJwcm9wIiwicHJvcGVydHlLZXkiLCJSZWZsZWN0IiwiZGVmaW5lTWV0YWRhdGEiLCJzaW1wbGVUeXBlIiwiY29udmVydGVycyIsImlzUmVhZGFibGUiLCJpbmRleE9mIiwiaXNXcml0YWJsZSIsImluZm8iLCJzaXplIiwicHVzaCIsIk9iamVjdCIsImVudHJpZXMiLCJtYXAiLCJwZXJjZW50Q29udmVydGVyIiwiZml4ZWRQb2ludE51bWJlcjRDb252ZXJ0ZXIiLCJ2ZXJzaW9uVHlwZUNvbnZlcnRlciIsImJvb2xlYW5Db252ZXJ0ZXIiLCJuYW1lIiwiYXR0cmlidXRlcyIsImVudW1lcmFibGUiLCJ0byIsImZyb20iLCJnZXQiLCJjb25zb2xlIiwiYXNzZXJ0IiwidmFsdWUiLCJnZXRFcnJvciIsImdldFJhd1ZhbHVlIiwic2V0IiwibmV3VmFsdWUiLCJ1bmRlZmluZWQiLCJFcnJvciIsIkpTT04iLCJzdHJpbmdpZnkiLCJzZXRSYXdWYWx1ZSIsImRlZmluZVByb3BlcnR5IiwiZ2V0TWliRmlsZSIsIm1pYm5hbWUiLCJwYXRoIiwicmVzb2x2ZSIsIl9fZGlybmFtZSIsIkRldmljZVByb3RvdHlwZSIsIkV2ZW50RW1pdHRlciIsImNvbnN0cnVjdG9yIiwibWliZmlsZSIsIm1pYlZhbGlkYXRpb24iLCJkZWNvZGUiLCJyZXF1aXJlIiwiaXNMZWZ0IiwiUGF0aFJlcG9ydGVyIiwicmVwb3J0IiwibWliIiwiZXJyb3JUeXBlIiwibWV0YXN1YnMiLCJfIiwidHJhbnNmb3JtIiwicmVzdWx0Iiwic3ViIiwiZGVzY3JpcHRpb24iLCJhcmdzIiwiZGVzYyIsImtleXMiLCJvd25LZXlzIiwidmFsaWRKc05hbWUiLCJmb3JFYWNoIiwicHJvcE5hbWUiLCJjb25uZWN0aW9uIiwidmFsdWVzIiwicHJldiIsImVtaXQiLCJ0b0pTT04iLCJqc29uIiwiZ2V0TWV0YWRhdGEiLCJhZGRyZXNzIiwidG9TdHJpbmciLCJnZXRJZCIsImlkT3JOYW1lIiwiaXNJbnRlZ2VyIiwiaGFzIiwiZ2V0TmFtZSIsImluY2x1ZGVzIiwiaXNEaXJ0eSIsImVycm9ycyIsInNldERpcnR5Iiwic2V0RXJyb3IiLCJlcnJvciIsImRpcnRpZXMiLCJuYW1lcyIsImFkZHJlZiIsIiRjb3VudFJlZiIsInN0YWNrIiwicmVsZWFzZSIsImRldmljZXMiLCJkcmFpbiIsImlkcyIsImZpbHRlciIsImxlbmd0aCIsIndyaXRlIiwiY2F0Y2giLCJQcm9taXNlIiwid3JpdGVBbGwiLCJyZWplY3QiLCJqb2luIiwicmVxdWVzdHMiLCJyZWR1Y2UiLCJhY2MiLCJhbGwiLCJkYXRhZ3JhbSIsInNlbmREYXRhZ3JhbSIsInRoZW4iLCJzdGF0dXMiLCJOaWJ1c0Vycm9yIiwicmVhc29uIiwid3JpdGVWYWx1ZXMiLCJzb3VyY2UiLCJzdHJvbmciLCJUeXBlRXJyb3IiLCJhc3NpZ24iLCJ3cml0dGVuIiwiZXJyIiwicmVhZEFsbCIsInJlYWQiLCJkaXNhYmxlQmF0Y2hSZWFkaW5nIiwiY2h1bmtzIiwiY2h1bmsiLCJwcm9taXNlIiwiZGF0YWdyYW1zIiwiQXJyYXkiLCJpc0FycmF5IiwibWVzc2FnZSIsInVwbG9hZCIsImRvbWFpbiIsIm9mZnNldCIsInJlcVVwbG9hZCIsInBhZEVuZCIsImRvbWFpblNpemUiLCJpbml0VXBsb2FkIiwiaW5pdFN0YXQiLCJ0b3RhbCIsInJlc3QiLCJwb3MiLCJidWZzIiwiTWF0aCIsIm1pbiIsInVwbG9hZFNlZ21lbnQiLCJ1cGxvYWRTdGF0dXMiLCJkYXRhIiwiQnVmZmVyIiwiY29uY2F0IiwiZSIsImRvd25sb2FkIiwiYnVmZmVyIiwibm9UZXJtIiwicmVxRG93bmxvYWQiLCJtYXgiLCJ0ZXJtaW5hdGUiLCJ0ZXJtU3RhdCIsInJlcSIsInJlcyIsImluaXREb3dubG9hZCIsImNyYyIsImNodW5rU2l6ZSIsIk5NU19NQVhfREFUQV9MRU5HVEgiLCJpIiwic2VnbWVudERvd25sb2FkIiwiZG93bmxvYWRTdGF0IiwidmVyaWZ5IiwidmVyaWZ5U3RhdCIsImV4ZWN1dGUiLCJwcm9ncmFtIiwic3Vicm91dGluZSIsInByb3BzIiwiYXJnIiwibm90UmVwbHkiLCJmaW5kTWliQnlUeXBlIiwidmVyc2lvbiIsImNvbmYiLCJjb25maWdEaXIiLCJ2YWxpZGF0ZSIsIkNvbmZpZ1YiLCJtaWJUeXBlcyIsIm1pYnMiLCJtaWJUeXBlIiwiZmluZExhc3QiLCJtaW5WZXJzaW9uIiwiZ2V0Q29uc3RydWN0b3IiLCJEZXZpY2UiLCJhcHBseSIsInByb3RvdHlwZSIsImNyZWF0ZSIsImdldE1pYlByb3RvdHlwZSIsIkRldmljZXMiLCJ0YXJnZXRBZGRyZXNzIiwiQWRkcmVzcyIsIm1pYk9yVHlwZSIsIlN0cmluZyIsImNvbnN0cnVjdCIsImlzRW1wdHkiLCJwcm9jZXNzIiwibmV4dFRpY2siXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBV0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBRUE7O0FBQ0E7O0FBZ0JBOztBQUNBOztBQW9CQTs7Ozs7Ozs7QUFDQTtBQUNBO0FBRUEsTUFBTUEsT0FBTyxHQUFHLGdCQUFoQixDLENBQWtDOztBQUVsQyxNQUFNQyxLQUFLLEdBQUcsb0JBQWEsZUFBYixDQUFkO0FBRUEsTUFBTUMsT0FBTyxHQUFHQyxNQUFNLENBQUMsUUFBRCxDQUF0QjtBQUNBLE1BQU1DLE9BQU8sR0FBR0QsTUFBTSxDQUFDLFFBQUQsQ0FBdEI7QUFDQSxNQUFNRSxRQUFRLEdBQUdGLE1BQU0sQ0FBQyxTQUFELENBQXZCOztBQUVBLFNBQVNHLFVBQVQsQ0FBb0JDLEdBQXBCLEVBQThCO0FBQzVCLFFBQU1DLEdBQUcsR0FBR0MsVUFBVSxDQUFDRixHQUFELENBQXRCO0FBQ0EsU0FBUUcsTUFBTSxDQUFDQyxLQUFQLENBQWFILEdBQWIsS0FBc0IsR0FBRUEsR0FBSSxFQUFQLEtBQWFELEdBQW5DLEdBQTBDQSxHQUExQyxHQUFnREMsR0FBdkQ7QUFDRDs7SUFFSUksWTs7V0FBQUEsWTtBQUFBQSxFQUFBQSxZLENBQUFBLFk7R0FBQUEsWSxLQUFBQSxZOztBQUlMLE1BQU1DLFNBQWlELEdBQUcsRUFBMUQ7QUFFQSxNQUFNQyxhQUE4QyxHQUFHLEVBQXZEO0FBRUEsTUFBTUMsbUJBQW1CLEdBQUdDLENBQUMsQ0FBQ0MsWUFBRixDQUFlLENBQ3pDRCxDQUFDLENBQUNFLElBQUYsQ0FBTztBQUNMQyxFQUFBQSxNQUFN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QUFMLENBQVUsS0FBVixFQUFpQi9FLE1BQWpCLENBQXZCO0FBQ0Q7O0FBQ0QsV0FBT0EsTUFBUDtBQUNEOztBQXRDZ0M7O0FBeUNuQyxNQUFNc0csT0FBTyxHQUFHLElBQUltRyxPQUFKLEVBQWhCO2VBRWVuRyxPIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTkuIE9PTyBOYXRhLUluZm9cbiAqIEBhdXRob3IgQW5kcmVpIFNhcmFrZWV2IDxhdnNAbmF0YS1pbmZvLnJ1PlxuICpcbiAqIFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBcIkBuYXRhXCIgcHJvamVjdC5cbiAqIEZvciB0aGUgZnVsbCBjb3B5cmlnaHQgYW5kIGxpY2Vuc2UgaW5mb3JtYXRpb24sIHBsZWFzZSB2aWV3XG4gKiB0aGUgRVVMQSBmaWxlIHRoYXQgd2FzIGRpc3RyaWJ1dGVkIHdpdGggdGhpcyBzb3VyY2UgY29kZS5cbiAqL1xuXG4vKiB0c2xpbnQ6ZGlzYWJsZTp2YXJpYWJsZS1uYW1lICovXG5pbXBvcnQgeyBjcmMxNmNjaXR0IH0gZnJvbSAnY3JjJztcbmltcG9ydCBkZWJ1Z0ZhY3RvcnkgZnJvbSAnZGVidWcnO1xuaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcbmltcG9ydCAqIGFzIHQgZnJvbSAnaW8tdHMnO1xuaW1wb3J0IHsgUGF0aFJlcG9ydGVyIH0gZnJvbSAnaW8tdHMvbGliL1BhdGhSZXBvcnRlcic7XG5pbXBvcnQgXyBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgJ3JlZmxlY3QtbWV0YWRhdGEnO1xuaW1wb3J0IHsgY29uZmlnIGFzIGNvbmZpZ0RpciB9IGZyb20gJ3hkZy1iYXNlZGlyJztcbmltcG9ydCBBZGRyZXNzLCB7IEFkZHJlc3NQYXJhbSB9IGZyb20gJy4uL0FkZHJlc3MnO1xuaW1wb3J0IHsgTmlidXNFcnJvciB9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQgeyBOTVNfTUFYX0RBVEFfTEVOR1RIIH0gZnJvbSAnLi4vbmJjb25zdCc7XG5pbXBvcnQgeyBOaWJ1c0Nvbm5lY3Rpb24gfSBmcm9tICcuLi9uaWJ1cyc7XG5pbXBvcnQgeyBjaHVua0FycmF5IH0gZnJvbSAnLi4vbmlidXMvaGVscGVyJztcbmltcG9ydCB7XG4gIGNyZWF0ZUV4ZWN1dGVQcm9ncmFtSW52b2NhdGlvbixcbiAgY3JlYXRlTm1zRG93bmxvYWRTZWdtZW50LFxuICBjcmVhdGVObXNJbml0aWF0ZURvd25sb2FkU2VxdWVuY2UsXG4gIGNyZWF0ZU5tc0luaXRpYXRlVXBsb2FkU2VxdWVuY2UsXG4gIGNyZWF0ZU5tc1JlYWQsXG4gIGNyZWF0ZU5tc1JlcXVlc3REb21haW5Eb3dubG9hZCxcbiAgY3JlYXRlTm1zUmVxdWVzdERvbWFpblVwbG9hZCxcbiAgY3JlYXRlTm1zVGVybWluYXRlRG93bmxvYWRTZXF1ZW5jZSxcbiAgY3JlYXRlTm1zVXBsb2FkU2VnbWVudCxcbiAgY3JlYXRlTm1zVmVyaWZ5RG9tYWluQ2hlY2tzdW0sXG4gIGNyZWF0ZU5tc1dyaXRlLFxuICBnZXRObXNUeXBlLCBUeXBlZFZhbHVlLFxufSBmcm9tICcuLi9ubXMnO1xuaW1wb3J0IE5tc0RhdGFncmFtIGZyb20gJy4uL25tcy9ObXNEYXRhZ3JhbSc7XG5pbXBvcnQgTm1zVmFsdWVUeXBlIGZyb20gJy4uL25tcy9ObXNWYWx1ZVR5cGUnO1xuaW1wb3J0IHsgQ29uZmlnViB9IGZyb20gJy4uL3Nlc3Npb24vY29tbW9uJztcbmltcG9ydCB7XG4gIGJvb2xlYW5Db252ZXJ0ZXIsXG4gIGNvbnZlcnRGcm9tLFxuICBjb252ZXJ0VG8sXG4gIGVudW1lcmF0aW9uQ29udmVydGVyLFxuICBmaXhlZFBvaW50TnVtYmVyNENvbnZlcnRlcixcbiAgZ2V0SW50U2l6ZSxcbiAgSUNvbnZlcnRlcixcbiAgbWF4SW5jbHVzaXZlQ29udmVydGVyLFxuICBtaW5JbmNsdXNpdmVDb252ZXJ0ZXIsXG4gIHBhY2tlZDhmbG9hdENvbnZlcnRlcixcbiAgcGVyY2VudENvbnZlcnRlcixcbiAgcHJlY2lzaW9uQ29udmVydGVyLFxuICByZXByZXNlbnRhdGlvbkNvbnZlcnRlcixcbiAgdG9JbnQsXG4gIHVuaXRDb252ZXJ0ZXIsXG4gIHZhbGlkSnNOYW1lLFxuICB2ZXJzaW9uVHlwZUNvbnZlcnRlcixcbiAgd2l0aFZhbHVlLFxufSBmcm9tICcuL21pYic7XG5pbXBvcnQgdGltZWlkIGZyb20gJy4uL3RpbWVpZCc7XG4vLyBpbXBvcnQgeyBnZXRNaWJzU3luYyB9IGZyb20gJy4vbWliMmpzb24nO1xuLy8gaW1wb3J0IGRldGVjdG9yIGZyb20gJy4uL3NlcnZpY2UvZGV0ZWN0b3InO1xuXG5jb25zdCBwa2dOYW1lID0gJ0BuYXRhL25pYnVzLmpzJzsgLy8gcmVxdWlyZSgnLi4vLi4vcGFja2FnZS5qc29uJykubmFtZTtcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ25pYnVzOmRldmljZXMnKTtcblxuY29uc3QgJHZhbHVlcyA9IFN5bWJvbCgndmFsdWVzJyk7XG5jb25zdCAkZXJyb3JzID0gU3ltYm9sKCdlcnJvcnMnKTtcbmNvbnN0ICRkaXJ0aWVzID0gU3ltYm9sKCdkaXJ0aWVzJyk7XG5cbmZ1bmN0aW9uIHNhZmVOdW1iZXIodmFsOiBhbnkpIHtcbiAgY29uc3QgbnVtID0gcGFyc2VGbG9hdCh2YWwpO1xuICByZXR1cm4gKE51bWJlci5pc05hTihudW0pIHx8IGAke251bX1gICE9PSB2YWwpID8gdmFsIDogbnVtO1xufVxuXG5lbnVtIFByaXZhdGVQcm9wcyB7XG4gIGNvbm5lY3Rpb24gPSAtMSxcbn1cblxuY29uc3QgZGV2aWNlTWFwOiB7IFthZGRyZXNzOiBzdHJpbmddOiBEZXZpY2VQcm90b3R5cGUgfSA9IHt9O1xuXG5jb25zdCBtaWJUeXBlc0NhY2hlOiB7IFttaWJuYW1lOiBzdHJpbmddOiBGdW5jdGlvbiB9ID0ge307XG5cbmNvbnN0IE1pYlByb3BlcnR5QXBwSW5mb1YgPSB0LmludGVyc2VjdGlvbihbXG4gIHQudHlwZSh7XG4gICAgbm1zX2lkOiB0LnVuaW9uKFt0LnN0cmluZywgdC5JbnRdKSxcbiAgICBhY2Nlc3M6IHQuc3RyaW5nLFxuICB9KSxcbiAgdC5wYXJ0aWFsKHtcbiAgICBjYXRlZ29yeTogdC5zdHJpbmcsXG4gIH0pLFxuXSk7XG5cbi8vIGludGVyZmFjZSBJTWliUHJvcGVydHlBcHBJbmZvIGV4dGVuZHMgdC5UeXBlT2Y8dHlwZW9mIE1pYlByb3BlcnR5QXBwSW5mb1Y+IHt9XG5cbmNvbnN0IE1pYlByb3BlcnR5ViA9IHQudHlwZSh7XG4gIHR5cGU6IHQuc3RyaW5nLFxuICBhbm5vdGF0aW9uOiB0LnN0cmluZyxcbiAgYXBwaW5mbzogTWliUHJvcGVydHlBcHBJbmZvVixcbn0pO1xuXG5pbnRlcmZhY2UgSU1pYlByb3BlcnR5IGV4dGVuZHMgdC5UeXBlT2Y8dHlwZW9mIE1pYlByb3BlcnR5Vj4ge1xuICAvLyBhcHBpbmZvOiBJTWliUHJvcGVydHlBcHBJbmZvO1xufVxuXG5jb25zdCBNaWJEZXZpY2VBcHBJbmZvViA9IHQuaW50ZXJzZWN0aW9uKFtcbiAgdC50eXBlKHtcbiAgICBtaWJfdmVyc2lvbjogdC5zdHJpbmcsXG4gIH0pLFxuICB0LnBhcnRpYWwoe1xuICAgIGRldmljZV90eXBlOiB0LnN0cmluZyxcbiAgICBsb2FkZXJfdHlwZTogdC5zdHJpbmcsXG4gICAgZmlybXdhcmU6IHQuc3RyaW5nLFxuICAgIG1pbl92ZXJzaW9uOiB0LnN0cmluZyxcbiAgfSksXG5dKTtcblxuY29uc3QgTWliRGV2aWNlVHlwZVYgPSB0LnR5cGUoe1xuICBhbm5vdGF0aW9uOiB0LnN0cmluZyxcbiAgYXBwaW5mbzogTWliRGV2aWNlQXBwSW5mb1YsXG4gIHByb3BlcnRpZXM6IHQucmVjb3JkKHQuc3RyaW5nLCBNaWJQcm9wZXJ0eVYpLFxufSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU1pYkRldmljZVR5cGUgZXh0ZW5kcyB0LlR5cGVPZjx0eXBlb2YgTWliRGV2aWNlVHlwZVY+IHt9XG5cbmNvbnN0IE1pYlR5cGVWID0gdC5pbnRlcnNlY3Rpb24oW1xuICB0LnR5cGUoe1xuICAgIGJhc2U6IHQuc3RyaW5nLFxuICB9KSxcbiAgdC5wYXJ0aWFsKHtcbiAgICBhcHBpbmZvOiB0LnBhcnRpYWwoe1xuICAgICAgemVybzogdC5zdHJpbmcsXG4gICAgICB1bml0czogdC5zdHJpbmcsXG4gICAgICBwcmVjaXNpb246IHQuc3RyaW5nLFxuICAgICAgcmVwcmVzZW50YXRpb246IHQuc3RyaW5nLFxuICAgIH0pLFxuICAgIG1pbkluY2x1c2l2ZTogdC5zdHJpbmcsXG4gICAgbWF4SW5jbHVzaXZlOiB0LnN0cmluZyxcbiAgICBlbnVtZXJhdGlvbjogdC5yZWNvcmQodC5zdHJpbmcsIHQudHlwZSh7IGFubm90YXRpb246IHQuc3RyaW5nIH0pKSxcbiAgfSksXG5dKTtcblxuZXhwb3J0IGludGVyZmFjZSBJTWliVHlwZSBleHRlbmRzIHQuVHlwZU9mPHR5cGVvZiBNaWJUeXBlVj4ge31cblxuY29uc3QgTWliU3Vicm91dGluZVYgPSB0LmludGVyc2VjdGlvbihbXG4gIHQudHlwZSh7XG4gICAgYW5ub3RhdGlvbjogdC5zdHJpbmcsXG4gICAgYXBwaW5mbzogdC5pbnRlcnNlY3Rpb24oW1xuICAgICAgdC50eXBlKHsgbm1zX2lkOiB0LnVuaW9uKFt0LnN0cmluZywgdC5JbnRdKSB9KSxcbiAgICAgIHQucGFydGlhbCh7IHJlc3BvbnNlOiB0LnN0cmluZyB9KSxcbiAgICBdKSxcbiAgfSksXG4gIHQucGFydGlhbCh7XG4gICAgcHJvcGVydGllczogdC5yZWNvcmQodC5zdHJpbmcsIHQudHlwZSh7XG4gICAgICB0eXBlOiB0LnN0cmluZyxcbiAgICAgIGFubm90YXRpb246IHQuc3RyaW5nLFxuICAgIH0pKSxcbiAgfSksXG5dKTtcblxuY29uc3QgU3Vicm91dGluZVR5cGVWID0gdC50eXBlKHtcbiAgYW5ub3RhdGlvbjogdC5zdHJpbmcsXG4gIHByb3BlcnRpZXM6IHQudHlwZSh7XG4gICAgaWQ6IHQudHlwZSh7XG4gICAgICB0eXBlOiB0LmxpdGVyYWwoJ3hzOnVuc2lnbmVkU2hvcnQnKSxcbiAgICAgIGFubm90YXRpb246IHQuc3RyaW5nLFxuICAgIH0pLFxuICB9KSxcbn0pO1xuXG5leHBvcnQgY29uc3QgTWliRGV2aWNlViA9IHQuaW50ZXJzZWN0aW9uKFtcbiAgdC50eXBlKHtcbiAgICBkZXZpY2U6IHQuc3RyaW5nLFxuICAgIHR5cGVzOiB0LnJlY29yZCh0LnN0cmluZywgdC51bmlvbihbTWliRGV2aWNlVHlwZVYsIE1pYlR5cGVWLCBTdWJyb3V0aW5lVHlwZVZdKSksXG4gIH0pLFxuICB0LnBhcnRpYWwoe1xuICAgIHN1YnJvdXRpbmVzOiB0LnJlY29yZCh0LnN0cmluZywgTWliU3Vicm91dGluZVYpLFxuICB9KSxcbl0pO1xuXG5pbnRlcmZhY2UgSU1pYkRldmljZSBleHRlbmRzIHQuVHlwZU9mPHR5cGVvZiBNaWJEZXZpY2VWPiB7fVxuXG50eXBlIExpc3RlbmVyPFQ+ID0gKGFyZzogVCkgPT4gdm9pZDtcbnR5cGUgQ2hhbmdlQXJnID0geyBpZDogbnVtYmVyLCBuYW1lczogc3RyaW5nW10gfTtcbmV4cG9ydCB0eXBlIENoYW5nZUxpc3RlbmVyID0gTGlzdGVuZXI8Q2hhbmdlQXJnPjtcbnR5cGUgVXBsb2FkU3RhcnRBcmcgPSB7IGRvbWFpbjogc3RyaW5nLCBkb21haW5TaXplOiBudW1iZXIsIG9mZnNldDogbnVtYmVyLCBzaXplOiBudW1iZXIgfTtcbmV4cG9ydCB0eXBlIFVwbG9hZFN0YXJ0TGlzdGVuZXIgPSBMaXN0ZW5lcjxVcGxvYWRTdGFydEFyZz47XG50eXBlIFVwbG9hZERhdGFBcmcgPSB7IGRvbWFpbjogc3RyaW5nLCBkYXRhOiBCdWZmZXIsIHBvczogbnVtYmVyIH07XG5leHBvcnQgdHlwZSBVcGxvYWREYXRhTGlzdGVuZXIgPSBMaXN0ZW5lcjxVcGxvYWREYXRhQXJnPjtcbnR5cGUgVXBsb2FkRmluaXNoQXJnID0geyBkb21haW46IHN0cmluZywgb2Zmc2V0OiBudW1iZXIsIGRhdGE6IEJ1ZmZlciB9O1xuZXhwb3J0IHR5cGUgVXBsb2FkRmluaXNoTGlzdGVuZXIgPSBMaXN0ZW5lcjxVcGxvYWRGaW5pc2hBcmc+O1xudHlwZSBEb3dubG9hZFN0YXJ0QXJnID0geyBkb21haW46IHN0cmluZywgZG9tYWluU2l6ZTogbnVtYmVyLCBvZmZzZXQ6IG51bWJlciwgc2l6ZTogbnVtYmVyIH07XG5leHBvcnQgdHlwZSBEb3dubG9hZFN0YXJ0TGlzdGVuZXIgPSBMaXN0ZW5lcjxEb3dubG9hZFN0YXJ0QXJnPjtcbnR5cGUgRG93bmxvYWREYXRhQXJnID0geyBkb21haW46IHN0cmluZywgbGVuZ3RoOiBudW1iZXIgfTtcbmV4cG9ydCB0eXBlIERvd25sb2FkRGF0YUxpc3RlbmVyID0gTGlzdGVuZXI8RG93bmxvYWREYXRhQXJnPjtcbnR5cGUgRG93bmxvYWRGaW5pc2hBcmcgPSB7IGRvbWFpbjogc3RyaW5nOyBvZmZzZXQ6IG51bWJlciwgc2l6ZTogbnVtYmVyIH07XG5leHBvcnQgdHlwZSBEb3dubG9hZEZpbmlzaExpc3RlbmVyID0gTGlzdGVuZXI8RG93bmxvYWRGaW5pc2hBcmc+O1xuXG5leHBvcnQgaW50ZXJmYWNlIElEZXZpY2Uge1xuICByZWFkb25seSBpZDogc3RyaW5nO1xuICByZWFkb25seSBhZGRyZXNzOiBBZGRyZXNzO1xuICBkcmFpbigpOiBQcm9taXNlPG51bWJlcltdPjtcbiAgd3JpdGUoLi4uaWRzOiBudW1iZXJbXSk6IFByb21pc2U8bnVtYmVyW10+O1xuICByZWFkKC4uLmlkczogbnVtYmVyW10pOiBQcm9taXNlPHsgW25hbWU6IHN0cmluZ106IGFueSB9PjtcbiAgdXBsb2FkKGRvbWFpbjogc3RyaW5nLCBvZmZzZXQ/OiBudW1iZXIsIHNpemU/OiBudW1iZXIpOiBQcm9taXNlPFVpbnQ4QXJyYXk+O1xuICBkb3dubG9hZChkb21haW46IHN0cmluZywgZGF0YTogQnVmZmVyLCBvZmZzZXQ/OiBudW1iZXIsIG5vVGVybT86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+O1xuICBleGVjdXRlKFxuICAgIHByb2dyYW06IHN0cmluZyxcbiAgICBhcmdzPzogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8Tm1zRGF0YWdyYW0gfCBObXNEYXRhZ3JhbVtdIHwgdW5kZWZpbmVkPjtcbiAgY29ubmVjdGlvbj86IE5pYnVzQ29ubmVjdGlvbjtcbiAgcmVsZWFzZSgpOiBudW1iZXI7XG4gIGdldElkKGlkT3JOYW1lOiBzdHJpbmcgfCBudW1iZXIpOiBudW1iZXI7XG4gIGdldE5hbWUoaWRPck5hbWU6IHN0cmluZyB8IG51bWJlcik6IHN0cmluZztcbiAgZ2V0UmF3VmFsdWUoaWRPck5hbWU6IG51bWJlciB8IHN0cmluZyk6IGFueTtcbiAgZ2V0RXJyb3IoaWRPck5hbWU6IG51bWJlciB8IHN0cmluZyk6IGFueTtcbiAgaXNEaXJ0eShpZE9yTmFtZTogc3RyaW5nIHwgbnVtYmVyKTogYm9vbGVhbjtcbiAgW21pYlByb3BlcnR5OiBzdHJpbmddOiBhbnk7XG5cbiAgb24oZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcsIGxpc3RlbmVyOiAoKSA9PiB2b2lkKTogdGhpcztcbiAgb24oZXZlbnQ6ICdjaGFuZ2luZycgfCAnY2hhbmdlZCcsIGxpc3RlbmVyOiBDaGFuZ2VMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAndXBsb2FkU3RhcnQnLCBsaXN0ZW5lcjogVXBsb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAndXBsb2FkRGF0YScsIGxpc3RlbmVyOiBVcGxvYWREYXRhTGlzdGVuZXIpOiB0aGlzO1xuICBvbihldmVudDogJ3VwbG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBVcGxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAnZG93bmxvYWRTdGFydCcsIGxpc3RlbmVyOiBEb3dubG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBvbihldmVudDogJ2Rvd25sb2FkRGF0YScsIGxpc3RlbmVyOiBEb3dubG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIG9uKGV2ZW50OiAnZG93bmxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogRG93bmxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG5cbiAgb25jZShldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnY2hhbmdpbmcnIHwgJ2NoYW5nZWQnLCBsaXN0ZW5lcjogQ2hhbmdlTGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAndXBsb2FkU3RhcnQnLCBsaXN0ZW5lcjogVXBsb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICd1cGxvYWREYXRhJywgbGlzdGVuZXI6IFVwbG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICd1cGxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogVXBsb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnZG93bmxvYWRTdGFydCcsIGxpc3RlbmVyOiBEb3dubG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAnZG93bmxvYWREYXRhJywgbGlzdGVuZXI6IERvd25sb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgb25jZShldmVudDogJ2Rvd25sb2FkRmluaXNoJywgbGlzdGVuZXI6IERvd25sb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuXG4gIGFkZExpc3RlbmVyKGV2ZW50OiAnY29ubmVjdGVkJyB8ICdkaXNjb25uZWN0ZWQnLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCk6IHRoaXM7XG4gIGFkZExpc3RlbmVyKGV2ZW50OiAnY2hhbmdpbmcnIHwgJ2NoYW5nZWQnLCBsaXN0ZW5lcjogQ2hhbmdlTGlzdGVuZXIpOiB0aGlzO1xuICBhZGRMaXN0ZW5lcihldmVudDogJ3VwbG9hZFN0YXJ0JywgbGlzdGVuZXI6IFVwbG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBhZGRMaXN0ZW5lcihldmVudDogJ3VwbG9hZERhdGEnLCBsaXN0ZW5lcjogVXBsb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICd1cGxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogVXBsb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuICBhZGRMaXN0ZW5lcihldmVudDogJ2Rvd25sb2FkU3RhcnQnLCBsaXN0ZW5lcjogRG93bmxvYWRTdGFydExpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICdkb3dubG9hZERhdGEnLCBsaXN0ZW5lcjogRG93bmxvYWREYXRhTGlzdGVuZXIpOiB0aGlzO1xuICBhZGRMaXN0ZW5lcihldmVudDogJ2Rvd25sb2FkRmluaXNoJywgbGlzdGVuZXI6IERvd25sb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuXG4gIG9mZihldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICdjaGFuZ2luZycgfCAnY2hhbmdlZCcsIGxpc3RlbmVyOiBDaGFuZ2VMaXN0ZW5lcik6IHRoaXM7XG4gIG9mZihldmVudDogJ3VwbG9hZFN0YXJ0JywgbGlzdGVuZXI6IFVwbG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICd1cGxvYWREYXRhJywgbGlzdGVuZXI6IFVwbG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIG9mZihldmVudDogJ3VwbG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBVcGxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG4gIG9mZihldmVudDogJ2Rvd25sb2FkU3RhcnQnLCBsaXN0ZW5lcjogRG93bmxvYWRTdGFydExpc3RlbmVyKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAnZG93bmxvYWREYXRhJywgbGlzdGVuZXI6IERvd25sb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAnZG93bmxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogRG93bmxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG5cbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcsIGxpc3RlbmVyOiAoKSA9PiB2b2lkKTogdGhpcztcbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnQ6ICdjaGFuZ2luZycgfCAnY2hhbmdlZCcsIGxpc3RlbmVyOiBDaGFuZ2VMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAndXBsb2FkU3RhcnQnLCBsaXN0ZW5lcjogVXBsb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAndXBsb2FkRGF0YScsIGxpc3RlbmVyOiBVcGxvYWREYXRhTGlzdGVuZXIpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ3VwbG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBVcGxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAnZG93bmxvYWRTdGFydCcsIGxpc3RlbmVyOiBEb3dubG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ2Rvd25sb2FkRGF0YScsIGxpc3RlbmVyOiBEb3dubG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAnZG93bmxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogRG93bmxvYWRGaW5pc2hMaXN0ZW5lcik6IHRoaXM7XG5cbiAgZW1pdChldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJyk6IGJvb2xlYW47XG4gIGVtaXQoZXZlbnQ6ICdjaGFuZ2luZycgfCAnY2hhbmdlZCcsIGFyZzogQ2hhbmdlQXJnKTogYm9vbGVhbjtcbiAgZW1pdChldmVudDogJ3VwbG9hZFN0YXJ0JywgYXJnOiBVcGxvYWRTdGFydEFyZyk6IGJvb2xlYW47XG4gIGVtaXQoZXZlbnQ6ICd1cGxvYWREYXRhJywgYXJnOiBVcGxvYWREYXRhQXJnKTogYm9vbGVhbjtcbiAgZW1pdChldmVudDogJ3VwbG9hZEZpbmlzaCcsIGFyZzogVXBsb2FkRmluaXNoQXJnKTogYm9vbGVhbjtcbiAgZW1pdChldmVudDogJ2Rvd25sb2FkU3RhcnQnLCBhcmc6IERvd25sb2FkU3RhcnRBcmcpOiBib29sZWFuO1xuICBlbWl0KGV2ZW50OiAnZG93bmxvYWREYXRhJywgYXJnOiBEb3dubG9hZERhdGFBcmcpOiBib29sZWFuO1xuICBlbWl0KGV2ZW50OiAnZG93bmxvYWRGaW5pc2gnLCBhcmc6IERvd25sb2FkRmluaXNoQXJnKTogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIElTdWJyb3V0aW5lRGVzYyB7XG4gIGlkOiBudW1iZXI7XG4gIC8vIG5hbWU6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgbm90UmVwbHk/OiBib29sZWFuO1xuICBhcmdzPzogeyBuYW1lOiBzdHJpbmcsIHR5cGU6IE5tc1ZhbHVlVHlwZSwgZGVzYz86IHN0cmluZyB9W107XG59XG5cbmludGVyZmFjZSBJUHJvcGVydHlEZXNjcmlwdG9yPE93bmVyPiB7XG4gIGNvbmZpZ3VyYWJsZT86IGJvb2xlYW47XG4gIGVudW1lcmFibGU/OiBib29sZWFuO1xuICB2YWx1ZT86IGFueTtcbiAgd3JpdGFibGU/OiBib29sZWFuO1xuXG4gIGdldD8odGhpczogT3duZXIpOiBhbnk7XG5cbiAgc2V0Pyh0aGlzOiBPd25lciwgdjogYW55KTogdm9pZDtcbn1cblxuZnVuY3Rpb24gZ2V0QmFzZVR5cGUodHlwZXM6IElNaWJEZXZpY2VbJ3R5cGVzJ10sIHR5cGU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGxldCBiYXNlID0gdHlwZTtcbiAgZm9yIChsZXQgc3VwZXJUeXBlOiBJTWliVHlwZSA9IHR5cGVzW2Jhc2VdIGFzIElNaWJUeXBlOyBzdXBlclR5cGUgIT0gbnVsbDtcbiAgICAgICBzdXBlclR5cGUgPSB0eXBlc1tzdXBlclR5cGUuYmFzZV0gYXMgSU1pYlR5cGUpIHtcbiAgICBiYXNlID0gc3VwZXJUeXBlLmJhc2U7XG4gIH1cbiAgcmV0dXJuIGJhc2U7XG59XG5cbmZ1bmN0aW9uIGRlZmluZU1pYlByb3BlcnR5KFxuICB0YXJnZXQ6IERldmljZVByb3RvdHlwZSxcbiAga2V5OiBzdHJpbmcsXG4gIHR5cGVzOiBJTWliRGV2aWNlWyd0eXBlcyddLFxuICBwcm9wOiBJTWliUHJvcGVydHkpOiBbbnVtYmVyLCBzdHJpbmddIHtcbiAgY29uc3QgcHJvcGVydHlLZXkgPSB2YWxpZEpzTmFtZShrZXkpO1xuICBjb25zdCB7IGFwcGluZm8gfSA9IHByb3A7XG4gIGNvbnN0IGlkID0gdG9JbnQoYXBwaW5mby5ubXNfaWQpO1xuICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdpZCcsIGlkLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgY29uc3Qgc2ltcGxlVHlwZSA9IGdldEJhc2VUeXBlKHR5cGVzLCBwcm9wLnR5cGUpO1xuICBjb25zdCB0eXBlID0gdHlwZXNbcHJvcC50eXBlXSBhcyBJTWliVHlwZTtcbiAgY29uc3QgY29udmVydGVyczogSUNvbnZlcnRlcltdID0gW107XG4gIGNvbnN0IGlzUmVhZGFibGUgPSBhcHBpbmZvLmFjY2Vzcy5pbmRleE9mKCdyJykgPiAtMTtcbiAgY29uc3QgaXNXcml0YWJsZSA9IGFwcGluZm8uYWNjZXNzLmluZGV4T2YoJ3cnKSA+IC0xO1xuICBsZXQgZW51bWVyYXRpb246IElNaWJUeXBlWydlbnVtZXJhdGlvbiddIHwgdW5kZWZpbmVkO1xuICBpZiAodHlwZSAhPSBudWxsKSB7XG4gICAgY29uc3QgeyBhcHBpbmZvOiBpbmZvID0ge30sIG1pbkluY2x1c2l2ZSwgbWF4SW5jbHVzaXZlIH0gPSB0eXBlO1xuICAgIGVudW1lcmF0aW9uID0gdHlwZS5lbnVtZXJhdGlvbjtcbiAgICBjb25zdCB7IHVuaXRzLCBwcmVjaXNpb24sIHJlcHJlc2VudGF0aW9uIH0gPSBpbmZvO1xuICAgIGNvbnN0IHNpemUgPSBnZXRJbnRTaXplKHNpbXBsZVR5cGUpO1xuICAgIGlmICh1bml0cykge1xuICAgICAgY29udmVydGVycy5wdXNoKHVuaXRDb252ZXJ0ZXIodW5pdHMpKTtcbiAgICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ3VuaXQnLCB1bml0cywgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gICAgfVxuICAgIHByZWNpc2lvbiAmJiBjb252ZXJ0ZXJzLnB1c2gocHJlY2lzaW9uQ29udmVydGVyKHByZWNpc2lvbikpO1xuICAgIGlmIChlbnVtZXJhdGlvbikge1xuICAgICAgY29udmVydGVycy5wdXNoKGVudW1lcmF0aW9uQ29udmVydGVyKGVudW1lcmF0aW9uKSk7XG4gICAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdlbnVtJywgT2JqZWN0LmVudHJpZXMoZW51bWVyYXRpb24pXG4gICAgICAgIC5tYXAoKFtrZXksIHZhbF0pID0+IFtcbiAgICAgICAgICB2YWwhLmFubm90YXRpb24sXG4gICAgICAgICAgdG9JbnQoa2V5KSxcbiAgICAgICAgXSksIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICAgIH1cbiAgICByZXByZXNlbnRhdGlvbiAmJiBzaXplICYmIGNvbnZlcnRlcnMucHVzaChyZXByZXNlbnRhdGlvbkNvbnZlcnRlcihyZXByZXNlbnRhdGlvbiwgc2l6ZSkpO1xuICAgIGlmIChtaW5JbmNsdXNpdmUpIHtcbiAgICAgIGNvbnZlcnRlcnMucHVzaChtaW5JbmNsdXNpdmVDb252ZXJ0ZXIobWluSW5jbHVzaXZlKSk7XG4gICAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtaW4nLCBtaW5JbmNsdXNpdmUsIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICAgIH1cbiAgICBpZiAobWF4SW5jbHVzaXZlKSB7XG4gICAgICBjb252ZXJ0ZXJzLnB1c2gobWF4SW5jbHVzaXZlQ29udmVydGVyKG1heEluY2x1c2l2ZSkpO1xuICAgICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWF4JywgbWF4SW5jbHVzaXZlLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgICB9XG4gIH1cbiAgaWYgKGtleSA9PT0gJ2JyaWdodG5lc3MnICYmIHByb3AudHlwZSA9PT0gJ3hzOnVuc2lnbmVkQnl0ZScpIHtcbiAgICBjb252ZXJ0ZXJzLnB1c2gocGVyY2VudENvbnZlcnRlcik7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgndW5pdCcsICclJywgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWluJywgMCwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWF4JywgMTAwLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgfVxuICBzd2l0Y2ggKHNpbXBsZVR5cGUpIHtcbiAgICBjYXNlICdwYWNrZWQ4RmxvYXQnOlxuICAgICAgY29udmVydGVycy5wdXNoKHBhY2tlZDhmbG9hdENvbnZlcnRlcih0eXBlKSk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdmaXhlZFBvaW50TnVtYmVyNCc6XG4gICAgICBjb252ZXJ0ZXJzLnB1c2goZml4ZWRQb2ludE51bWJlcjRDb252ZXJ0ZXIpO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIGJyZWFrO1xuICB9XG4gIGlmIChwcm9wLnR5cGUgPT09ICd2ZXJzaW9uVHlwZScpIHtcbiAgICBjb252ZXJ0ZXJzLnB1c2godmVyc2lvblR5cGVDb252ZXJ0ZXIpO1xuICB9XG4gIGlmIChzaW1wbGVUeXBlID09PSAneHM6Ym9vbGVhbicgJiYgIWVudW1lcmF0aW9uKSB7XG4gICAgY29udmVydGVycy5wdXNoKGJvb2xlYW5Db252ZXJ0ZXIpO1xuICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2VudW0nLCBbWyfQlNCwJywgdHJ1ZV0sIFsn0J3QtdGCJywgZmFsc2VdXSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIH1cbiAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnaXNXcml0YWJsZScsIGlzV3JpdGFibGUsIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdpc1JlYWRhYmxlJywgaXNSZWFkYWJsZSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ3R5cGUnLCBwcm9wLnR5cGUsIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdzaW1wbGVUeXBlJywgc2ltcGxlVHlwZSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoXG4gICAgJ2Rpc3BsYXlOYW1lJyxcbiAgICBwcm9wLmFubm90YXRpb24gPyBwcm9wLmFubm90YXRpb24gOiBuYW1lLFxuICAgIHRhcmdldCxcbiAgICBwcm9wZXJ0eUtleSxcbiAgKTtcbiAgYXBwaW5mby5jYXRlZ29yeSAmJiBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdjYXRlZ29yeScsIGFwcGluZm8uY2F0ZWdvcnksIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdubXNUeXBlJywgZ2V0Tm1zVHlwZShzaW1wbGVUeXBlKSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIGNvbnN0IGF0dHJpYnV0ZXM6IElQcm9wZXJ0eURlc2NyaXB0b3I8RGV2aWNlUHJvdG90eXBlPiA9IHtcbiAgICBlbnVtZXJhYmxlOiBpc1JlYWRhYmxlLFxuICB9O1xuICBjb25zdCB0byA9IGNvbnZlcnRUbyhjb252ZXJ0ZXJzKTtcbiAgY29uc3QgZnJvbSA9IGNvbnZlcnRGcm9tKGNvbnZlcnRlcnMpO1xuICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdjb252ZXJ0VG8nLCB0bywgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2NvbnZlcnRGcm9tJywgZnJvbSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIGF0dHJpYnV0ZXMuZ2V0ID0gZnVuY3Rpb24gKCkge1xuICAgIGNvbnNvbGUuYXNzZXJ0KFJlZmxlY3QuZ2V0KHRoaXMsICckY291bnRSZWYnKSA+IDAsICdEZXZpY2Ugd2FzIHJlbGVhc2VkJyk7XG4gICAgbGV0IHZhbHVlO1xuICAgIGlmICghdGhpcy5nZXRFcnJvcihpZCkpIHtcbiAgICAgIHZhbHVlID0gdG8odGhpcy5nZXRSYXdWYWx1ZShpZCkpO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG4gIH07XG4gIGlmIChpc1dyaXRhYmxlKSB7XG4gICAgYXR0cmlidXRlcy5zZXQgPSBmdW5jdGlvbiAobmV3VmFsdWU6IGFueSkge1xuICAgICAgY29uc29sZS5hc3NlcnQoUmVmbGVjdC5nZXQodGhpcywgJyRjb3VudFJlZicpID4gMCwgJ0RldmljZSB3YXMgcmVsZWFzZWQnKTtcbiAgICAgIGNvbnN0IHZhbHVlID0gZnJvbShuZXdWYWx1ZSk7XG4gICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCBOdW1iZXIuaXNOYU4odmFsdWUgYXMgbnVtYmVyKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdmFsdWU6ICR7SlNPTi5zdHJpbmdpZnkobmV3VmFsdWUpfWApO1xuICAgICAgfVxuICAgICAgdGhpcy5zZXRSYXdWYWx1ZShpZCwgdmFsdWUpO1xuICAgIH07XG4gIH1cbiAgUmVmbGVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIHByb3BlcnR5S2V5LCBhdHRyaWJ1dGVzKTtcbiAgcmV0dXJuIFtpZCwgcHJvcGVydHlLZXldO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TWliRmlsZShtaWJuYW1lOiBzdHJpbmcpIHtcbiAgcmV0dXJuIHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLi9taWJzLycsIGAke21pYm5hbWV9Lm1pYi5qc29uYCk7XG59XG5cbmNsYXNzIERldmljZVByb3RvdHlwZSBleHRlbmRzIEV2ZW50RW1pdHRlciBpbXBsZW1lbnRzIElEZXZpY2Uge1xuICAvLyB3aWxsIGJlIG92ZXJyaWRlIGZvciBhbiBpbnN0YW5jZVxuICAkY291bnRSZWYgPSAxO1xuICBpZCA9IHRpbWVpZCgpO1xuXG4gIC8vIHByaXZhdGUgJGRlYm91bmNlRHJhaW4gPSBfLmRlYm91bmNlKHRoaXMuZHJhaW4sIDI1KTtcblxuICBjb25zdHJ1Y3RvcihtaWJuYW1lOiBzdHJpbmcpIHtcbiAgICBzdXBlcigpO1xuICAgIGNvbnN0IG1pYmZpbGUgPSBnZXRNaWJGaWxlKG1pYm5hbWUpO1xuICAgIGNvbnN0IG1pYlZhbGlkYXRpb24gPSBNaWJEZXZpY2VWLmRlY29kZShyZXF1aXJlKG1pYmZpbGUpKTtcbiAgICBpZiAobWliVmFsaWRhdGlvbi5pc0xlZnQoKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIG1pYiBmaWxlICR7bWliZmlsZX0gJHtQYXRoUmVwb3J0ZXIucmVwb3J0KG1pYlZhbGlkYXRpb24pfWApO1xuICAgIH1cbiAgICBjb25zdCBtaWIgPSBtaWJWYWxpZGF0aW9uLnZhbHVlO1xuICAgIGNvbnN0IHsgdHlwZXMsIHN1YnJvdXRpbmVzIH0gPSBtaWI7XG4gICAgY29uc3QgZGV2aWNlID0gdHlwZXNbbWliLmRldmljZV0gYXMgSU1pYkRldmljZVR5cGU7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWliJywgbWlibmFtZSwgdGhpcyk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWliZmlsZScsIG1pYmZpbGUsIHRoaXMpO1xuICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2Fubm90YXRpb24nLCBkZXZpY2UuYW5ub3RhdGlvbiwgdGhpcyk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWliVmVyc2lvbicsIGRldmljZS5hcHBpbmZvLm1pYl92ZXJzaW9uLCB0aGlzKTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdkZXZpY2VUeXBlJywgdG9JbnQoZGV2aWNlLmFwcGluZm8uZGV2aWNlX3R5cGUpLCB0aGlzKTtcbiAgICBkZXZpY2UuYXBwaW5mby5sb2FkZXJfdHlwZSAmJiBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdsb2FkZXJUeXBlJyxcbiAgICAgIHRvSW50KGRldmljZS5hcHBpbmZvLmxvYWRlcl90eXBlKSwgdGhpcyxcbiAgICApO1xuICAgIGRldmljZS5hcHBpbmZvLmZpcm13YXJlICYmIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2Zpcm13YXJlJyxcbiAgICAgIGRldmljZS5hcHBpbmZvLmZpcm13YXJlLCB0aGlzLFxuICAgICk7XG4gICAgZGV2aWNlLmFwcGluZm8ubWluX3ZlcnNpb24gJiYgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWluX3ZlcnNpb24nLFxuICAgICAgZGV2aWNlLmFwcGluZm8ubWluX3ZlcnNpb24sIHRoaXMsXG4gICAgKTtcbiAgICB0eXBlcy5lcnJvclR5cGUgJiYgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YShcbiAgICAgICdlcnJvclR5cGUnLCAodHlwZXMuZXJyb3JUeXBlIGFzIElNaWJUeXBlKS5lbnVtZXJhdGlvbiwgdGhpcyk7XG5cbiAgICBpZiAoc3Vicm91dGluZXMpIHtcbiAgICAgIGNvbnN0IG1ldGFzdWJzID0gXy50cmFuc2Zvcm0oXG4gICAgICAgIHN1YnJvdXRpbmVzLFxuICAgICAgICAocmVzdWx0LCBzdWIsIG5hbWUpID0+IHtcbiAgICAgICAgICByZXN1bHRbbmFtZV0gPSB7XG4gICAgICAgICAgICBpZDogdG9JbnQoc3ViLmFwcGluZm8ubm1zX2lkKSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBzdWIuYW5ub3RhdGlvbixcbiAgICAgICAgICAgIGFyZ3M6IHN1Yi5wcm9wZXJ0aWVzICYmIE9iamVjdC5lbnRyaWVzKHN1Yi5wcm9wZXJ0aWVzKVxuICAgICAgICAgICAgICAubWFwKChbbmFtZSwgcHJvcF0pID0+ICh7XG4gICAgICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICAgICB0eXBlOiBnZXRObXNUeXBlKHByb3AudHlwZSksXG4gICAgICAgICAgICAgICAgZGVzYzogcHJvcC5hbm5vdGF0aW9uLFxuICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgfTtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9LFxuICAgICAgICB7fSBhcyBSZWNvcmQ8c3RyaW5nLCBJU3Vicm91dGluZURlc2M+LFxuICAgICAgKTtcbiAgICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ3N1YnJvdXRpbmVzJywgbWV0YXN1YnMsIHRoaXMpO1xuICAgIH1cblxuICAgIC8vIFRPRE86IGNhdGVnb3J5XG4gICAgLy8gY29uc3QgbWliQ2F0ZWdvcnkgPSBfLmZpbmQoZGV0ZWN0b3IuZGV0ZWN0aW9uIS5taWJDYXRlZ29yaWVzLCB7IG1pYjogbWlibmFtZSB9KTtcbiAgICAvLyBpZiAobWliQ2F0ZWdvcnkpIHtcbiAgICAvLyAgIGNvbnN0IHsgY2F0ZWdvcnksIGRpc2FibGVCYXRjaFJlYWRpbmcgfSA9IG1pYkNhdGVnb3J5O1xuICAgIC8vICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnY2F0ZWdvcnknLCBjYXRlZ29yeSwgdGhpcyk7XG4gICAgLy8gICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdkaXNhYmxlQmF0Y2hSZWFkaW5nJywgISFkaXNhYmxlQmF0Y2hSZWFkaW5nLCB0aGlzKTtcbiAgICAvLyB9XG5cbiAgICBjb25zdCBrZXlzID0gUmVmbGVjdC5vd25LZXlzKGRldmljZS5wcm9wZXJ0aWVzKSBhcyBzdHJpbmdbXTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdtaWJQcm9wZXJ0aWVzJywga2V5cy5tYXAodmFsaWRKc05hbWUpLCB0aGlzKTtcbiAgICBjb25zdCBtYXA6IHsgW2lkOiBudW1iZXJdOiBzdHJpbmdbXSB9ID0ge307XG4gICAga2V5cy5mb3JFYWNoKChrZXk6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgW2lkLCBwcm9wTmFtZV0gPSBkZWZpbmVNaWJQcm9wZXJ0eSh0aGlzLCBrZXksIHR5cGVzLCBkZXZpY2UucHJvcGVydGllc1trZXldKTtcbiAgICAgIGlmICghbWFwW2lkXSkge1xuICAgICAgICBtYXBbaWRdID0gW3Byb3BOYW1lXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1hcFtpZF0ucHVzaChwcm9wTmFtZSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWFwJywgbWFwLCB0aGlzKTtcbiAgfVxuXG4gIHB1YmxpYyBnZXQgY29ubmVjdGlvbigpOiBOaWJ1c0Nvbm5lY3Rpb24gfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IHsgWyR2YWx1ZXNdOiB2YWx1ZXMgfSA9IHRoaXM7XG4gICAgcmV0dXJuIHZhbHVlc1tQcml2YXRlUHJvcHMuY29ubmVjdGlvbl07XG4gIH1cblxuICBwdWJsaWMgc2V0IGNvbm5lY3Rpb24odmFsdWU6IE5pYnVzQ29ubmVjdGlvbiB8IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IHsgWyR2YWx1ZXNdOiB2YWx1ZXMgfSA9IHRoaXM7XG4gICAgY29uc3QgcHJldiA9IHZhbHVlc1tQcml2YXRlUHJvcHMuY29ubmVjdGlvbl07XG4gICAgaWYgKHByZXYgPT09IHZhbHVlKSByZXR1cm47XG4gICAgdmFsdWVzW1ByaXZhdGVQcm9wcy5jb25uZWN0aW9uXSA9IHZhbHVlO1xuICAgIC8qKlxuICAgICAqIERldmljZSBjb25uZWN0ZWQgZXZlbnRcbiAgICAgKiBAZXZlbnQgSURldmljZSNjb25uZWN0ZWRcbiAgICAgKiBAZXZlbnQgSURldmljZSNkaXNjb25uZWN0ZWRcbiAgICAgKi9cbiAgICB0aGlzLmVtaXQodmFsdWUgIT0gbnVsbCA/ICdjb25uZWN0ZWQnIDogJ2Rpc2Nvbm5lY3RlZCcpO1xuICAgIC8vIGlmICh2YWx1ZSkge1xuICAgIC8vICAgdGhpcy5kcmFpbigpLmNhdGNoKCgpID0+IHt9KTtcbiAgICAvLyB9XG4gIH1cblxuICAvLyBub2luc3BlY3Rpb24gSlNVbnVzZWRHbG9iYWxTeW1ib2xzXG4gIHB1YmxpYyB0b0pTT04oKTogYW55IHtcbiAgICBjb25zdCBqc29uOiBhbnkgPSB7XG4gICAgICBtaWI6IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21pYicsIHRoaXMpLFxuICAgIH07XG4gICAgY29uc3Qga2V5czogc3RyaW5nW10gPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtaWJQcm9wZXJ0aWVzJywgdGhpcyk7XG4gICAga2V5cy5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgIGlmICh0aGlzW2tleV0gIT09IHVuZGVmaW5lZCkganNvbltrZXldID0gdGhpc1trZXldO1xuICAgIH0pO1xuICAgIGpzb24uYWRkcmVzcyA9IHRoaXMuYWRkcmVzcy50b1N0cmluZygpO1xuICAgIHJldHVybiBqc29uO1xuICB9XG5cbiAgcHVibGljIGdldElkKGlkT3JOYW1lOiBzdHJpbmcgfCBudW1iZXIpOiBudW1iZXIge1xuICAgIGxldCBpZDogbnVtYmVyO1xuICAgIGlmICh0eXBlb2YgaWRPck5hbWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICBpZCA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ2lkJywgdGhpcywgaWRPck5hbWUpO1xuICAgICAgaWYgKE51bWJlci5pc0ludGVnZXIoaWQpKSByZXR1cm4gaWQ7XG4gICAgICBpZCA9IHRvSW50KGlkT3JOYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWQgPSBpZE9yTmFtZTtcbiAgICB9XG4gICAgY29uc3QgbWFwID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWFwJywgdGhpcyk7XG4gICAgaWYgKCFSZWZsZWN0LmhhcyhtYXAsIGlkKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHByb3BlcnR5ICR7aWRPck5hbWV9YCk7XG4gICAgfVxuICAgIHJldHVybiBpZDtcbiAgfVxuXG4gIHB1YmxpYyBnZXROYW1lKGlkT3JOYW1lOiBzdHJpbmcgfCBudW1iZXIpOiBzdHJpbmcge1xuICAgIGNvbnN0IG1hcCA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21hcCcsIHRoaXMpO1xuICAgIGlmIChSZWZsZWN0LmhhcyhtYXAsIGlkT3JOYW1lKSkge1xuICAgICAgcmV0dXJuIG1hcFtpZE9yTmFtZV1bMF07XG4gICAgfVxuICAgIGNvbnN0IGtleXM6IHN0cmluZ1tdID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWliUHJvcGVydGllcycsIHRoaXMpO1xuICAgIGlmICh0eXBlb2YgaWRPck5hbWUgPT09ICdzdHJpbmcnICYmIGtleXMuaW5jbHVkZXMoaWRPck5hbWUpKSByZXR1cm4gaWRPck5hbWU7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHByb3BlcnR5ICR7aWRPck5hbWV9YCk7XG4gIH1cblxuICAvKlxuICAgIHB1YmxpYyB0b0lkcyhpZHNPck5hbWVzOiAoc3RyaW5nIHwgbnVtYmVyKVtdKTogbnVtYmVyW10ge1xuICAgICAgY29uc3QgbWFwID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWFwJywgdGhpcyk7XG4gICAgICByZXR1cm4gaWRzT3JOYW1lcy5tYXAoKGlkT3JOYW1lKSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgaWRPck5hbWUgPT09ICdzdHJpbmcnKVxuICAgICAgfSk7XG4gICAgfVxuICAqL1xuICBwdWJsaWMgZ2V0UmF3VmFsdWUoaWRPck5hbWU6IG51bWJlciB8IHN0cmluZyk6IGFueSB7XG4gICAgY29uc3QgaWQgPSB0aGlzLmdldElkKGlkT3JOYW1lKTtcbiAgICBjb25zdCB7IFskdmFsdWVzXTogdmFsdWVzIH0gPSB0aGlzO1xuICAgIHJldHVybiB2YWx1ZXNbaWRdO1xuICB9XG5cbiAgcHVibGljIHNldFJhd1ZhbHVlKGlkT3JOYW1lOiBudW1iZXIgfCBzdHJpbmcsIHZhbHVlOiBhbnksIGlzRGlydHkgPSB0cnVlKSB7XG4gICAgLy8gZGVidWcoYHNldFJhd1ZhbHVlKCR7aWRPck5hbWV9LCAke0pTT04uc3RyaW5naWZ5KHNhZmVOdW1iZXIodmFsdWUpKX0pYCk7XG4gICAgY29uc3QgaWQgPSB0aGlzLmdldElkKGlkT3JOYW1lKTtcbiAgICBjb25zdCB7IFskdmFsdWVzXTogdmFsdWVzLCBbJGVycm9yc106IGVycm9ycyB9ID0gdGhpcztcbiAgICB2YWx1ZXNbaWRdID0gc2FmZU51bWJlcih2YWx1ZSk7XG4gICAgZGVsZXRlIGVycm9yc1tpZF07XG4gICAgdGhpcy5zZXREaXJ0eShpZCwgaXNEaXJ0eSk7XG4gIH1cblxuICBwdWJsaWMgZ2V0RXJyb3IoaWRPck5hbWU6IG51bWJlciB8IHN0cmluZyk6IGFueSB7XG4gICAgY29uc3QgaWQgPSB0aGlzLmdldElkKGlkT3JOYW1lKTtcbiAgICBjb25zdCB7IFskZXJyb3JzXTogZXJyb3JzIH0gPSB0aGlzO1xuICAgIHJldHVybiBlcnJvcnNbaWRdO1xuICB9XG5cbiAgcHVibGljIHNldEVycm9yKGlkT3JOYW1lOiBudW1iZXIgfCBzdHJpbmcsIGVycm9yPzogRXJyb3IpIHtcbiAgICBjb25zdCBpZCA9IHRoaXMuZ2V0SWQoaWRPck5hbWUpO1xuICAgIGNvbnN0IHsgWyRlcnJvcnNdOiBlcnJvcnMgfSA9IHRoaXM7XG4gICAgaWYgKGVycm9yICE9IG51bGwpIHtcbiAgICAgIGVycm9yc1tpZF0gPSBlcnJvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVsZXRlIGVycm9yc1tpZF07XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGlzRGlydHkoaWRPck5hbWU6IHN0cmluZyB8IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGlkID0gdGhpcy5nZXRJZChpZE9yTmFtZSk7XG4gICAgY29uc3QgeyBbJGRpcnRpZXNdOiBkaXJ0aWVzIH0gPSB0aGlzO1xuICAgIHJldHVybiAhIWRpcnRpZXNbaWRdO1xuICB9XG5cbiAgcHVibGljIHNldERpcnR5KGlkT3JOYW1lOiBzdHJpbmcgfCBudW1iZXIsIGlzRGlydHkgPSB0cnVlKSB7XG4gICAgY29uc3QgaWQgPSB0aGlzLmdldElkKGlkT3JOYW1lKTtcbiAgICBjb25zdCBtYXA6IHsgW2lkOiBudW1iZXJdOiBzdHJpbmdbXSB9ID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWFwJywgdGhpcyk7XG4gICAgY29uc3QgeyBbJGRpcnRpZXNdOiBkaXJ0aWVzIH0gPSB0aGlzO1xuICAgIGlmIChpc0RpcnR5KSB7XG4gICAgICBkaXJ0aWVzW2lkXSA9IHRydWU7XG4gICAgICAvLyBUT0RPOiBpbXBsZW1lbnQgYXV0b3NhdmVcbiAgICAgIC8vIHRoaXMud3JpdGUoaWQpLmNhdGNoKCgpID0+IHt9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVsZXRlIGRpcnRpZXNbaWRdO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBAZXZlbnQgSURldmljZSNjaGFuZ2VkXG4gICAgICogQGV2ZW50IElEZXZpY2UjY2hhbmdpbmdcbiAgICAgKi9cbiAgICBjb25zdCBuYW1lcyA9IG1hcFtpZF0gfHwgW107XG4gICAgdGhpcy5lbWl0KFxuICAgICAgaXNEaXJ0eSA/ICdjaGFuZ2luZycgOiAnY2hhbmdlZCcsXG4gICAgICB7XG4gICAgICAgIGlkLFxuICAgICAgICBuYW1lcyxcbiAgICAgIH0sXG4gICAgKTtcbiAgfVxuXG4gIHB1YmxpYyBhZGRyZWYoKSB7XG4gICAgdGhpcy4kY291bnRSZWYgKz0gMTtcbiAgICBkZWJ1ZygnYWRkcmVmJywgbmV3IEVycm9yKCdhZGRyZWYnKS5zdGFjayk7XG4gICAgcmV0dXJuIHRoaXMuJGNvdW50UmVmO1xuICB9XG5cbiAgcHVibGljIHJlbGVhc2UoKSB7XG4gICAgdGhpcy4kY291bnRSZWYgLT0gMTtcbiAgICBpZiAodGhpcy4kY291bnRSZWYgPD0gMCkge1xuICAgICAgZGVsZXRlIGRldmljZU1hcFt0aGlzLmFkZHJlc3MudG9TdHJpbmcoKV07XG4gICAgICAvKipcbiAgICAgICAqIEBldmVudCBEZXZpY2VzI2RlbGV0ZVxuICAgICAgICovXG4gICAgICBkZXZpY2VzLmVtaXQoJ2RlbGV0ZScsIHRoaXMpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy4kY291bnRSZWY7XG4gIH1cblxuICBwdWJsaWMgZHJhaW4oKTogUHJvbWlzZTxudW1iZXJbXT4ge1xuICAgIGRlYnVnKGBkcmFpbiBbJHt0aGlzLmFkZHJlc3N9XWApO1xuICAgIGNvbnN0IHsgWyRkaXJ0aWVzXTogZGlydGllcyB9ID0gdGhpcztcbiAgICBjb25zdCBpZHMgPSBPYmplY3Qua2V5cyhkaXJ0aWVzKS5tYXAoTnVtYmVyKS5maWx0ZXIoaWQgPT4gZGlydGllc1tpZF0pO1xuICAgIHJldHVybiBpZHMubGVuZ3RoID4gMCA/IHRoaXMud3JpdGUoLi4uaWRzKS5jYXRjaCgoKSA9PiBbXSkgOiBQcm9taXNlLnJlc29sdmUoW10pO1xuICB9XG5cbiAgcHJpdmF0ZSB3cml0ZUFsbCgpIHtcbiAgICBjb25zdCB7IFskdmFsdWVzXTogdmFsdWVzIH0gPSB0aGlzO1xuICAgIGNvbnN0IG1hcCA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21hcCcsIHRoaXMpO1xuICAgIGNvbnN0IGlkcyA9IE9iamVjdC5lbnRyaWVzKHZhbHVlcylcbiAgICAgIC5maWx0ZXIoKFssIHZhbHVlXSkgPT4gdmFsdWUgIT0gbnVsbClcbiAgICAgIC5tYXAoKFtpZF0pID0+IE51bWJlcihpZCkpXG4gICAgICAuZmlsdGVyKChpZCA9PiBSZWZsZWN0LmdldE1ldGFkYXRhKCdpc1dyaXRhYmxlJywgdGhpcywgbWFwW2lkXVswXSkpKTtcbiAgICByZXR1cm4gaWRzLmxlbmd0aCA+IDAgPyB0aGlzLndyaXRlKC4uLmlkcykgOiBQcm9taXNlLnJlc29sdmUoW10pO1xuICB9XG5cbiAgcHVibGljIHdyaXRlKC4uLmlkczogbnVtYmVyW10pOiBQcm9taXNlPG51bWJlcltdPiB7XG4gICAgY29uc3QgeyBjb25uZWN0aW9uIH0gPSB0aGlzO1xuICAgIGlmICghY29ubmVjdGlvbikgcmV0dXJuIFByb21pc2UucmVqZWN0KGAke3RoaXMuYWRkcmVzc30gaXMgZGlzY29ubmVjdGVkYCk7XG4gICAgaWYgKGlkcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB0aGlzLndyaXRlQWxsKCk7XG4gICAgfVxuICAgIGRlYnVnKGB3cml0aW5nICR7aWRzLmpvaW4oKX0gdG8gWyR7dGhpcy5hZGRyZXNzfV1gKTtcbiAgICBjb25zdCBtYXAgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBjb25zdCByZXF1ZXN0cyA9IGlkcy5yZWR1Y2UoXG4gICAgICAoYWNjOiBObXNEYXRhZ3JhbVtdLCBpZCkgPT4ge1xuICAgICAgICBjb25zdCBbbmFtZV0gPSBtYXBbaWRdO1xuICAgICAgICBpZiAoIW5hbWUpIHtcbiAgICAgICAgICBkZWJ1ZyhgVW5rbm93biBpZDogJHtpZH0gZm9yICR7UmVmbGVjdC5nZXRNZXRhZGF0YSgnbWliJywgdGhpcyl9YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYWNjLnB1c2goY3JlYXRlTm1zV3JpdGUoXG4gICAgICAgICAgICB0aGlzLmFkZHJlc3MsXG4gICAgICAgICAgICBpZCxcbiAgICAgICAgICAgIFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ25tc1R5cGUnLCB0aGlzLCBuYW1lKSxcbiAgICAgICAgICAgIHRoaXMuZ2V0UmF3VmFsdWUoaWQpLFxuICAgICAgICAgICkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhY2M7XG4gICAgICB9LFxuICAgICAgW10sXG4gICAgKTtcbiAgICByZXR1cm4gUHJvbWlzZS5hbGwoXG4gICAgICByZXF1ZXN0c1xuICAgICAgICAubWFwKGRhdGFncmFtID0+IGNvbm5lY3Rpb24uc2VuZERhdGFncmFtKGRhdGFncmFtKVxuICAgICAgICAgIC50aGVuKChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgeyBzdGF0dXMgfSA9IHJlc3BvbnNlIGFzIE5tc0RhdGFncmFtO1xuICAgICAgICAgICAgaWYgKHN0YXR1cyA9PT0gMCkge1xuICAgICAgICAgICAgICB0aGlzLnNldERpcnR5KGRhdGFncmFtLmlkLCBmYWxzZSk7XG4gICAgICAgICAgICAgIHJldHVybiBkYXRhZ3JhbS5pZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc2V0RXJyb3IoZGF0YWdyYW0uaWQsIG5ldyBOaWJ1c0Vycm9yKHN0YXR1cyEsIHRoaXMpKTtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICB9LCAocmVhc29uKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldEVycm9yKGRhdGFncmFtLmlkLCByZWFzb24pO1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgIH0pKSlcbiAgICAgIC50aGVuKGlkcyA9PiBpZHMuZmlsdGVyKGlkID0+IGlkID4gMCkpO1xuICB9XG5cbiAgcHVibGljIHdyaXRlVmFsdWVzKHNvdXJjZTogb2JqZWN0LCBzdHJvbmcgPSB0cnVlKTogUHJvbWlzZTxudW1iZXJbXT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBpZHMgPSBPYmplY3Qua2V5cyhzb3VyY2UpLm1hcChuYW1lID0+IHRoaXMuZ2V0SWQobmFtZSkpO1xuICAgICAgaWYgKGlkcy5sZW5ndGggPT09IDApIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgVHlwZUVycm9yKCd2YWx1ZSBpcyBlbXB0eScpKTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcywgc291cmNlKTtcbiAgICAgIHJldHVybiB0aGlzLndyaXRlKC4uLmlkcylcbiAgICAgICAgLnRoZW4oKHdyaXR0ZW4pID0+IHtcbiAgICAgICAgICBpZiAod3JpdHRlbi5sZW5ndGggPT09IDAgfHwgKHN0cm9uZyAmJiB3cml0dGVuLmxlbmd0aCAhPT0gaWRzLmxlbmd0aCkpIHtcbiAgICAgICAgICAgIHRocm93IHRoaXMuZ2V0RXJyb3IoaWRzWzBdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHdyaXR0ZW47XG4gICAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSByZWFkQWxsKCk6IFByb21pc2U8YW55PiB7XG4gICAgY29uc3QgbWFwOiB7IFtpZDogc3RyaW5nXTogc3RyaW5nW10gfSA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21hcCcsIHRoaXMpO1xuICAgIGNvbnN0IGlkcyA9IE9iamVjdC5lbnRyaWVzKG1hcClcbiAgICAgIC5maWx0ZXIoKFssIG5hbWVzXSkgPT4gUmVmbGVjdC5nZXRNZXRhZGF0YSgnaXNSZWFkYWJsZScsIHRoaXMsIG5hbWVzWzBdKSlcbiAgICAgIC5tYXAoKFtpZF0pID0+IE51bWJlcihpZCkpO1xuICAgIHJldHVybiBpZHMubGVuZ3RoID4gMCA/IHRoaXMucmVhZCguLi5pZHMpIDogUHJvbWlzZS5yZXNvbHZlKFtdKTtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyByZWFkKC4uLmlkczogbnVtYmVyW10pOiBQcm9taXNlPHsgW25hbWU6IHN0cmluZ106IGFueSB9PiB7XG4gICAgY29uc3QgeyBjb25uZWN0aW9uIH0gPSB0aGlzO1xuICAgIGlmICghY29ubmVjdGlvbikgcmV0dXJuIFByb21pc2UucmVqZWN0KCdkaXNjb25uZWN0ZWQnKTtcbiAgICBpZiAoaWRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHRoaXMucmVhZEFsbCgpO1xuICAgIC8vIGRlYnVnKGByZWFkICR7aWRzLmpvaW4oKX0gZnJvbSBbJHt0aGlzLmFkZHJlc3N9XWApO1xuICAgIGNvbnN0IGRpc2FibGVCYXRjaFJlYWRpbmcgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdkaXNhYmxlQmF0Y2hSZWFkaW5nJywgdGhpcyk7XG4gICAgY29uc3QgbWFwOiB7IFtpZDogc3RyaW5nXTogc3RyaW5nW10gfSA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21hcCcsIHRoaXMpO1xuICAgIGNvbnN0IGNodW5rcyA9IGNodW5rQXJyYXkoaWRzLCBkaXNhYmxlQmF0Y2hSZWFkaW5nID8gMSA6IDIxKTtcbiAgICBkZWJ1ZyhgcmVhZCBbJHtjaHVua3MubWFwKGNodW5rID0+IGBbJHtjaHVuay5qb2luKCl9XWApLmpvaW4oKX1dIGZyb20gWyR7dGhpcy5hZGRyZXNzfV1gKTtcbiAgICBjb25zdCByZXF1ZXN0cyA9IGNodW5rcy5tYXAoY2h1bmsgPT4gY3JlYXRlTm1zUmVhZCh0aGlzLmFkZHJlc3MsIC4uLmNodW5rKSk7XG4gICAgcmV0dXJuIHJlcXVlc3RzLnJlZHVjZShcbiAgICAgIGFzeW5jIChwcm9taXNlLCBkYXRhZ3JhbSkgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBwcm9taXNlO1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNvbm5lY3Rpb24uc2VuZERhdGFncmFtKGRhdGFncmFtKTtcbiAgICAgICAgY29uc3QgZGF0YWdyYW1zOiBObXNEYXRhZ3JhbVtdID0gQXJyYXkuaXNBcnJheShyZXNwb25zZSlcbiAgICAgICAgICA/IHJlc3BvbnNlIGFzIE5tc0RhdGFncmFtW11cbiAgICAgICAgICA6IFtyZXNwb25zZSBhcyBObXNEYXRhZ3JhbV07XG4gICAgICAgIGRhdGFncmFtcy5mb3JFYWNoKCh7IGlkLCB2YWx1ZSwgc3RhdHVzIH0pID0+IHtcbiAgICAgICAgICBpZiAoc3RhdHVzID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLnNldFJhd1ZhbHVlKGlkLCB2YWx1ZSwgZmFsc2UpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNldEVycm9yKGlkLCBuZXcgTmlidXNFcnJvcihzdGF0dXMhLCB0aGlzKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IG5hbWVzID0gbWFwW2lkXTtcbiAgICAgICAgICBjb25zb2xlLmFzc2VydChuYW1lcyAmJiBuYW1lcy5sZW5ndGggPiAwLCBgSW52YWxpZCBpZCAke2lkfWApO1xuICAgICAgICAgIG5hbWVzLmZvckVhY2goKHByb3BOYW1lKSA9PiB7XG4gICAgICAgICAgICByZXN1bHRbcHJvcE5hbWVdID0gc3RhdHVzID09PSAwXG4gICAgICAgICAgICAgID8gdGhpc1twcm9wTmFtZV1cbiAgICAgICAgICAgICAgOiB7IGVycm9yOiAodGhpcy5nZXRFcnJvcihpZCkgfHwge30pLm1lc3NhZ2UgfHwgJ2Vycm9yJyB9O1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0sXG4gICAgICBQcm9taXNlLnJlc29sdmUoe30gYXMgeyBbbmFtZTogc3RyaW5nXTogYW55IH0pLFxuICAgICk7XG4gIH1cblxuICBhc3luYyB1cGxvYWQoZG9tYWluOiBzdHJpbmcsIG9mZnNldCA9IDAsIHNpemU/OiBudW1iZXIpOiBQcm9taXNlPEJ1ZmZlcj4ge1xuICAgIGNvbnN0IHsgY29ubmVjdGlvbiB9ID0gdGhpcztcbiAgICB0cnkge1xuICAgICAgaWYgKCFjb25uZWN0aW9uKSB0aHJvdyBuZXcgRXJyb3IoJ2Rpc2Nvbm5lY3RlZCcpO1xuICAgICAgY29uc3QgcmVxVXBsb2FkID0gY3JlYXRlTm1zUmVxdWVzdERvbWFpblVwbG9hZCh0aGlzLmFkZHJlc3MsIGRvbWFpbi5wYWRFbmQoOCwgJ1xcMCcpKTtcbiAgICAgIGNvbnN0IHsgaWQsIHZhbHVlOiBkb21haW5TaXplLCBzdGF0dXMgfSA9XG4gICAgICAgIGF3YWl0IGNvbm5lY3Rpb24uc2VuZERhdGFncmFtKHJlcVVwbG9hZCkgYXMgTm1zRGF0YWdyYW07XG4gICAgICBpZiAoc3RhdHVzICE9PSAwKSB7XG4gICAgICAgIC8vIGRlYnVnKCc8ZXJyb3I+Jywgc3RhdHVzKTtcbiAgICAgICAgdGhyb3cgbmV3IE5pYnVzRXJyb3Ioc3RhdHVzISwgdGhpcywgJ1JlcXVlc3QgdXBsb2FkIGRvbWFpbiBlcnJvcicpO1xuICAgICAgfVxuICAgICAgY29uc3QgaW5pdFVwbG9hZCA9IGNyZWF0ZU5tc0luaXRpYXRlVXBsb2FkU2VxdWVuY2UodGhpcy5hZGRyZXNzLCBpZCk7XG4gICAgICBjb25zdCB7IHN0YXR1czogaW5pdFN0YXQgfSA9IGF3YWl0IGNvbm5lY3Rpb24uc2VuZERhdGFncmFtKGluaXRVcGxvYWQpIGFzIE5tc0RhdGFncmFtO1xuICAgICAgaWYgKGluaXRTdGF0ICE9PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBOaWJ1c0Vycm9yKGluaXRTdGF0ISwgdGhpcywgJ0luaXRpYXRlIHVwbG9hZCBkb21haW4gZXJyb3InKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRvdGFsID0gc2l6ZSB8fCAoZG9tYWluU2l6ZSAtIG9mZnNldCk7XG4gICAgICBsZXQgcmVzdCA9IHRvdGFsO1xuICAgICAgbGV0IHBvcyA9IG9mZnNldDtcbiAgICAgIHRoaXMuZW1pdChcbiAgICAgICAgJ3VwbG9hZFN0YXJ0JyxcbiAgICAgICAge1xuICAgICAgICAgIGRvbWFpbixcbiAgICAgICAgICBkb21haW5TaXplLFxuICAgICAgICAgIG9mZnNldCxcbiAgICAgICAgICBzaXplOiB0b3RhbCxcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgICBjb25zdCBidWZzOiBCdWZmZXJbXSA9IFtdO1xuICAgICAgd2hpbGUgKHJlc3QgPiAwKSB7XG4gICAgICAgIGNvbnN0IGxlbmd0aCA9IE1hdGgubWluKDI1NSwgcmVzdCk7XG4gICAgICAgIGNvbnN0IHVwbG9hZFNlZ21lbnQgPSBjcmVhdGVObXNVcGxvYWRTZWdtZW50KHRoaXMuYWRkcmVzcywgaWQsIHBvcywgbGVuZ3RoKTtcbiAgICAgICAgY29uc3QgeyBzdGF0dXM6IHVwbG9hZFN0YXR1cywgdmFsdWU6IHJlc3VsdCB9ID1cbiAgICAgICAgICBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbSh1cGxvYWRTZWdtZW50KSBhcyBObXNEYXRhZ3JhbTtcbiAgICAgICAgaWYgKHVwbG9hZFN0YXR1cyAhPT0gMCkge1xuICAgICAgICAgIHRocm93IG5ldyBOaWJ1c0Vycm9yKHVwbG9hZFN0YXR1cyEsIHRoaXMsICdVcGxvYWQgc2VnbWVudCBlcnJvcicpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXN1bHQuZGF0YS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBidWZzLnB1c2gocmVzdWx0LmRhdGEpO1xuICAgICAgICB0aGlzLmVtaXQoXG4gICAgICAgICAgJ3VwbG9hZERhdGEnLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGRvbWFpbixcbiAgICAgICAgICAgIHBvcyxcbiAgICAgICAgICAgIGRhdGE6IHJlc3VsdC5kYXRhLFxuICAgICAgICAgIH0sXG4gICAgICAgICk7XG4gICAgICAgIHJlc3QgLT0gcmVzdWx0LmRhdGEubGVuZ3RoO1xuICAgICAgICBwb3MgKz0gcmVzdWx0LmRhdGEubGVuZ3RoO1xuICAgICAgfVxuICAgICAgY29uc3QgcmVzdWx0ID0gQnVmZmVyLmNvbmNhdChidWZzKTtcbiAgICAgIHRoaXMuZW1pdChcbiAgICAgICAgJ3VwbG9hZEZpbmlzaCcsXG4gICAgICAgIHtcbiAgICAgICAgICBkb21haW4sXG4gICAgICAgICAgb2Zmc2V0LFxuICAgICAgICAgIGRhdGE6IHJlc3VsdCxcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMuZW1pdCgndXBsb2FkRXJyb3InLCBlKTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZG93bmxvYWQoZG9tYWluOiBzdHJpbmcsIGJ1ZmZlcjogQnVmZmVyLCBvZmZzZXQgPSAwLCBub1Rlcm0gPSBmYWxzZSkge1xuICAgIGNvbnN0IHsgY29ubmVjdGlvbiB9ID0gdGhpcztcbiAgICBpZiAoIWNvbm5lY3Rpb24pIHRocm93IG5ldyBFcnJvcignZGlzY29ubmVjdGVkJyk7XG4gICAgY29uc3QgcmVxRG93bmxvYWQgPSBjcmVhdGVObXNSZXF1ZXN0RG9tYWluRG93bmxvYWQodGhpcy5hZGRyZXNzLCBkb21haW4ucGFkRW5kKDgsICdcXDAnKSk7XG4gICAgY29uc3QgeyBpZCwgdmFsdWU6IG1heCwgc3RhdHVzIH0gPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShyZXFEb3dubG9hZCkgYXMgTm1zRGF0YWdyYW07XG4gICAgaWYgKHN0YXR1cyAhPT0gMCkge1xuICAgICAgLy8gZGVidWcoJzxlcnJvcj4nLCBzdGF0dXMpO1xuICAgICAgdGhyb3cgbmV3IE5pYnVzRXJyb3Ioc3RhdHVzISwgdGhpcywgJ1JlcXVlc3QgZG93bmxvYWQgZG9tYWluIGVycm9yJyk7XG4gICAgfVxuICAgIGNvbnN0IHRlcm1pbmF0ZSA9IGFzeW5jIChlcnI/OiBFcnJvcikgPT4ge1xuICAgICAgbGV0IHRlcm1TdGF0ID0gMDtcbiAgICAgIGlmICghbm9UZXJtKSB7XG4gICAgICAgIGNvbnN0IHJlcSA9IGNyZWF0ZU5tc1Rlcm1pbmF0ZURvd25sb2FkU2VxdWVuY2UodGhpcy5hZGRyZXNzLCBpZCk7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGNvbm5lY3Rpb24uc2VuZERhdGFncmFtKHJlcSkgYXMgTm1zRGF0YWdyYW07XG4gICAgICAgIHRlcm1TdGF0ID0gcmVzLnN0YXR1cyE7XG4gICAgICB9XG4gICAgICBpZiAoZXJyKSB0aHJvdyBlcnI7XG4gICAgICBpZiAodGVybVN0YXQgIT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IE5pYnVzRXJyb3IoXG4gICAgICAgICAgdGVybVN0YXQhLFxuICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgJ1Rlcm1pbmF0ZSBkb3dubG9hZCBzZXF1ZW5jZSBlcnJvciwgbWF5YmUgbmVlZCAtLW5vLXRlcm0nLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH07XG4gICAgaWYgKGJ1ZmZlci5sZW5ndGggPiBtYXggLSBvZmZzZXQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQnVmZmVyIHRvIGxhcmdlLiBFeHBlY3RlZCAke21heCAtIG9mZnNldH0gYnl0ZXNgKTtcbiAgICB9XG4gICAgY29uc3QgaW5pdERvd25sb2FkID0gY3JlYXRlTm1zSW5pdGlhdGVEb3dubG9hZFNlcXVlbmNlKHRoaXMuYWRkcmVzcywgaWQpO1xuICAgIGNvbnN0IHsgc3RhdHVzOiBpbml0U3RhdCB9ID0gYXdhaXQgY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0oaW5pdERvd25sb2FkKSBhcyBObXNEYXRhZ3JhbTtcbiAgICBpZiAoaW5pdFN0YXQgIT09IDApIHtcbiAgICAgIHRocm93IG5ldyBOaWJ1c0Vycm9yKGluaXRTdGF0ISwgdGhpcywgJ0luaXRpYXRlIGRvd25sb2FkIGRvbWFpbiBlcnJvcicpO1xuICAgIH1cbiAgICB0aGlzLmVtaXQoXG4gICAgICAnZG93bmxvYWRTdGFydCcsXG4gICAgICB7XG4gICAgICAgIGRvbWFpbixcbiAgICAgICAgb2Zmc2V0LFxuICAgICAgICBkb21haW5TaXplOiBtYXgsXG4gICAgICAgIHNpemU6IGJ1ZmZlci5sZW5ndGgsXG4gICAgICB9LFxuICAgICk7XG4gICAgY29uc3QgY3JjID0gY3JjMTZjY2l0dChidWZmZXIsIDApO1xuICAgIGNvbnN0IGNodW5rU2l6ZSA9IE5NU19NQVhfREFUQV9MRU5HVEggLSA0O1xuICAgIGNvbnN0IGNodW5rcyA9IGNodW5rQXJyYXkoYnVmZmVyLCBjaHVua1NpemUpO1xuICAgIGF3YWl0IGNodW5rcy5yZWR1Y2UoYXN5bmMgKHByZXYsIGNodW5rOiBCdWZmZXIsIGkpID0+IHtcbiAgICAgIGF3YWl0IHByZXY7XG4gICAgICBjb25zdCBwb3MgPSBpICogY2h1bmtTaXplICsgb2Zmc2V0O1xuICAgICAgY29uc3Qgc2VnbWVudERvd25sb2FkID1cbiAgICAgICAgY3JlYXRlTm1zRG93bmxvYWRTZWdtZW50KHRoaXMuYWRkcmVzcywgaWQhLCBwb3MsIGNodW5rKTtcbiAgICAgIGNvbnN0IHsgc3RhdHVzOiBkb3dubG9hZFN0YXQgfSA9XG4gICAgICAgIGF3YWl0IGNvbm5lY3Rpb24uc2VuZERhdGFncmFtKHNlZ21lbnREb3dubG9hZCkgYXMgTm1zRGF0YWdyYW07XG4gICAgICBpZiAoZG93bmxvYWRTdGF0ICE9PSAwKSB7XG4gICAgICAgIGF3YWl0IHRlcm1pbmF0ZShuZXcgTmlidXNFcnJvcihkb3dubG9hZFN0YXQhLCB0aGlzLCAnRG93bmxvYWQgc2VnbWVudCBlcnJvcicpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZW1pdChcbiAgICAgICAgJ2Rvd25sb2FkRGF0YScsXG4gICAgICAgIHtcbiAgICAgICAgICBkb21haW4sXG4gICAgICAgICAgbGVuZ3RoOiBjaHVuay5sZW5ndGgsXG4gICAgICAgIH0sXG4gICAgICApO1xuICAgIH0sIFByb21pc2UucmVzb2x2ZSgpKTtcbiAgICBjb25zdCB2ZXJpZnkgPSBjcmVhdGVObXNWZXJpZnlEb21haW5DaGVja3N1bSh0aGlzLmFkZHJlc3MsIGlkLCBvZmZzZXQsIGJ1ZmZlci5sZW5ndGgsIGNyYyk7XG4gICAgY29uc3QgeyBzdGF0dXM6IHZlcmlmeVN0YXQgfSA9IGF3YWl0IGNvbm5lY3Rpb24uc2VuZERhdGFncmFtKHZlcmlmeSkgYXMgTm1zRGF0YWdyYW07XG4gICAgaWYgKHZlcmlmeVN0YXQgIT09IDApIHtcbiAgICAgIGF3YWl0IHRlcm1pbmF0ZShuZXcgTmlidXNFcnJvcih2ZXJpZnlTdGF0ISwgdGhpcywgJ0Rvd25sb2FkIHNlZ21lbnQgZXJyb3InKSk7XG4gICAgfVxuICAgIGF3YWl0IHRlcm1pbmF0ZSgpO1xuICAgIHRoaXMuZW1pdChcbiAgICAgICdkb3dubG9hZEZpbmlzaCcsXG4gICAgICB7XG4gICAgICAgIGRvbWFpbixcbiAgICAgICAgb2Zmc2V0LFxuICAgICAgICBzaXplOiBidWZmZXIubGVuZ3RoLFxuICAgICAgfSxcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgZXhlY3V0ZShwcm9ncmFtOiBzdHJpbmcsIGFyZ3M/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSB7XG4gICAgY29uc3QgeyBjb25uZWN0aW9uIH0gPSB0aGlzO1xuICAgIGlmICghY29ubmVjdGlvbikgdGhyb3cgbmV3IEVycm9yKCdkaXNjb25uZWN0ZWQnKTtcbiAgICBjb25zdCBzdWJyb3V0aW5lcyA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ3N1YnJvdXRpbmVzJywgdGhpcykgYXMgUmVjb3JkPHN0cmluZywgSVN1YnJvdXRpbmVEZXNjPjtcbiAgICBpZiAoIXN1YnJvdXRpbmVzIHx8ICFSZWZsZWN0LmhhcyhzdWJyb3V0aW5lcywgcHJvZ3JhbSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBwcm9ncmFtICR7cHJvZ3JhbX1gKTtcbiAgICB9XG4gICAgY29uc3Qgc3Vicm91dGluZSA9IHN1YnJvdXRpbmVzW3Byb2dyYW1dO1xuICAgIGNvbnN0IHByb3BzOiBUeXBlZFZhbHVlW10gPSBbXTtcbiAgICBpZiAoc3Vicm91dGluZS5hcmdzKSB7XG4gICAgICBPYmplY3QuZW50cmllcyhzdWJyb3V0aW5lLmFyZ3MpLmZvckVhY2goKFtuYW1lLCBkZXNjXSkgPT4ge1xuICAgICAgICBjb25zdCBhcmcgPSBhcmdzICYmIGFyZ3NbbmFtZV07XG4gICAgICAgIGlmICghYXJnKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGFyZyAke25hbWV9IGluIHByb2dyYW0gJHtwcm9ncmFtfWApO1xuICAgICAgICBwcm9wcy5wdXNoKFtkZXNjLnR5cGUsIGFyZ10pO1xuICAgICAgfSk7XG4gICAgfVxuICAgIGNvbnN0IHJlcSA9IGNyZWF0ZUV4ZWN1dGVQcm9ncmFtSW52b2NhdGlvbihcbiAgICAgIHRoaXMuYWRkcmVzcyxcbiAgICAgIHN1YnJvdXRpbmUuaWQsXG4gICAgICBzdWJyb3V0aW5lLm5vdFJlcGx5LFxuICAgICAgLi4ucHJvcHMsXG4gICAgKTtcbiAgICByZXR1cm4gY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0ocmVxKTtcbiAgfVxufVxuXG4vLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmVcbmludGVyZmFjZSBEZXZpY2VQcm90b3R5cGUge1xuICByZWFkb25seSBhZGRyZXNzOiBBZGRyZXNzO1xuICBbbWliUHJvcGVydHk6IHN0cmluZ106IGFueTtcbiAgJGNvdW50UmVmOiBudW1iZXI7XG4gIFskdmFsdWVzXTogeyBbaWQ6IG51bWJlcl06IGFueSB9O1xuICBbJGVycm9yc106IHsgW2lkOiBudW1iZXJdOiBFcnJvciB9O1xuICBbJGRpcnRpZXNdOiB7IFtpZDogbnVtYmVyXTogYm9vbGVhbiB9O1xufVxuXG5mdW5jdGlvbiBmaW5kTWliQnlUeXBlKHR5cGU6IG51bWJlciwgdmVyc2lvbj86IG51bWJlcik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IGNvbmYgPSBwYXRoLnJlc29sdmUoY29uZmlnRGlyIHx8ICcvdG1wJywgJ2NvbmZpZ3N0b3JlJywgcGtnTmFtZSk7XG4gIGNvbnN0IHZhbGlkYXRlID0gQ29uZmlnVi5kZWNvZGUocmVxdWlyZShjb25mKSk7XG4gIGlmICh2YWxpZGF0ZS5pc0xlZnQoKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBjb25maWcgZmlsZSAke2NvbmZ9XG4gICR7UGF0aFJlcG9ydGVyLnJlcG9ydCh2YWxpZGF0ZSl9YCk7XG4gIH1cbiAgY29uc3QgeyBtaWJUeXBlcyB9ID0gdmFsaWRhdGUudmFsdWU7XG4gIGNvbnN0IG1pYnMgPSBtaWJUeXBlcyFbdHlwZV07XG4gIGlmIChtaWJzICYmIG1pYnMubGVuZ3RoKSB7XG4gICAgbGV0IG1pYlR5cGUgPSBtaWJzWzBdO1xuICAgIGlmICh2ZXJzaW9uICYmIG1pYnMubGVuZ3RoID4gMSkge1xuICAgICAgbWliVHlwZSA9IF8uZmluZExhc3QobWlicywgKHsgbWluVmVyc2lvbiA9IDAgfSkgPT4gbWluVmVyc2lvbiA8PSB2ZXJzaW9uKSB8fCBtaWJUeXBlO1xuICAgIH1cbiAgICByZXR1cm4gbWliVHlwZS5taWI7XG4gIH1cbiAgLy8gY29uc3QgY2FjaGVNaWJzID0gT2JqZWN0LmtleXMobWliVHlwZXNDYWNoZSk7XG4gIC8vIGNvbnN0IGNhY2hlZCA9IGNhY2hlTWlicy5maW5kKG1pYiA9PlxuICAvLyAgIFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ2RldmljZVR5cGUnLCBtaWJUeXBlc0NhY2hlW21pYl0ucHJvdG90eXBlKSA9PT0gdHlwZSk7XG4gIC8vIGlmIChjYWNoZWQpIHJldHVybiBjYWNoZWQ7XG4gIC8vIGNvbnN0IG1pYnMgPSBnZXRNaWJzU3luYygpO1xuICAvLyByZXR1cm4gXy5kaWZmZXJlbmNlKG1pYnMsIGNhY2hlTWlicykuZmluZCgobWliTmFtZSkgPT4ge1xuICAvLyAgIGNvbnN0IG1pYmZpbGUgPSBnZXRNaWJGaWxlKG1pYk5hbWUpO1xuICAvLyAgIGNvbnN0IG1pYjogSU1pYkRldmljZSA9IHJlcXVpcmUobWliZmlsZSk7XG4gIC8vICAgY29uc3QgeyB0eXBlcyB9ID0gbWliO1xuICAvLyAgIGNvbnN0IGRldmljZSA9IHR5cGVzW21pYi5kZXZpY2VdIGFzIElNaWJEZXZpY2VUeXBlO1xuICAvLyAgIHJldHVybiB0b0ludChkZXZpY2UuYXBwaW5mby5kZXZpY2VfdHlwZSkgPT09IHR5cGU7XG4gIC8vIH0pO1xufVxuXG5kZWNsYXJlIGludGVyZmFjZSBEZXZpY2VzIHtcbiAgb24oZXZlbnQ6ICduZXcnIHwgJ2RlbGV0ZScsIGRldmljZUxpc3RlbmVyOiAoZGV2aWNlOiBJRGV2aWNlKSA9PiB2b2lkKTogdGhpcztcbiAgb25jZShldmVudDogJ25ldycgfCAnZGVsZXRlJywgZGV2aWNlTGlzdGVuZXI6IChkZXZpY2U6IElEZXZpY2UpID0+IHZvaWQpOiB0aGlzO1xuICBhZGRMaXN0ZW5lcihldmVudDogJ25ldycgfCAnZGVsZXRlJywgZGV2aWNlTGlzdGVuZXI6IChkZXZpY2U6IElEZXZpY2UpID0+IHZvaWQpOiB0aGlzO1xufVxuXG5mdW5jdGlvbiBnZXRDb25zdHJ1Y3RvcihtaWI6IHN0cmluZyk6IEZ1bmN0aW9uIHtcbiAgbGV0IGNvbnN0cnVjdG9yID0gbWliVHlwZXNDYWNoZVttaWJdO1xuICBpZiAoIWNvbnN0cnVjdG9yKSB7XG4gICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lXG4gICAgZnVuY3Rpb24gRGV2aWNlKHRoaXM6IERldmljZVByb3RvdHlwZSwgYWRkcmVzczogQWRkcmVzcykge1xuICAgICAgRXZlbnRFbWl0dGVyLmFwcGx5KHRoaXMpO1xuICAgICAgdGhpc1skdmFsdWVzXSA9IHt9O1xuICAgICAgdGhpc1skZXJyb3JzXSA9IHt9O1xuICAgICAgdGhpc1skZGlydGllc10gPSB7fTtcbiAgICAgIFJlZmxlY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2FkZHJlc3MnLCB3aXRoVmFsdWUoYWRkcmVzcykpO1xuICAgICAgdGhpcy4kY291bnRSZWYgPSAxO1xuICAgICAgZGVidWcobmV3IEVycm9yKCdDUkVBVEUnKS5zdGFjayk7XG4gICAgICAvLyB0aGlzLiRkZWJvdW5jZURyYWluID0gXy5kZWJvdW5jZSh0aGlzLmRyYWluLCAyNSk7XG4gICAgfVxuXG4gICAgY29uc3QgcHJvdG90eXBlID0gbmV3IERldmljZVByb3RvdHlwZShtaWIpO1xuICAgIERldmljZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHByb3RvdHlwZSk7XG4gICAgY29uc3RydWN0b3IgPSBEZXZpY2U7XG4gICAgbWliVHlwZXNDYWNoZVttaWJdID0gY29uc3RydWN0b3I7XG4gIH1cbiAgcmV0dXJuIGNvbnN0cnVjdG9yO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TWliUHJvdG90eXBlKG1pYjogc3RyaW5nKTogT2JqZWN0IHtcbiAgcmV0dXJuIGdldENvbnN0cnVjdG9yKG1pYikucHJvdG90eXBlO1xufVxuXG5jbGFzcyBEZXZpY2VzIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgZ2V0ID0gKCk6IElEZXZpY2VbXSA9PiBfLnZhbHVlcyhkZXZpY2VNYXApO1xuXG4gIGZpbmQgPSAoYWRkcmVzczogQWRkcmVzc1BhcmFtKTogSURldmljZSB8IHVuZGVmaW5lZCA9PiB7XG4gICAgY29uc3QgdGFyZ2V0QWRkcmVzcyA9IG5ldyBBZGRyZXNzKGFkZHJlc3MpO1xuICAgIHJldHVybiBkZXZpY2VNYXBbdGFyZ2V0QWRkcmVzcy50b1N0cmluZygpXTtcbiAgfTtcblxuICBjcmVhdGUoYWRkcmVzczogQWRkcmVzc1BhcmFtLCBtaWI6IHN0cmluZyk6IElEZXZpY2U7XG4gIGNyZWF0ZShhZGRyZXNzOiBBZGRyZXNzUGFyYW0sIHR5cGU6IG51bWJlciwgdmVyc2lvbj86IG51bWJlcik6IElEZXZpY2U7XG4gIGNyZWF0ZShhZGRyZXNzOiBBZGRyZXNzUGFyYW0sIG1pYk9yVHlwZTogYW55LCB2ZXJzaW9uPzogbnVtYmVyKTogSURldmljZSB7XG4gICAgbGV0IG1pYjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgIGlmICh0eXBlb2YgbWliT3JUeXBlID09PSAnbnVtYmVyJykge1xuICAgICAgbWliID0gZmluZE1pYkJ5VHlwZShtaWJPclR5cGUsIHZlcnNpb24pO1xuICAgICAgaWYgKG1pYiA9PT0gdW5kZWZpbmVkKSB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gbWliIHR5cGUnKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBtaWJPclR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICBtaWIgPSBTdHJpbmcobWliT3JUeXBlIHx8ICdtaW5paG9zdF92Mi4wNmInKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtaWIgb3IgdHlwZSBleHBlY3RlZCwgZ290ICR7bWliT3JUeXBlfWApO1xuICAgIH1cbiAgICBjb25zdCB0YXJnZXRBZGRyZXNzID0gbmV3IEFkZHJlc3MoYWRkcmVzcyk7XG4gICAgbGV0IGRldmljZSA9IGRldmljZU1hcFt0YXJnZXRBZGRyZXNzLnRvU3RyaW5nKCldO1xuICAgIGlmIChkZXZpY2UpIHtcbiAgICAgIGNvbnNvbGUuYXNzZXJ0KFxuICAgICAgICBSZWZsZWN0LmdldE1ldGFkYXRhKCdtaWInLCBkZXZpY2UpID09PSBtaWIsXG4gICAgICAgIGBtaWJzIGFyZSBkaWZmZXJlbnQsIGV4cGVjdGVkICR7bWlifWAsXG4gICAgICApO1xuICAgICAgZGV2aWNlLmFkZHJlZigpO1xuICAgICAgcmV0dXJuIGRldmljZTtcbiAgICB9XG5cbiAgICBjb25zdCBjb25zdHJ1Y3RvciA9IGdldENvbnN0cnVjdG9yKG1pYik7XG4gICAgZGV2aWNlID0gUmVmbGVjdC5jb25zdHJ1Y3QoY29uc3RydWN0b3IsIFt0YXJnZXRBZGRyZXNzXSk7XG4gICAgaWYgKCF0YXJnZXRBZGRyZXNzLmlzRW1wdHkpIHtcbiAgICAgIGRldmljZU1hcFt0YXJnZXRBZGRyZXNzLnRvU3RyaW5nKCldID0gZGV2aWNlO1xuICAgICAgcHJvY2Vzcy5uZXh0VGljaygoKSA9PiB0aGlzLmVtaXQoJ25ldycsIGRldmljZSkpO1xuICAgIH1cbiAgICByZXR1cm4gZGV2aWNlO1xuICB9XG59XG5cbmNvbnN0IGRldmljZXMgPSBuZXcgRGV2aWNlcygpO1xuXG5leHBvcnQgZGVmYXVsdCBkZXZpY2VzO1xuIl19