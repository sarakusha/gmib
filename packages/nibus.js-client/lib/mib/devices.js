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
      converters.push((0, _mib.enumerationConverter)(enumeration, simpleType));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taWIvZGV2aWNlcy50cyJdLCJuYW1lcyI6WyJwa2dOYW1lIiwiZGVidWciLCIkdmFsdWVzIiwiU3ltYm9sIiwiJGVycm9ycyIsIiRkaXJ0aWVzIiwic2FmZU51bWJlciIsInZhbCIsIm51bSIsInBhcnNlRmxvYXQiLCJOdW1iZXIiLCJpc05hTiIsIlByaXZhdGVQcm9wcyIsImRldmljZU1hcCIsIm1pYlR5cGVzQ2FjaGUiLCJNaWJQcm9wZXJ0eUFwcEluZm9WIiwidCIsImludGVyc2VjdGlvbiIsInR5cGUiLCJubXNfaWQiLCJ1bmlvbiIsInN0cmluZyIsIkludCIsImFjY2VzcyIsInBhcnRpYWwiLCJjYXRlZ29yeSIsIk1pYlByb3BlcnR5ViIsImFubm90YXRpb24iLCJhcHBpbmZvIiwiTWliRGV2aWNlQXBwSW5mb1YiLCJtaWJfdmVyc2lvbiIsImRldmljZV90eXBlIiwibG9hZGVyX3R5cGUiLCJmaXJtd2FyZSIsIm1pbl92ZXJzaW9uIiwiTWliRGV2aWNlVHlwZVYiLCJwcm9wZXJ0aWVzIiwicmVjb3JkIiwiTWliVHlwZVYiLCJiYXNlIiwiemVybyIsInVuaXRzIiwicHJlY2lzaW9uIiwicmVwcmVzZW50YXRpb24iLCJtaW5JbmNsdXNpdmUiLCJtYXhJbmNsdXNpdmUiLCJlbnVtZXJhdGlvbiIsIk1pYlN1YnJvdXRpbmVWIiwicmVzcG9uc2UiLCJTdWJyb3V0aW5lVHlwZVYiLCJpZCIsImxpdGVyYWwiLCJNaWJEZXZpY2VWIiwiZGV2aWNlIiwidHlwZXMiLCJzdWJyb3V0aW5lcyIsImdldEJhc2VUeXBlIiwic3VwZXJUeXBlIiwiZGVmaW5lTWliUHJvcGVydHkiLCJ0YXJnZXQiLCJrZXkiLCJwcm9wIiwicHJvcGVydHlLZXkiLCJSZWZsZWN0IiwiZGVmaW5lTWV0YWRhdGEiLCJzaW1wbGVUeXBlIiwiY29udmVydGVycyIsImlzUmVhZGFibGUiLCJpbmRleE9mIiwiaXNXcml0YWJsZSIsImluZm8iLCJzaXplIiwicHVzaCIsIk9iamVjdCIsImVudHJpZXMiLCJtYXAiLCJwZXJjZW50Q29udmVydGVyIiwiZml4ZWRQb2ludE51bWJlcjRDb252ZXJ0ZXIiLCJ2ZXJzaW9uVHlwZUNvbnZlcnRlciIsImJvb2xlYW5Db252ZXJ0ZXIiLCJuYW1lIiwiYXR0cmlidXRlcyIsImVudW1lcmFibGUiLCJ0byIsImZyb20iLCJnZXQiLCJjb25zb2xlIiwiYXNzZXJ0IiwidmFsdWUiLCJnZXRFcnJvciIsImdldFJhd1ZhbHVlIiwic2V0IiwibmV3VmFsdWUiLCJ1bmRlZmluZWQiLCJFcnJvciIsIkpTT04iLCJzdHJpbmdpZnkiLCJzZXRSYXdWYWx1ZSIsImRlZmluZVByb3BlcnR5IiwiZ2V0TWliRmlsZSIsIm1pYm5hbWUiLCJwYXRoIiwicmVzb2x2ZSIsIl9fZGlybmFtZSIsIkRldmljZVByb3RvdHlwZSIsIkV2ZW50RW1pdHRlciIsImNvbnN0cnVjdG9yIiwibWliZmlsZSIsIm1pYlZhbGlkYXRpb24iLCJkZWNvZGUiLCJyZXF1aXJlIiwiaXNMZWZ0IiwiUGF0aFJlcG9ydGVyIiwicmVwb3J0IiwibWliIiwiZXJyb3JUeXBlIiwibWV0YXN1YnMiLCJfIiwidHJhbnNmb3JtIiwicmVzdWx0Iiwic3ViIiwiZGVzY3JpcHRpb24iLCJhcmdzIiwiZGVzYyIsImtleXMiLCJvd25LZXlzIiwidmFsaWRKc05hbWUiLCJmb3JFYWNoIiwicHJvcE5hbWUiLCJjb25uZWN0aW9uIiwidmFsdWVzIiwicHJldiIsImVtaXQiLCJ0b0pTT04iLCJqc29uIiwiZ2V0TWV0YWRhdGEiLCJhZGRyZXNzIiwidG9TdHJpbmciLCJnZXRJZCIsImlkT3JOYW1lIiwiaXNJbnRlZ2VyIiwiaGFzIiwiZ2V0TmFtZSIsImluY2x1ZGVzIiwiaXNEaXJ0eSIsImVycm9ycyIsInNldERpcnR5Iiwic2V0RXJyb3IiLCJlcnJvciIsImRpcnRpZXMiLCJuYW1lcyIsImFkZHJlZiIsIiRjb3VudFJlZiIsInN0YWNrIiwicmVsZWFzZSIsImRldmljZXMiLCJkcmFpbiIsImlkcyIsImZpbHRlciIsImxlbmd0aCIsIndyaXRlIiwiY2F0Y2giLCJQcm9taXNlIiwid3JpdGVBbGwiLCJyZWplY3QiLCJqb2luIiwicmVxdWVzdHMiLCJyZWR1Y2UiLCJhY2MiLCJhbGwiLCJkYXRhZ3JhbSIsInNlbmREYXRhZ3JhbSIsInRoZW4iLCJzdGF0dXMiLCJOaWJ1c0Vycm9yIiwicmVhc29uIiwid3JpdGVWYWx1ZXMiLCJzb3VyY2UiLCJzdHJvbmciLCJUeXBlRXJyb3IiLCJhc3NpZ24iLCJ3cml0dGVuIiwiZXJyIiwicmVhZEFsbCIsInJlYWQiLCJkaXNhYmxlQmF0Y2hSZWFkaW5nIiwiY2h1bmtzIiwiY2h1bmsiLCJwcm9taXNlIiwiZGF0YWdyYW1zIiwiQXJyYXkiLCJpc0FycmF5IiwibWVzc2FnZSIsInVwbG9hZCIsImRvbWFpbiIsIm9mZnNldCIsInJlcVVwbG9hZCIsInBhZEVuZCIsImRvbWFpblNpemUiLCJpbml0VXBsb2FkIiwiaW5pdFN0YXQiLCJ0b3RhbCIsInJlc3QiLCJwb3MiLCJidWZzIiwiTWF0aCIsIm1pbiIsInVwbG9hZFNlZ21lbnQiLCJ1cGxvYWRTdGF0dXMiLCJkYXRhIiwiQnVmZmVyIiwiY29uY2F0IiwiZSIsImRvd25sb2FkIiwiYnVmZmVyIiwibm9UZXJtIiwicmVxRG93bmxvYWQiLCJtYXgiLCJ0ZXJtaW5hdGUiLCJ0ZXJtU3RhdCIsInJlcSIsInJlcyIsImluaXREb3dubG9hZCIsImNyYyIsImNodW5rU2l6ZSIsIk5NU19NQVhfREFUQV9MRU5HVEgiLCJpIiwic2VnbWVudERvd25sb2FkIiwiZG93bmxvYWRTdGF0IiwidmVyaWZ5IiwidmVyaWZ5U3RhdCIsImV4ZWN1dGUiLCJwcm9ncmFtIiwic3Vicm91dGluZSIsInByb3BzIiwiYXJnIiwibm90UmVwbHkiLCJmaW5kTWliQnlUeXBlIiwidmVyc2lvbiIsImNvbmYiLCJjb25maWdEaXIiLCJ2YWxpZGF0ZSIsIkNvbmZpZ1YiLCJtaWJUeXBlcyIsIm1pYnMiLCJtaWJUeXBlIiwiZmluZExhc3QiLCJtaW5WZXJzaW9uIiwiZ2V0Q29uc3RydWN0b3IiLCJEZXZpY2UiLCJhcHBseSIsInByb3RvdHlwZSIsImNyZWF0ZSIsImdldE1pYlByb3RvdHlwZSIsIkRldmljZXMiLCJ0YXJnZXRBZGRyZXNzIiwiQWRkcmVzcyIsIm1pYk9yVHlwZSIsIlN0cmluZyIsImNvbnN0cnVjdCIsImlzRW1wdHkiLCJwcm9jZXNzIiwibmV4dFRpY2siXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBV0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBRUE7O0FBQ0E7O0FBZ0JBOztBQUNBOztBQW9CQTs7Ozs7Ozs7QUFDQTtBQUNBO0FBRUEsTUFBTUEsT0FBTyxHQUFHLGdCQUFoQixDLENBQWtDOztBQUVsQyxNQUFNQyxLQUFLLEdBQUcsb0JBQWEsZUFBYixDQUFkO0FBRUEsTUFBTUMsT0FBTyxHQUFHQyxNQUFNLENBQUMsUUFBRCxDQUF0QjtBQUNBLE1BQU1DLE9BQU8sR0FBR0QsTUFBTSxDQUFDLFFBQUQsQ0FBdEI7QUFDQSxNQUFNRSxRQUFRLEdBQUdGLE1BQU0sQ0FBQyxTQUFELENBQXZCOztBQUVBLFNBQVNHLFVBQVQsQ0FBb0JDLEdBQXBCLEVBQThCO0FBQzVCLFFBQU1DLEdBQUcsR0FBR0MsVUFBVSxDQUFDRixHQUFELENBQXRCO0FBQ0EsU0FBUUcsTUFBTSxDQUFDQyxLQUFQLENBQWFILEdBQWIsS0FBc0IsR0FBRUEsR0FBSSxFQUFQLEtBQWFELEdBQW5DLEdBQTBDQSxHQUExQyxHQUFnREMsR0FBdkQ7QUFDRDs7SUFFSUksWTs7V0FBQUEsWTtBQUFBQSxFQUFBQSxZLENBQUFBLFk7R0FBQUEsWSxLQUFBQSxZOztBQUlMLE1BQU1DLFNBQWlELEdBQUcsRUFBMUQ7QUFFQSxNQUFNQyxhQUE4QyxHQUFHLEVBQXZEO0FBRUEsTUFBTUMsbUJBQW1CLEdBQUdDLENBQUMsQ0FBQ0MsWUFBRixDQUFlLENBQ3pDRCxDQUFDLENBQUNFLElBQUYsQ0FBTztBQUNMQyxFQUFBQSxNQUFN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TUFBTSxLQUFLbEksSUFBTCxDQUFVLEtBQVYsRUFBaUIvRSxNQUFqQixDQUF2QjtBQUNEOztBQUNELFdBQU9BLE1BQVA7QUFDRDs7QUF0Q2dDOztBQXlDbkMsTUFBTXNHLE9BQU8sR0FBRyxJQUFJbUcsT0FBSixFQUFoQjtlQUVlbkcsTyIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IChjKSAyMDE5LiBPT08gTmF0YS1JbmZvXG4gKiBAYXV0aG9yIEFuZHJlaSBTYXJha2VldiA8YXZzQG5hdGEtaW5mby5ydT5cbiAqXG4gKiBUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgXCJAbmF0YVwiIHByb2plY3QuXG4gKiBGb3IgdGhlIGZ1bGwgY29weXJpZ2h0IGFuZCBsaWNlbnNlIGluZm9ybWF0aW9uLCBwbGVhc2Ugdmlld1xuICogdGhlIEVVTEEgZmlsZSB0aGF0IHdhcyBkaXN0cmlidXRlZCB3aXRoIHRoaXMgc291cmNlIGNvZGUuXG4gKi9cblxuLyogdHNsaW50OmRpc2FibGU6dmFyaWFibGUtbmFtZSAqL1xuaW1wb3J0IHsgY3JjMTZjY2l0dCB9IGZyb20gJ2NyYyc7XG5pbXBvcnQgZGVidWdGYWN0b3J5IGZyb20gJ2RlYnVnJztcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgKiBhcyB0IGZyb20gJ2lvLXRzJztcbmltcG9ydCB7IFBhdGhSZXBvcnRlciB9IGZyb20gJ2lvLXRzL2xpYi9QYXRoUmVwb3J0ZXInO1xuaW1wb3J0IF8gZnJvbSAnbG9kYXNoJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICdyZWZsZWN0LW1ldGFkYXRhJztcbmltcG9ydCB7IGNvbmZpZyBhcyBjb25maWdEaXIgfSBmcm9tICd4ZGctYmFzZWRpcic7XG5pbXBvcnQgQWRkcmVzcywgeyBBZGRyZXNzUGFyYW0gfSBmcm9tICcuLi9BZGRyZXNzJztcbmltcG9ydCB7IE5pYnVzRXJyb3IgfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IHsgTk1TX01BWF9EQVRBX0xFTkdUSCB9IGZyb20gJy4uL25iY29uc3QnO1xuaW1wb3J0IHsgTmlidXNDb25uZWN0aW9uIH0gZnJvbSAnLi4vbmlidXMnO1xuaW1wb3J0IHsgY2h1bmtBcnJheSB9IGZyb20gJy4uL25pYnVzL2hlbHBlcic7XG5pbXBvcnQge1xuICBjcmVhdGVFeGVjdXRlUHJvZ3JhbUludm9jYXRpb24sXG4gIGNyZWF0ZU5tc0Rvd25sb2FkU2VnbWVudCxcbiAgY3JlYXRlTm1zSW5pdGlhdGVEb3dubG9hZFNlcXVlbmNlLFxuICBjcmVhdGVObXNJbml0aWF0ZVVwbG9hZFNlcXVlbmNlLFxuICBjcmVhdGVObXNSZWFkLFxuICBjcmVhdGVObXNSZXF1ZXN0RG9tYWluRG93bmxvYWQsXG4gIGNyZWF0ZU5tc1JlcXVlc3REb21haW5VcGxvYWQsXG4gIGNyZWF0ZU5tc1Rlcm1pbmF0ZURvd25sb2FkU2VxdWVuY2UsXG4gIGNyZWF0ZU5tc1VwbG9hZFNlZ21lbnQsXG4gIGNyZWF0ZU5tc1ZlcmlmeURvbWFpbkNoZWNrc3VtLFxuICBjcmVhdGVObXNXcml0ZSxcbiAgZ2V0Tm1zVHlwZSwgVHlwZWRWYWx1ZSxcbn0gZnJvbSAnLi4vbm1zJztcbmltcG9ydCBObXNEYXRhZ3JhbSBmcm9tICcuLi9ubXMvTm1zRGF0YWdyYW0nO1xuaW1wb3J0IE5tc1ZhbHVlVHlwZSBmcm9tICcuLi9ubXMvTm1zVmFsdWVUeXBlJztcbmltcG9ydCB7IENvbmZpZ1YgfSBmcm9tICcuLi9zZXNzaW9uL2NvbW1vbic7XG5pbXBvcnQge1xuICBib29sZWFuQ29udmVydGVyLFxuICBjb252ZXJ0RnJvbSxcbiAgY29udmVydFRvLFxuICBlbnVtZXJhdGlvbkNvbnZlcnRlcixcbiAgZml4ZWRQb2ludE51bWJlcjRDb252ZXJ0ZXIsXG4gIGdldEludFNpemUsXG4gIElDb252ZXJ0ZXIsXG4gIG1heEluY2x1c2l2ZUNvbnZlcnRlcixcbiAgbWluSW5jbHVzaXZlQ29udmVydGVyLFxuICBwYWNrZWQ4ZmxvYXRDb252ZXJ0ZXIsXG4gIHBlcmNlbnRDb252ZXJ0ZXIsXG4gIHByZWNpc2lvbkNvbnZlcnRlcixcbiAgcmVwcmVzZW50YXRpb25Db252ZXJ0ZXIsXG4gIHRvSW50LFxuICB1bml0Q29udmVydGVyLFxuICB2YWxpZEpzTmFtZSxcbiAgdmVyc2lvblR5cGVDb252ZXJ0ZXIsXG4gIHdpdGhWYWx1ZSxcbn0gZnJvbSAnLi9taWInO1xuaW1wb3J0IHRpbWVpZCBmcm9tICcuLi90aW1laWQnO1xuLy8gaW1wb3J0IHsgZ2V0TWlic1N5bmMgfSBmcm9tICcuL21pYjJqc29uJztcbi8vIGltcG9ydCBkZXRlY3RvciBmcm9tICcuLi9zZXJ2aWNlL2RldGVjdG9yJztcblxuY29uc3QgcGtnTmFtZSA9ICdAbmF0YS9uaWJ1cy5qcyc7IC8vIHJlcXVpcmUoJy4uLy4uL3BhY2thZ2UuanNvbicpLm5hbWU7XG5cbmNvbnN0IGRlYnVnID0gZGVidWdGYWN0b3J5KCduaWJ1czpkZXZpY2VzJyk7XG5cbmNvbnN0ICR2YWx1ZXMgPSBTeW1ib2woJ3ZhbHVlcycpO1xuY29uc3QgJGVycm9ycyA9IFN5bWJvbCgnZXJyb3JzJyk7XG5jb25zdCAkZGlydGllcyA9IFN5bWJvbCgnZGlydGllcycpO1xuXG5mdW5jdGlvbiBzYWZlTnVtYmVyKHZhbDogYW55KSB7XG4gIGNvbnN0IG51bSA9IHBhcnNlRmxvYXQodmFsKTtcbiAgcmV0dXJuIChOdW1iZXIuaXNOYU4obnVtKSB8fCBgJHtudW19YCAhPT0gdmFsKSA/IHZhbCA6IG51bTtcbn1cblxuZW51bSBQcml2YXRlUHJvcHMge1xuICBjb25uZWN0aW9uID0gLTEsXG59XG5cbmNvbnN0IGRldmljZU1hcDogeyBbYWRkcmVzczogc3RyaW5nXTogRGV2aWNlUHJvdG90eXBlIH0gPSB7fTtcblxuY29uc3QgbWliVHlwZXNDYWNoZTogeyBbbWlibmFtZTogc3RyaW5nXTogRnVuY3Rpb24gfSA9IHt9O1xuXG5jb25zdCBNaWJQcm9wZXJ0eUFwcEluZm9WID0gdC5pbnRlcnNlY3Rpb24oW1xuICB0LnR5cGUoe1xuICAgIG5tc19pZDogdC51bmlvbihbdC5zdHJpbmcsIHQuSW50XSksXG4gICAgYWNjZXNzOiB0LnN0cmluZyxcbiAgfSksXG4gIHQucGFydGlhbCh7XG4gICAgY2F0ZWdvcnk6IHQuc3RyaW5nLFxuICB9KSxcbl0pO1xuXG4vLyBpbnRlcmZhY2UgSU1pYlByb3BlcnR5QXBwSW5mbyBleHRlbmRzIHQuVHlwZU9mPHR5cGVvZiBNaWJQcm9wZXJ0eUFwcEluZm9WPiB7fVxuXG5jb25zdCBNaWJQcm9wZXJ0eVYgPSB0LnR5cGUoe1xuICB0eXBlOiB0LnN0cmluZyxcbiAgYW5ub3RhdGlvbjogdC5zdHJpbmcsXG4gIGFwcGluZm86IE1pYlByb3BlcnR5QXBwSW5mb1YsXG59KTtcblxuaW50ZXJmYWNlIElNaWJQcm9wZXJ0eSBleHRlbmRzIHQuVHlwZU9mPHR5cGVvZiBNaWJQcm9wZXJ0eVY+IHtcbiAgLy8gYXBwaW5mbzogSU1pYlByb3BlcnR5QXBwSW5mbztcbn1cblxuY29uc3QgTWliRGV2aWNlQXBwSW5mb1YgPSB0LmludGVyc2VjdGlvbihbXG4gIHQudHlwZSh7XG4gICAgbWliX3ZlcnNpb246IHQuc3RyaW5nLFxuICB9KSxcbiAgdC5wYXJ0aWFsKHtcbiAgICBkZXZpY2VfdHlwZTogdC5zdHJpbmcsXG4gICAgbG9hZGVyX3R5cGU6IHQuc3RyaW5nLFxuICAgIGZpcm13YXJlOiB0LnN0cmluZyxcbiAgICBtaW5fdmVyc2lvbjogdC5zdHJpbmcsXG4gIH0pLFxuXSk7XG5cbmNvbnN0IE1pYkRldmljZVR5cGVWID0gdC50eXBlKHtcbiAgYW5ub3RhdGlvbjogdC5zdHJpbmcsXG4gIGFwcGluZm86IE1pYkRldmljZUFwcEluZm9WLFxuICBwcm9wZXJ0aWVzOiB0LnJlY29yZCh0LnN0cmluZywgTWliUHJvcGVydHlWKSxcbn0pO1xuXG5leHBvcnQgaW50ZXJmYWNlIElNaWJEZXZpY2VUeXBlIGV4dGVuZHMgdC5UeXBlT2Y8dHlwZW9mIE1pYkRldmljZVR5cGVWPiB7fVxuXG5jb25zdCBNaWJUeXBlViA9IHQuaW50ZXJzZWN0aW9uKFtcbiAgdC50eXBlKHtcbiAgICBiYXNlOiB0LnN0cmluZyxcbiAgfSksXG4gIHQucGFydGlhbCh7XG4gICAgYXBwaW5mbzogdC5wYXJ0aWFsKHtcbiAgICAgIHplcm86IHQuc3RyaW5nLFxuICAgICAgdW5pdHM6IHQuc3RyaW5nLFxuICAgICAgcHJlY2lzaW9uOiB0LnN0cmluZyxcbiAgICAgIHJlcHJlc2VudGF0aW9uOiB0LnN0cmluZyxcbiAgICB9KSxcbiAgICBtaW5JbmNsdXNpdmU6IHQuc3RyaW5nLFxuICAgIG1heEluY2x1c2l2ZTogdC5zdHJpbmcsXG4gICAgZW51bWVyYXRpb246IHQucmVjb3JkKHQuc3RyaW5nLCB0LnR5cGUoeyBhbm5vdGF0aW9uOiB0LnN0cmluZyB9KSksXG4gIH0pLFxuXSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU1pYlR5cGUgZXh0ZW5kcyB0LlR5cGVPZjx0eXBlb2YgTWliVHlwZVY+IHt9XG5cbmNvbnN0IE1pYlN1YnJvdXRpbmVWID0gdC5pbnRlcnNlY3Rpb24oW1xuICB0LnR5cGUoe1xuICAgIGFubm90YXRpb246IHQuc3RyaW5nLFxuICAgIGFwcGluZm86IHQuaW50ZXJzZWN0aW9uKFtcbiAgICAgIHQudHlwZSh7IG5tc19pZDogdC51bmlvbihbdC5zdHJpbmcsIHQuSW50XSkgfSksXG4gICAgICB0LnBhcnRpYWwoeyByZXNwb25zZTogdC5zdHJpbmcgfSksXG4gICAgXSksXG4gIH0pLFxuICB0LnBhcnRpYWwoe1xuICAgIHByb3BlcnRpZXM6IHQucmVjb3JkKHQuc3RyaW5nLCB0LnR5cGUoe1xuICAgICAgdHlwZTogdC5zdHJpbmcsXG4gICAgICBhbm5vdGF0aW9uOiB0LnN0cmluZyxcbiAgICB9KSksXG4gIH0pLFxuXSk7XG5cbmNvbnN0IFN1YnJvdXRpbmVUeXBlViA9IHQudHlwZSh7XG4gIGFubm90YXRpb246IHQuc3RyaW5nLFxuICBwcm9wZXJ0aWVzOiB0LnR5cGUoe1xuICAgIGlkOiB0LnR5cGUoe1xuICAgICAgdHlwZTogdC5saXRlcmFsKCd4czp1bnNpZ25lZFNob3J0JyksXG4gICAgICBhbm5vdGF0aW9uOiB0LnN0cmluZyxcbiAgICB9KSxcbiAgfSksXG59KTtcblxuZXhwb3J0IGNvbnN0IE1pYkRldmljZVYgPSB0LmludGVyc2VjdGlvbihbXG4gIHQudHlwZSh7XG4gICAgZGV2aWNlOiB0LnN0cmluZyxcbiAgICB0eXBlczogdC5yZWNvcmQodC5zdHJpbmcsIHQudW5pb24oW01pYkRldmljZVR5cGVWLCBNaWJUeXBlViwgU3Vicm91dGluZVR5cGVWXSkpLFxuICB9KSxcbiAgdC5wYXJ0aWFsKHtcbiAgICBzdWJyb3V0aW5lczogdC5yZWNvcmQodC5zdHJpbmcsIE1pYlN1YnJvdXRpbmVWKSxcbiAgfSksXG5dKTtcblxuaW50ZXJmYWNlIElNaWJEZXZpY2UgZXh0ZW5kcyB0LlR5cGVPZjx0eXBlb2YgTWliRGV2aWNlVj4ge31cblxudHlwZSBMaXN0ZW5lcjxUPiA9IChhcmc6IFQpID0+IHZvaWQ7XG50eXBlIENoYW5nZUFyZyA9IHsgaWQ6IG51bWJlciwgbmFtZXM6IHN0cmluZ1tdIH07XG5leHBvcnQgdHlwZSBDaGFuZ2VMaXN0ZW5lciA9IExpc3RlbmVyPENoYW5nZUFyZz47XG50eXBlIFVwbG9hZFN0YXJ0QXJnID0geyBkb21haW46IHN0cmluZywgZG9tYWluU2l6ZTogbnVtYmVyLCBvZmZzZXQ6IG51bWJlciwgc2l6ZTogbnVtYmVyIH07XG5leHBvcnQgdHlwZSBVcGxvYWRTdGFydExpc3RlbmVyID0gTGlzdGVuZXI8VXBsb2FkU3RhcnRBcmc+O1xudHlwZSBVcGxvYWREYXRhQXJnID0geyBkb21haW46IHN0cmluZywgZGF0YTogQnVmZmVyLCBwb3M6IG51bWJlciB9O1xuZXhwb3J0IHR5cGUgVXBsb2FkRGF0YUxpc3RlbmVyID0gTGlzdGVuZXI8VXBsb2FkRGF0YUFyZz47XG50eXBlIFVwbG9hZEZpbmlzaEFyZyA9IHsgZG9tYWluOiBzdHJpbmcsIG9mZnNldDogbnVtYmVyLCBkYXRhOiBCdWZmZXIgfTtcbmV4cG9ydCB0eXBlIFVwbG9hZEZpbmlzaExpc3RlbmVyID0gTGlzdGVuZXI8VXBsb2FkRmluaXNoQXJnPjtcbnR5cGUgRG93bmxvYWRTdGFydEFyZyA9IHsgZG9tYWluOiBzdHJpbmcsIGRvbWFpblNpemU6IG51bWJlciwgb2Zmc2V0OiBudW1iZXIsIHNpemU6IG51bWJlciB9O1xuZXhwb3J0IHR5cGUgRG93bmxvYWRTdGFydExpc3RlbmVyID0gTGlzdGVuZXI8RG93bmxvYWRTdGFydEFyZz47XG50eXBlIERvd25sb2FkRGF0YUFyZyA9IHsgZG9tYWluOiBzdHJpbmcsIGxlbmd0aDogbnVtYmVyIH07XG5leHBvcnQgdHlwZSBEb3dubG9hZERhdGFMaXN0ZW5lciA9IExpc3RlbmVyPERvd25sb2FkRGF0YUFyZz47XG50eXBlIERvd25sb2FkRmluaXNoQXJnID0geyBkb21haW46IHN0cmluZzsgb2Zmc2V0OiBudW1iZXIsIHNpemU6IG51bWJlciB9O1xuZXhwb3J0IHR5cGUgRG93bmxvYWRGaW5pc2hMaXN0ZW5lciA9IExpc3RlbmVyPERvd25sb2FkRmluaXNoQXJnPjtcblxuZXhwb3J0IGludGVyZmFjZSBJRGV2aWNlIHtcbiAgcmVhZG9ubHkgaWQ6IHN0cmluZztcbiAgcmVhZG9ubHkgYWRkcmVzczogQWRkcmVzcztcbiAgZHJhaW4oKTogUHJvbWlzZTxudW1iZXJbXT47XG4gIHdyaXRlKC4uLmlkczogbnVtYmVyW10pOiBQcm9taXNlPG51bWJlcltdPjtcbiAgcmVhZCguLi5pZHM6IG51bWJlcltdKTogUHJvbWlzZTx7IFtuYW1lOiBzdHJpbmddOiBhbnkgfT47XG4gIHVwbG9hZChkb21haW46IHN0cmluZywgb2Zmc2V0PzogbnVtYmVyLCBzaXplPzogbnVtYmVyKTogUHJvbWlzZTxVaW50OEFycmF5PjtcbiAgZG93bmxvYWQoZG9tYWluOiBzdHJpbmcsIGRhdGE6IEJ1ZmZlciwgb2Zmc2V0PzogbnVtYmVyLCBub1Rlcm0/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPjtcbiAgZXhlY3V0ZShcbiAgICBwcm9ncmFtOiBzdHJpbmcsXG4gICAgYXJncz86IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPE5tc0RhdGFncmFtIHwgTm1zRGF0YWdyYW1bXSB8IHVuZGVmaW5lZD47XG4gIGNvbm5lY3Rpb24/OiBOaWJ1c0Nvbm5lY3Rpb247XG4gIHJlbGVhc2UoKTogbnVtYmVyO1xuICBnZXRJZChpZE9yTmFtZTogc3RyaW5nIHwgbnVtYmVyKTogbnVtYmVyO1xuICBnZXROYW1lKGlkT3JOYW1lOiBzdHJpbmcgfCBudW1iZXIpOiBzdHJpbmc7XG4gIGdldFJhd1ZhbHVlKGlkT3JOYW1lOiBudW1iZXIgfCBzdHJpbmcpOiBhbnk7XG4gIGdldEVycm9yKGlkT3JOYW1lOiBudW1iZXIgfCBzdHJpbmcpOiBhbnk7XG4gIFttaWJQcm9wZXJ0eTogc3RyaW5nXTogYW55O1xuXG4gIG9uKGV2ZW50OiAnY29ubmVjdGVkJyB8ICdkaXNjb25uZWN0ZWQnLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCk6IHRoaXM7XG4gIG9uKGV2ZW50OiAnY2hhbmdpbmcnIHwgJ2NoYW5nZWQnLCBsaXN0ZW5lcjogQ2hhbmdlTGlzdGVuZXIpOiB0aGlzO1xuICBvbihldmVudDogJ3VwbG9hZFN0YXJ0JywgbGlzdGVuZXI6IFVwbG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBvbihldmVudDogJ3VwbG9hZERhdGEnLCBsaXN0ZW5lcjogVXBsb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgb24oZXZlbnQ6ICd1cGxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogVXBsb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuICBvbihldmVudDogJ2Rvd25sb2FkU3RhcnQnLCBsaXN0ZW5lcjogRG93bmxvYWRTdGFydExpc3RlbmVyKTogdGhpcztcbiAgb24oZXZlbnQ6ICdkb3dubG9hZERhdGEnLCBsaXN0ZW5lcjogRG93bmxvYWREYXRhTGlzdGVuZXIpOiB0aGlzO1xuICBvbihldmVudDogJ2Rvd25sb2FkRmluaXNoJywgbGlzdGVuZXI6IERvd25sb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuXG4gIG9uY2UoZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcsIGxpc3RlbmVyOiAoKSA9PiB2b2lkKTogdGhpcztcbiAgb25jZShldmVudDogJ2NoYW5naW5nJyB8ICdjaGFuZ2VkJywgbGlzdGVuZXI6IENoYW5nZUxpc3RlbmVyKTogdGhpcztcbiAgb25jZShldmVudDogJ3VwbG9hZFN0YXJ0JywgbGlzdGVuZXI6IFVwbG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAndXBsb2FkRGF0YScsIGxpc3RlbmVyOiBVcGxvYWREYXRhTGlzdGVuZXIpOiB0aGlzO1xuICBvbmNlKGV2ZW50OiAndXBsb2FkRmluaXNoJywgbGlzdGVuZXI6IFVwbG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcbiAgb25jZShldmVudDogJ2Rvd25sb2FkU3RhcnQnLCBsaXN0ZW5lcjogRG93bmxvYWRTdGFydExpc3RlbmVyKTogdGhpcztcbiAgb25jZShldmVudDogJ2Rvd25sb2FkRGF0YScsIGxpc3RlbmVyOiBEb3dubG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICdkb3dubG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBEb3dubG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcblxuICBhZGRMaXN0ZW5lcihldmVudDogJ2Nvbm5lY3RlZCcgfCAnZGlzY29ubmVjdGVkJywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB0aGlzO1xuICBhZGRMaXN0ZW5lcihldmVudDogJ2NoYW5naW5nJyB8ICdjaGFuZ2VkJywgbGlzdGVuZXI6IENoYW5nZUxpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICd1cGxvYWRTdGFydCcsIGxpc3RlbmVyOiBVcGxvYWRTdGFydExpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICd1cGxvYWREYXRhJywgbGlzdGVuZXI6IFVwbG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIGFkZExpc3RlbmVyKGV2ZW50OiAndXBsb2FkRmluaXNoJywgbGlzdGVuZXI6IFVwbG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICdkb3dubG9hZFN0YXJ0JywgbGlzdGVuZXI6IERvd25sb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIGFkZExpc3RlbmVyKGV2ZW50OiAnZG93bmxvYWREYXRhJywgbGlzdGVuZXI6IERvd25sb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICdkb3dubG9hZEZpbmlzaCcsIGxpc3RlbmVyOiBEb3dubG9hZEZpbmlzaExpc3RlbmVyKTogdGhpcztcblxuICBvZmYoZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcsIGxpc3RlbmVyOiAoKSA9PiB2b2lkKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAnY2hhbmdpbmcnIHwgJ2NoYW5nZWQnLCBsaXN0ZW5lcjogQ2hhbmdlTGlzdGVuZXIpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICd1cGxvYWRTdGFydCcsIGxpc3RlbmVyOiBVcGxvYWRTdGFydExpc3RlbmVyKTogdGhpcztcbiAgb2ZmKGV2ZW50OiAndXBsb2FkRGF0YScsIGxpc3RlbmVyOiBVcGxvYWREYXRhTGlzdGVuZXIpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICd1cGxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogVXBsb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuICBvZmYoZXZlbnQ6ICdkb3dubG9hZFN0YXJ0JywgbGlzdGVuZXI6IERvd25sb2FkU3RhcnRMaXN0ZW5lcik6IHRoaXM7XG4gIG9mZihldmVudDogJ2Rvd25sb2FkRGF0YScsIGxpc3RlbmVyOiBEb3dubG9hZERhdGFMaXN0ZW5lcik6IHRoaXM7XG4gIG9mZihldmVudDogJ2Rvd25sb2FkRmluaXNoJywgbGlzdGVuZXI6IERvd25sb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuXG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAnY29ubmVjdGVkJyB8ICdkaXNjb25uZWN0ZWQnLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCk6IHRoaXM7XG4gIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiAnY2hhbmdpbmcnIHwgJ2NoYW5nZWQnLCBsaXN0ZW5lcjogQ2hhbmdlTGlzdGVuZXIpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ3VwbG9hZFN0YXJ0JywgbGlzdGVuZXI6IFVwbG9hZFN0YXJ0TGlzdGVuZXIpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ3VwbG9hZERhdGEnLCBsaXN0ZW5lcjogVXBsb2FkRGF0YUxpc3RlbmVyKTogdGhpcztcbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnQ6ICd1cGxvYWRGaW5pc2gnLCBsaXN0ZW5lcjogVXBsb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ2Rvd25sb2FkU3RhcnQnLCBsaXN0ZW5lcjogRG93bmxvYWRTdGFydExpc3RlbmVyKTogdGhpcztcbiAgcmVtb3ZlTGlzdGVuZXIoZXZlbnQ6ICdkb3dubG9hZERhdGEnLCBsaXN0ZW5lcjogRG93bmxvYWREYXRhTGlzdGVuZXIpOiB0aGlzO1xuICByZW1vdmVMaXN0ZW5lcihldmVudDogJ2Rvd25sb2FkRmluaXNoJywgbGlzdGVuZXI6IERvd25sb2FkRmluaXNoTGlzdGVuZXIpOiB0aGlzO1xuXG4gIGVtaXQoZXZlbnQ6ICdjb25uZWN0ZWQnIHwgJ2Rpc2Nvbm5lY3RlZCcpOiBib29sZWFuO1xuICBlbWl0KGV2ZW50OiAnY2hhbmdpbmcnIHwgJ2NoYW5nZWQnLCBhcmc6IENoYW5nZUFyZyk6IGJvb2xlYW47XG4gIGVtaXQoZXZlbnQ6ICd1cGxvYWRTdGFydCcsIGFyZzogVXBsb2FkU3RhcnRBcmcpOiBib29sZWFuO1xuICBlbWl0KGV2ZW50OiAndXBsb2FkRGF0YScsIGFyZzogVXBsb2FkRGF0YUFyZyk6IGJvb2xlYW47XG4gIGVtaXQoZXZlbnQ6ICd1cGxvYWRGaW5pc2gnLCBhcmc6IFVwbG9hZEZpbmlzaEFyZyk6IGJvb2xlYW47XG4gIGVtaXQoZXZlbnQ6ICdkb3dubG9hZFN0YXJ0JywgYXJnOiBEb3dubG9hZFN0YXJ0QXJnKTogYm9vbGVhbjtcbiAgZW1pdChldmVudDogJ2Rvd25sb2FkRGF0YScsIGFyZzogRG93bmxvYWREYXRhQXJnKTogYm9vbGVhbjtcbiAgZW1pdChldmVudDogJ2Rvd25sb2FkRmluaXNoJywgYXJnOiBEb3dubG9hZEZpbmlzaEFyZyk6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBJU3Vicm91dGluZURlc2Mge1xuICBpZDogbnVtYmVyO1xuICAvLyBuYW1lOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gIG5vdFJlcGx5PzogYm9vbGVhbjtcbiAgYXJncz86IHsgbmFtZTogc3RyaW5nLCB0eXBlOiBObXNWYWx1ZVR5cGUsIGRlc2M/OiBzdHJpbmcgfVtdO1xufVxuXG5pbnRlcmZhY2UgSVByb3BlcnR5RGVzY3JpcHRvcjxPd25lcj4ge1xuICBjb25maWd1cmFibGU/OiBib29sZWFuO1xuICBlbnVtZXJhYmxlPzogYm9vbGVhbjtcbiAgdmFsdWU/OiBhbnk7XG4gIHdyaXRhYmxlPzogYm9vbGVhbjtcblxuICBnZXQ/KHRoaXM6IE93bmVyKTogYW55O1xuXG4gIHNldD8odGhpczogT3duZXIsIHY6IGFueSk6IHZvaWQ7XG59XG5cbmZ1bmN0aW9uIGdldEJhc2VUeXBlKHR5cGVzOiBJTWliRGV2aWNlWyd0eXBlcyddLCB0eXBlOiBzdHJpbmcpOiBzdHJpbmcge1xuICBsZXQgYmFzZSA9IHR5cGU7XG4gIGZvciAobGV0IHN1cGVyVHlwZTogSU1pYlR5cGUgPSB0eXBlc1tiYXNlXSBhcyBJTWliVHlwZTsgc3VwZXJUeXBlICE9IG51bGw7XG4gICAgICAgc3VwZXJUeXBlID0gdHlwZXNbc3VwZXJUeXBlLmJhc2VdIGFzIElNaWJUeXBlKSB7XG4gICAgYmFzZSA9IHN1cGVyVHlwZS5iYXNlO1xuICB9XG4gIHJldHVybiBiYXNlO1xufVxuXG5mdW5jdGlvbiBkZWZpbmVNaWJQcm9wZXJ0eShcbiAgdGFyZ2V0OiBEZXZpY2VQcm90b3R5cGUsXG4gIGtleTogc3RyaW5nLFxuICB0eXBlczogSU1pYkRldmljZVsndHlwZXMnXSxcbiAgcHJvcDogSU1pYlByb3BlcnR5KTogW251bWJlciwgc3RyaW5nXSB7XG4gIGNvbnN0IHByb3BlcnR5S2V5ID0gdmFsaWRKc05hbWUoa2V5KTtcbiAgY29uc3QgeyBhcHBpbmZvIH0gPSBwcm9wO1xuICBjb25zdCBpZCA9IHRvSW50KGFwcGluZm8ubm1zX2lkKTtcbiAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnaWQnLCBpZCwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIGNvbnN0IHNpbXBsZVR5cGUgPSBnZXRCYXNlVHlwZSh0eXBlcywgcHJvcC50eXBlKTtcbiAgY29uc3QgdHlwZSA9IHR5cGVzW3Byb3AudHlwZV0gYXMgSU1pYlR5cGU7XG4gIGNvbnN0IGNvbnZlcnRlcnM6IElDb252ZXJ0ZXJbXSA9IFtdO1xuICBjb25zdCBpc1JlYWRhYmxlID0gYXBwaW5mby5hY2Nlc3MuaW5kZXhPZigncicpID4gLTE7XG4gIGNvbnN0IGlzV3JpdGFibGUgPSBhcHBpbmZvLmFjY2Vzcy5pbmRleE9mKCd3JykgPiAtMTtcbiAgbGV0IGVudW1lcmF0aW9uOiBJTWliVHlwZVsnZW51bWVyYXRpb24nXSB8IHVuZGVmaW5lZDtcbiAgaWYgKHR5cGUgIT0gbnVsbCkge1xuICAgIGNvbnN0IHsgYXBwaW5mbzogaW5mbyA9IHt9LCBtaW5JbmNsdXNpdmUsIG1heEluY2x1c2l2ZSB9ID0gdHlwZTtcbiAgICBlbnVtZXJhdGlvbiA9IHR5cGUuZW51bWVyYXRpb247XG4gICAgY29uc3QgeyB1bml0cywgcHJlY2lzaW9uLCByZXByZXNlbnRhdGlvbiB9ID0gaW5mbztcbiAgICBjb25zdCBzaXplID0gZ2V0SW50U2l6ZShzaW1wbGVUeXBlKTtcbiAgICBpZiAodW5pdHMpIHtcbiAgICAgIGNvbnZlcnRlcnMucHVzaCh1bml0Q29udmVydGVyKHVuaXRzKSk7XG4gICAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCd1bml0JywgdW5pdHMsIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICAgIH1cbiAgICBwcmVjaXNpb24gJiYgY29udmVydGVycy5wdXNoKHByZWNpc2lvbkNvbnZlcnRlcihwcmVjaXNpb24pKTtcbiAgICBpZiAoZW51bWVyYXRpb24pIHtcbiAgICAgIGNvbnZlcnRlcnMucHVzaChlbnVtZXJhdGlvbkNvbnZlcnRlcihlbnVtZXJhdGlvbiwgc2ltcGxlVHlwZSkpO1xuICAgICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnZW51bScsIE9iamVjdC5lbnRyaWVzKGVudW1lcmF0aW9uKVxuICAgICAgICAubWFwKChba2V5LCB2YWxdKSA9PiBbXG4gICAgICAgICAgdmFsIS5hbm5vdGF0aW9uLFxuICAgICAgICAgIHRvSW50KGtleSksXG4gICAgICAgIF0pLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgICB9XG4gICAgcmVwcmVzZW50YXRpb24gJiYgc2l6ZSAmJiBjb252ZXJ0ZXJzLnB1c2gocmVwcmVzZW50YXRpb25Db252ZXJ0ZXIocmVwcmVzZW50YXRpb24sIHNpemUpKTtcbiAgICBpZiAobWluSW5jbHVzaXZlKSB7XG4gICAgICBjb252ZXJ0ZXJzLnB1c2gobWluSW5jbHVzaXZlQ29udmVydGVyKG1pbkluY2x1c2l2ZSkpO1xuICAgICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWluJywgbWluSW5jbHVzaXZlLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgICB9XG4gICAgaWYgKG1heEluY2x1c2l2ZSkge1xuICAgICAgY29udmVydGVycy5wdXNoKG1heEluY2x1c2l2ZUNvbnZlcnRlcihtYXhJbmNsdXNpdmUpKTtcbiAgICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ21heCcsIG1heEluY2x1c2l2ZSwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gICAgfVxuICB9XG4gIGlmIChrZXkgPT09ICdicmlnaHRuZXNzJyAmJiBwcm9wLnR5cGUgPT09ICd4czp1bnNpZ25lZEJ5dGUnKSB7XG4gICAgY29udmVydGVycy5wdXNoKHBlcmNlbnRDb252ZXJ0ZXIpO1xuICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ3VuaXQnLCAnJScsIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ21pbicsIDAsIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ21heCcsIDEwMCwgdGFyZ2V0LCBwcm9wZXJ0eUtleSk7XG4gIH1cbiAgc3dpdGNoIChzaW1wbGVUeXBlKSB7XG4gICAgY2FzZSAncGFja2VkOEZsb2F0JzpcbiAgICAgIGNvbnZlcnRlcnMucHVzaChwYWNrZWQ4ZmxvYXRDb252ZXJ0ZXIodHlwZSkpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnZml4ZWRQb2ludE51bWJlcjQnOlxuICAgICAgY29udmVydGVycy5wdXNoKGZpeGVkUG9pbnROdW1iZXI0Q29udmVydGVyKTtcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICBicmVhaztcbiAgfVxuICBpZiAocHJvcC50eXBlID09PSAndmVyc2lvblR5cGUnKSB7XG4gICAgY29udmVydGVycy5wdXNoKHZlcnNpb25UeXBlQ29udmVydGVyKTtcbiAgfVxuICBpZiAoc2ltcGxlVHlwZSA9PT0gJ3hzOmJvb2xlYW4nICYmICFlbnVtZXJhdGlvbikge1xuICAgIGNvbnZlcnRlcnMucHVzaChib29sZWFuQ29udmVydGVyKTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdlbnVtJywgW1sn0JTQsCcsIHRydWVdLCBbJ9Cd0LXRgicsIGZhbHNlXV0sIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICB9XG4gIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2lzV3JpdGFibGUnLCBpc1dyaXRhYmxlLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnaXNSZWFkYWJsZScsIGlzUmVhZGFibGUsIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCd0eXBlJywgcHJvcC50eXBlLCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnc2ltcGxlVHlwZScsIHNpbXBsZVR5cGUsIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKFxuICAgICdkaXNwbGF5TmFtZScsXG4gICAgcHJvcC5hbm5vdGF0aW9uID8gcHJvcC5hbm5vdGF0aW9uIDogbmFtZSxcbiAgICB0YXJnZXQsXG4gICAgcHJvcGVydHlLZXksXG4gICk7XG4gIGFwcGluZm8uY2F0ZWdvcnkgJiYgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnY2F0ZWdvcnknLCBhcHBpbmZvLmNhdGVnb3J5LCB0YXJnZXQsIHByb3BlcnR5S2V5KTtcbiAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbm1zVHlwZScsIGdldE5tc1R5cGUoc2ltcGxlVHlwZSksIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICBjb25zdCBhdHRyaWJ1dGVzOiBJUHJvcGVydHlEZXNjcmlwdG9yPERldmljZVByb3RvdHlwZT4gPSB7XG4gICAgZW51bWVyYWJsZTogaXNSZWFkYWJsZSxcbiAgfTtcbiAgY29uc3QgdG8gPSBjb252ZXJ0VG8oY29udmVydGVycyk7XG4gIGNvbnN0IGZyb20gPSBjb252ZXJ0RnJvbShjb252ZXJ0ZXJzKTtcbiAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnY29udmVydFRvJywgdG8sIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdjb252ZXJ0RnJvbScsIGZyb20sIHRhcmdldCwgcHJvcGVydHlLZXkpO1xuICBhdHRyaWJ1dGVzLmdldCA9IGZ1bmN0aW9uICgpIHtcbiAgICBjb25zb2xlLmFzc2VydChSZWZsZWN0LmdldCh0aGlzLCAnJGNvdW50UmVmJykgPiAwLCAnRGV2aWNlIHdhcyByZWxlYXNlZCcpO1xuICAgIGxldCB2YWx1ZTtcbiAgICBpZiAoIXRoaXMuZ2V0RXJyb3IoaWQpKSB7XG4gICAgICB2YWx1ZSA9IHRvKHRoaXMuZ2V0UmF3VmFsdWUoaWQpKTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9O1xuICBpZiAoaXNXcml0YWJsZSkge1xuICAgIGF0dHJpYnV0ZXMuc2V0ID0gZnVuY3Rpb24gKG5ld1ZhbHVlOiBhbnkpIHtcbiAgICAgIGNvbnNvbGUuYXNzZXJ0KFJlZmxlY3QuZ2V0KHRoaXMsICckY291bnRSZWYnKSA+IDAsICdEZXZpY2Ugd2FzIHJlbGVhc2VkJyk7XG4gICAgICBjb25zdCB2YWx1ZSA9IGZyb20obmV3VmFsdWUpO1xuICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgTnVtYmVyLmlzTmFOKHZhbHVlIGFzIG51bWJlcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHZhbHVlOiAke0pTT04uc3RyaW5naWZ5KG5ld1ZhbHVlKX1gKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc2V0UmF3VmFsdWUoaWQsIHZhbHVlKTtcbiAgICB9O1xuICB9XG4gIFJlZmxlY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBwcm9wZXJ0eUtleSwgYXR0cmlidXRlcyk7XG4gIHJldHVybiBbaWQsIHByb3BlcnR5S2V5XTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE1pYkZpbGUobWlibmFtZTogc3RyaW5nKSB7XG4gIHJldHVybiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4vbWlicy8nLCBgJHttaWJuYW1lfS5taWIuanNvbmApO1xufVxuXG5jbGFzcyBEZXZpY2VQcm90b3R5cGUgZXh0ZW5kcyBFdmVudEVtaXR0ZXIgaW1wbGVtZW50cyBJRGV2aWNlIHtcbiAgLy8gd2lsbCBiZSBvdmVycmlkZSBmb3IgYW4gaW5zdGFuY2VcbiAgJGNvdW50UmVmID0gMTtcbiAgaWQgPSB0aW1laWQoKTtcblxuICAvLyBwcml2YXRlICRkZWJvdW5jZURyYWluID0gXy5kZWJvdW5jZSh0aGlzLmRyYWluLCAyNSk7XG5cbiAgY29uc3RydWN0b3IobWlibmFtZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoKTtcbiAgICBjb25zdCBtaWJmaWxlID0gZ2V0TWliRmlsZShtaWJuYW1lKTtcbiAgICBjb25zdCBtaWJWYWxpZGF0aW9uID0gTWliRGV2aWNlVi5kZWNvZGUocmVxdWlyZShtaWJmaWxlKSk7XG4gICAgaWYgKG1pYlZhbGlkYXRpb24uaXNMZWZ0KCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBtaWIgZmlsZSAke21pYmZpbGV9ICR7UGF0aFJlcG9ydGVyLnJlcG9ydChtaWJWYWxpZGF0aW9uKX1gKTtcbiAgICB9XG4gICAgY29uc3QgbWliID0gbWliVmFsaWRhdGlvbi52YWx1ZTtcbiAgICBjb25zdCB7IHR5cGVzLCBzdWJyb3V0aW5lcyB9ID0gbWliO1xuICAgIGNvbnN0IGRldmljZSA9IHR5cGVzW21pYi5kZXZpY2VdIGFzIElNaWJEZXZpY2VUeXBlO1xuICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ21pYicsIG1pYm5hbWUsIHRoaXMpO1xuICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ21pYmZpbGUnLCBtaWJmaWxlLCB0aGlzKTtcbiAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdhbm5vdGF0aW9uJywgZGV2aWNlLmFubm90YXRpb24sIHRoaXMpO1xuICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ21pYlZlcnNpb24nLCBkZXZpY2UuYXBwaW5mby5taWJfdmVyc2lvbiwgdGhpcyk7XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnZGV2aWNlVHlwZScsIHRvSW50KGRldmljZS5hcHBpbmZvLmRldmljZV90eXBlKSwgdGhpcyk7XG4gICAgZGV2aWNlLmFwcGluZm8ubG9hZGVyX3R5cGUgJiYgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbG9hZGVyVHlwZScsXG4gICAgICB0b0ludChkZXZpY2UuYXBwaW5mby5sb2FkZXJfdHlwZSksIHRoaXMsXG4gICAgKTtcbiAgICBkZXZpY2UuYXBwaW5mby5maXJtd2FyZSAmJiBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdmaXJtd2FyZScsXG4gICAgICBkZXZpY2UuYXBwaW5mby5maXJtd2FyZSwgdGhpcyxcbiAgICApO1xuICAgIGRldmljZS5hcHBpbmZvLm1pbl92ZXJzaW9uICYmIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ21pbl92ZXJzaW9uJyxcbiAgICAgIGRldmljZS5hcHBpbmZvLm1pbl92ZXJzaW9uLCB0aGlzLFxuICAgICk7XG4gICAgdHlwZXMuZXJyb3JUeXBlICYmIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoXG4gICAgICAnZXJyb3JUeXBlJywgKHR5cGVzLmVycm9yVHlwZSBhcyBJTWliVHlwZSkuZW51bWVyYXRpb24sIHRoaXMpO1xuXG4gICAgaWYgKHN1YnJvdXRpbmVzKSB7XG4gICAgICBjb25zdCBtZXRhc3VicyA9IF8udHJhbnNmb3JtKFxuICAgICAgICBzdWJyb3V0aW5lcyxcbiAgICAgICAgKHJlc3VsdCwgc3ViLCBuYW1lKSA9PiB7XG4gICAgICAgICAgcmVzdWx0W25hbWVdID0ge1xuICAgICAgICAgICAgaWQ6IHRvSW50KHN1Yi5hcHBpbmZvLm5tc19pZCksXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogc3ViLmFubm90YXRpb24sXG4gICAgICAgICAgICBhcmdzOiBzdWIucHJvcGVydGllcyAmJiBPYmplY3QuZW50cmllcyhzdWIucHJvcGVydGllcylcbiAgICAgICAgICAgICAgLm1hcCgoW25hbWUsIHByb3BdKSA9PiAoe1xuICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgdHlwZTogZ2V0Tm1zVHlwZShwcm9wLnR5cGUpLFxuICAgICAgICAgICAgICAgIGRlc2M6IHByb3AuYW5ub3RhdGlvbixcbiAgICAgICAgICAgICAgfSkpLFxuICAgICAgICAgIH07XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSxcbiAgICAgICAge30gYXMgUmVjb3JkPHN0cmluZywgSVN1YnJvdXRpbmVEZXNjPixcbiAgICAgICk7XG4gICAgICBSZWZsZWN0LmRlZmluZU1ldGFkYXRhKCdzdWJyb3V0aW5lcycsIG1ldGFzdWJzLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBjYXRlZ29yeVxuICAgIC8vIGNvbnN0IG1pYkNhdGVnb3J5ID0gXy5maW5kKGRldGVjdG9yLmRldGVjdGlvbiEubWliQ2F0ZWdvcmllcywgeyBtaWI6IG1pYm5hbWUgfSk7XG4gICAgLy8gaWYgKG1pYkNhdGVnb3J5KSB7XG4gICAgLy8gICBjb25zdCB7IGNhdGVnb3J5LCBkaXNhYmxlQmF0Y2hSZWFkaW5nIH0gPSBtaWJDYXRlZ29yeTtcbiAgICAvLyAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ2NhdGVnb3J5JywgY2F0ZWdvcnksIHRoaXMpO1xuICAgIC8vICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnZGlzYWJsZUJhdGNoUmVhZGluZycsICEhZGlzYWJsZUJhdGNoUmVhZGluZywgdGhpcyk7XG4gICAgLy8gfVxuXG4gICAgY29uc3Qga2V5cyA9IFJlZmxlY3Qub3duS2V5cyhkZXZpY2UucHJvcGVydGllcykgYXMgc3RyaW5nW107XG4gICAgUmVmbGVjdC5kZWZpbmVNZXRhZGF0YSgnbWliUHJvcGVydGllcycsIGtleXMubWFwKHZhbGlkSnNOYW1lKSwgdGhpcyk7XG4gICAgY29uc3QgbWFwOiB7IFtpZDogbnVtYmVyXTogc3RyaW5nW10gfSA9IHt9O1xuICAgIGtleXMuZm9yRWFjaCgoa2V5OiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IFtpZCwgcHJvcE5hbWVdID0gZGVmaW5lTWliUHJvcGVydHkodGhpcywga2V5LCB0eXBlcywgZGV2aWNlLnByb3BlcnRpZXNba2V5XSk7XG4gICAgICBpZiAoIW1hcFtpZF0pIHtcbiAgICAgICAgbWFwW2lkXSA9IFtwcm9wTmFtZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtYXBbaWRdLnB1c2gocHJvcE5hbWUpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIFJlZmxlY3QuZGVmaW5lTWV0YWRhdGEoJ21hcCcsIG1hcCwgdGhpcyk7XG4gIH1cblxuICBwdWJsaWMgZ2V0IGNvbm5lY3Rpb24oKTogTmlidXNDb25uZWN0aW9uIHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCB7IFskdmFsdWVzXTogdmFsdWVzIH0gPSB0aGlzO1xuICAgIHJldHVybiB2YWx1ZXNbUHJpdmF0ZVByb3BzLmNvbm5lY3Rpb25dO1xuICB9XG5cbiAgcHVibGljIHNldCBjb25uZWN0aW9uKHZhbHVlOiBOaWJ1c0Nvbm5lY3Rpb24gfCB1bmRlZmluZWQpIHtcbiAgICBjb25zdCB7IFskdmFsdWVzXTogdmFsdWVzIH0gPSB0aGlzO1xuICAgIGNvbnN0IHByZXYgPSB2YWx1ZXNbUHJpdmF0ZVByb3BzLmNvbm5lY3Rpb25dO1xuICAgIGlmIChwcmV2ID09PSB2YWx1ZSkgcmV0dXJuO1xuICAgIHZhbHVlc1tQcml2YXRlUHJvcHMuY29ubmVjdGlvbl0gPSB2YWx1ZTtcbiAgICAvKipcbiAgICAgKiBEZXZpY2UgY29ubmVjdGVkIGV2ZW50XG4gICAgICogQGV2ZW50IElEZXZpY2UjY29ubmVjdGVkXG4gICAgICogQGV2ZW50IElEZXZpY2UjZGlzY29ubmVjdGVkXG4gICAgICovXG4gICAgdGhpcy5lbWl0KHZhbHVlICE9IG51bGwgPyAnY29ubmVjdGVkJyA6ICdkaXNjb25uZWN0ZWQnKTtcbiAgICAvLyBpZiAodmFsdWUpIHtcbiAgICAvLyAgIHRoaXMuZHJhaW4oKS5jYXRjaCgoKSA9PiB7fSk7XG4gICAgLy8gfVxuICB9XG5cbiAgLy8gbm9pbnNwZWN0aW9uIEpTVW51c2VkR2xvYmFsU3ltYm9sc1xuICBwdWJsaWMgdG9KU09OKCk6IGFueSB7XG4gICAgY29uc3QganNvbjogYW55ID0ge1xuICAgICAgbWliOiBSZWZsZWN0LmdldE1ldGFkYXRhKCdtaWInLCB0aGlzKSxcbiAgICB9O1xuICAgIGNvbnN0IGtleXM6IHN0cmluZ1tdID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWliUHJvcGVydGllcycsIHRoaXMpO1xuICAgIGtleXMuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICBpZiAodGhpc1trZXldICE9PSB1bmRlZmluZWQpIGpzb25ba2V5XSA9IHRoaXNba2V5XTtcbiAgICB9KTtcbiAgICBqc29uLmFkZHJlc3MgPSB0aGlzLmFkZHJlc3MudG9TdHJpbmcoKTtcbiAgICByZXR1cm4ganNvbjtcbiAgfVxuXG4gIHB1YmxpYyBnZXRJZChpZE9yTmFtZTogc3RyaW5nIHwgbnVtYmVyKTogbnVtYmVyIHtcbiAgICBsZXQgaWQ6IG51bWJlcjtcbiAgICBpZiAodHlwZW9mIGlkT3JOYW1lID09PSAnc3RyaW5nJykge1xuICAgICAgaWQgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdpZCcsIHRoaXMsIGlkT3JOYW1lKTtcbiAgICAgIGlmIChOdW1iZXIuaXNJbnRlZ2VyKGlkKSkgcmV0dXJuIGlkO1xuICAgICAgaWQgPSB0b0ludChpZE9yTmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlkID0gaWRPck5hbWU7XG4gICAgfVxuICAgIGNvbnN0IG1hcCA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21hcCcsIHRoaXMpO1xuICAgIGlmICghUmVmbGVjdC5oYXMobWFwLCBpZCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBwcm9wZXJ0eSAke2lkT3JOYW1lfWApO1xuICAgIH1cbiAgICByZXR1cm4gaWQ7XG4gIH1cblxuICBwdWJsaWMgZ2V0TmFtZShpZE9yTmFtZTogc3RyaW5nIHwgbnVtYmVyKTogc3RyaW5nIHtcbiAgICBjb25zdCBtYXAgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBpZiAoUmVmbGVjdC5oYXMobWFwLCBpZE9yTmFtZSkpIHtcbiAgICAgIHJldHVybiBtYXBbaWRPck5hbWVdWzBdO1xuICAgIH1cbiAgICBjb25zdCBrZXlzOiBzdHJpbmdbXSA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21pYlByb3BlcnRpZXMnLCB0aGlzKTtcbiAgICBpZiAodHlwZW9mIGlkT3JOYW1lID09PSAnc3RyaW5nJyAmJiBrZXlzLmluY2x1ZGVzKGlkT3JOYW1lKSkgcmV0dXJuIGlkT3JOYW1lO1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBwcm9wZXJ0eSAke2lkT3JOYW1lfWApO1xuICB9XG5cbiAgLypcbiAgICBwdWJsaWMgdG9JZHMoaWRzT3JOYW1lczogKHN0cmluZyB8IG51bWJlcilbXSk6IG51bWJlcltdIHtcbiAgICAgIGNvbnN0IG1hcCA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21hcCcsIHRoaXMpO1xuICAgICAgcmV0dXJuIGlkc09yTmFtZXMubWFwKChpZE9yTmFtZSkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGlkT3JOYW1lID09PSAnc3RyaW5nJylcbiAgICAgIH0pO1xuICAgIH1cbiAgKi9cbiAgcHVibGljIGdldFJhd1ZhbHVlKGlkT3JOYW1lOiBudW1iZXIgfCBzdHJpbmcpOiBhbnkge1xuICAgIGNvbnN0IGlkID0gdGhpcy5nZXRJZChpZE9yTmFtZSk7XG4gICAgY29uc3QgeyBbJHZhbHVlc106IHZhbHVlcyB9ID0gdGhpcztcbiAgICByZXR1cm4gdmFsdWVzW2lkXTtcbiAgfVxuXG4gIHB1YmxpYyBzZXRSYXdWYWx1ZShpZE9yTmFtZTogbnVtYmVyIHwgc3RyaW5nLCB2YWx1ZTogYW55LCBpc0RpcnR5ID0gdHJ1ZSkge1xuICAgIC8vIGRlYnVnKGBzZXRSYXdWYWx1ZSgke2lkT3JOYW1lfSwgJHtKU09OLnN0cmluZ2lmeShzYWZlTnVtYmVyKHZhbHVlKSl9KWApO1xuICAgIGNvbnN0IGlkID0gdGhpcy5nZXRJZChpZE9yTmFtZSk7XG4gICAgY29uc3QgeyBbJHZhbHVlc106IHZhbHVlcywgWyRlcnJvcnNdOiBlcnJvcnMgfSA9IHRoaXM7XG4gICAgdmFsdWVzW2lkXSA9IHNhZmVOdW1iZXIodmFsdWUpO1xuICAgIGRlbGV0ZSBlcnJvcnNbaWRdO1xuICAgIHRoaXMuc2V0RGlydHkoaWQsIGlzRGlydHkpO1xuICB9XG5cbiAgcHVibGljIGdldEVycm9yKGlkT3JOYW1lOiBudW1iZXIgfCBzdHJpbmcpOiBhbnkge1xuICAgIGNvbnN0IGlkID0gdGhpcy5nZXRJZChpZE9yTmFtZSk7XG4gICAgY29uc3QgeyBbJGVycm9yc106IGVycm9ycyB9ID0gdGhpcztcbiAgICByZXR1cm4gZXJyb3JzW2lkXTtcbiAgfVxuXG4gIHB1YmxpYyBzZXRFcnJvcihpZE9yTmFtZTogbnVtYmVyIHwgc3RyaW5nLCBlcnJvcj86IEVycm9yKSB7XG4gICAgY29uc3QgaWQgPSB0aGlzLmdldElkKGlkT3JOYW1lKTtcbiAgICBjb25zdCB7IFskZXJyb3JzXTogZXJyb3JzIH0gPSB0aGlzO1xuICAgIGlmIChlcnJvciAhPSBudWxsKSB7XG4gICAgICBlcnJvcnNbaWRdID0gZXJyb3I7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlbGV0ZSBlcnJvcnNbaWRdO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBpc0RpcnR5KGlkT3JOYW1lOiBzdHJpbmcgfCBudW1iZXIpOiBib29sZWFuIHtcbiAgICBjb25zdCBpZCA9IHRoaXMuZ2V0SWQoaWRPck5hbWUpO1xuICAgIGNvbnN0IHsgWyRkaXJ0aWVzXTogZGlydGllcyB9ID0gdGhpcztcbiAgICByZXR1cm4gISFkaXJ0aWVzW2lkXTtcbiAgfVxuXG4gIHB1YmxpYyBzZXREaXJ0eShpZE9yTmFtZTogc3RyaW5nIHwgbnVtYmVyLCBpc0RpcnR5ID0gdHJ1ZSkge1xuICAgIGNvbnN0IGlkID0gdGhpcy5nZXRJZChpZE9yTmFtZSk7XG4gICAgY29uc3QgbWFwOiB7IFtpZDogbnVtYmVyXTogc3RyaW5nW10gfSA9IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ21hcCcsIHRoaXMpO1xuICAgIGNvbnN0IHsgWyRkaXJ0aWVzXTogZGlydGllcyB9ID0gdGhpcztcbiAgICBpZiAoaXNEaXJ0eSkge1xuICAgICAgZGlydGllc1tpZF0gPSB0cnVlO1xuICAgICAgLy8gVE9ETzogaW1wbGVtZW50IGF1dG9zYXZlXG4gICAgICAvLyB0aGlzLndyaXRlKGlkKS5jYXRjaCgoKSA9PiB7fSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlbGV0ZSBkaXJ0aWVzW2lkXTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQGV2ZW50IElEZXZpY2UjY2hhbmdlZFxuICAgICAqIEBldmVudCBJRGV2aWNlI2NoYW5naW5nXG4gICAgICovXG4gICAgY29uc3QgbmFtZXMgPSBtYXBbaWRdIHx8IFtdO1xuICAgIHRoaXMuZW1pdChcbiAgICAgIGlzRGlydHkgPyAnY2hhbmdpbmcnIDogJ2NoYW5nZWQnLFxuICAgICAge1xuICAgICAgICBpZCxcbiAgICAgICAgbmFtZXMsXG4gICAgICB9LFxuICAgICk7XG4gIH1cblxuICBwdWJsaWMgYWRkcmVmKCkge1xuICAgIHRoaXMuJGNvdW50UmVmICs9IDE7XG4gICAgZGVidWcoJ2FkZHJlZicsIG5ldyBFcnJvcignYWRkcmVmJykuc3RhY2spO1xuICAgIHJldHVybiB0aGlzLiRjb3VudFJlZjtcbiAgfVxuXG4gIHB1YmxpYyByZWxlYXNlKCkge1xuICAgIHRoaXMuJGNvdW50UmVmIC09IDE7XG4gICAgaWYgKHRoaXMuJGNvdW50UmVmIDw9IDApIHtcbiAgICAgIGRlbGV0ZSBkZXZpY2VNYXBbdGhpcy5hZGRyZXNzLnRvU3RyaW5nKCldO1xuICAgICAgLyoqXG4gICAgICAgKiBAZXZlbnQgRGV2aWNlcyNkZWxldGVcbiAgICAgICAqL1xuICAgICAgZGV2aWNlcy5lbWl0KCdkZWxldGUnLCB0aGlzKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuJGNvdW50UmVmO1xuICB9XG5cbiAgcHVibGljIGRyYWluKCk6IFByb21pc2U8bnVtYmVyW10+IHtcbiAgICBkZWJ1ZyhgZHJhaW4gWyR7dGhpcy5hZGRyZXNzfV1gKTtcbiAgICBjb25zdCB7IFskZGlydGllc106IGRpcnRpZXMgfSA9IHRoaXM7XG4gICAgY29uc3QgaWRzID0gT2JqZWN0LmtleXMoZGlydGllcykubWFwKE51bWJlcikuZmlsdGVyKGlkID0+IGRpcnRpZXNbaWRdKTtcbiAgICByZXR1cm4gaWRzLmxlbmd0aCA+IDAgPyB0aGlzLndyaXRlKC4uLmlkcykuY2F0Y2goKCkgPT4gW10pIDogUHJvbWlzZS5yZXNvbHZlKFtdKTtcbiAgfVxuXG4gIHByaXZhdGUgd3JpdGVBbGwoKSB7XG4gICAgY29uc3QgeyBbJHZhbHVlc106IHZhbHVlcyB9ID0gdGhpcztcbiAgICBjb25zdCBtYXAgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBjb25zdCBpZHMgPSBPYmplY3QuZW50cmllcyh2YWx1ZXMpXG4gICAgICAuZmlsdGVyKChbLCB2YWx1ZV0pID0+IHZhbHVlICE9IG51bGwpXG4gICAgICAubWFwKChbaWRdKSA9PiBOdW1iZXIoaWQpKVxuICAgICAgLmZpbHRlcigoaWQgPT4gUmVmbGVjdC5nZXRNZXRhZGF0YSgnaXNXcml0YWJsZScsIHRoaXMsIG1hcFtpZF1bMF0pKSk7XG4gICAgcmV0dXJuIGlkcy5sZW5ndGggPiAwID8gdGhpcy53cml0ZSguLi5pZHMpIDogUHJvbWlzZS5yZXNvbHZlKFtdKTtcbiAgfVxuXG4gIHB1YmxpYyB3cml0ZSguLi5pZHM6IG51bWJlcltdKTogUHJvbWlzZTxudW1iZXJbXT4ge1xuICAgIGNvbnN0IHsgY29ubmVjdGlvbiB9ID0gdGhpcztcbiAgICBpZiAoIWNvbm5lY3Rpb24pIHJldHVybiBQcm9taXNlLnJlamVjdChgJHt0aGlzLmFkZHJlc3N9IGlzIGRpc2Nvbm5lY3RlZGApO1xuICAgIGlmIChpZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gdGhpcy53cml0ZUFsbCgpO1xuICAgIH1cbiAgICBkZWJ1Zyhgd3JpdGluZyAke2lkcy5qb2luKCl9IHRvIFske3RoaXMuYWRkcmVzc31dYCk7XG4gICAgY29uc3QgbWFwID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWFwJywgdGhpcyk7XG4gICAgY29uc3QgcmVxdWVzdHMgPSBpZHMucmVkdWNlKFxuICAgICAgKGFjYzogTm1zRGF0YWdyYW1bXSwgaWQpID0+IHtcbiAgICAgICAgY29uc3QgW25hbWVdID0gbWFwW2lkXTtcbiAgICAgICAgaWYgKCFuYW1lKSB7XG4gICAgICAgICAgZGVidWcoYFVua25vd24gaWQ6ICR7aWR9IGZvciAke1JlZmxlY3QuZ2V0TWV0YWRhdGEoJ21pYicsIHRoaXMpfWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGFjYy5wdXNoKGNyZWF0ZU5tc1dyaXRlKFxuICAgICAgICAgICAgdGhpcy5hZGRyZXNzLFxuICAgICAgICAgICAgaWQsXG4gICAgICAgICAgICBSZWZsZWN0LmdldE1ldGFkYXRhKCdubXNUeXBlJywgdGhpcywgbmFtZSksXG4gICAgICAgICAgICB0aGlzLmdldFJhd1ZhbHVlKGlkKSxcbiAgICAgICAgICApKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgfSxcbiAgICAgIFtdLFxuICAgICk7XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKFxuICAgICAgcmVxdWVzdHNcbiAgICAgICAgLm1hcChkYXRhZ3JhbSA9PiBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShkYXRhZ3JhbSlcbiAgICAgICAgICAudGhlbigocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHsgc3RhdHVzIH0gPSByZXNwb25zZSBhcyBObXNEYXRhZ3JhbTtcbiAgICAgICAgICAgIGlmIChzdGF0dXMgPT09IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5zZXREaXJ0eShkYXRhZ3JhbS5pZCwgZmFsc2UpO1xuICAgICAgICAgICAgICByZXR1cm4gZGF0YWdyYW0uaWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnNldEVycm9yKGRhdGFncmFtLmlkLCBuZXcgTmlidXNFcnJvcihzdGF0dXMhLCB0aGlzKSk7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgfSwgKHJlYXNvbikgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXRFcnJvcihkYXRhZ3JhbS5pZCwgcmVhc29uKTtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICB9KSkpXG4gICAgICAudGhlbihpZHMgPT4gaWRzLmZpbHRlcihpZCA9PiBpZCA+IDApKTtcbiAgfVxuXG4gIHB1YmxpYyB3cml0ZVZhbHVlcyhzb3VyY2U6IG9iamVjdCwgc3Ryb25nID0gdHJ1ZSk6IFByb21pc2U8bnVtYmVyW10+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgaWRzID0gT2JqZWN0LmtleXMoc291cmNlKS5tYXAobmFtZSA9PiB0aGlzLmdldElkKG5hbWUpKTtcbiAgICAgIGlmIChpZHMubGVuZ3RoID09PSAwKSByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IFR5cGVFcnJvcigndmFsdWUgaXMgZW1wdHknKSk7XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMsIHNvdXJjZSk7XG4gICAgICByZXR1cm4gdGhpcy53cml0ZSguLi5pZHMpXG4gICAgICAgIC50aGVuKCh3cml0dGVuKSA9PiB7XG4gICAgICAgICAgaWYgKHdyaXR0ZW4ubGVuZ3RoID09PSAwIHx8IChzdHJvbmcgJiYgd3JpdHRlbi5sZW5ndGggIT09IGlkcy5sZW5ndGgpKSB7XG4gICAgICAgICAgICB0aHJvdyB0aGlzLmdldEVycm9yKGlkc1swXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB3cml0dGVuO1xuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcmVhZEFsbCgpOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IG1hcDogeyBbaWQ6IHN0cmluZ106IHN0cmluZ1tdIH0gPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBjb25zdCBpZHMgPSBPYmplY3QuZW50cmllcyhtYXApXG4gICAgICAuZmlsdGVyKChbLCBuYW1lc10pID0+IFJlZmxlY3QuZ2V0TWV0YWRhdGEoJ2lzUmVhZGFibGUnLCB0aGlzLCBuYW1lc1swXSkpXG4gICAgICAubWFwKChbaWRdKSA9PiBOdW1iZXIoaWQpKTtcbiAgICByZXR1cm4gaWRzLmxlbmd0aCA+IDAgPyB0aGlzLnJlYWQoLi4uaWRzKSA6IFByb21pc2UucmVzb2x2ZShbXSk7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcmVhZCguLi5pZHM6IG51bWJlcltdKTogUHJvbWlzZTx7IFtuYW1lOiBzdHJpbmddOiBhbnkgfT4ge1xuICAgIGNvbnN0IHsgY29ubmVjdGlvbiB9ID0gdGhpcztcbiAgICBpZiAoIWNvbm5lY3Rpb24pIHJldHVybiBQcm9taXNlLnJlamVjdCgnZGlzY29ubmVjdGVkJyk7XG4gICAgaWYgKGlkcy5sZW5ndGggPT09IDApIHJldHVybiB0aGlzLnJlYWRBbGwoKTtcbiAgICAvLyBkZWJ1ZyhgcmVhZCAke2lkcy5qb2luKCl9IGZyb20gWyR7dGhpcy5hZGRyZXNzfV1gKTtcbiAgICBjb25zdCBkaXNhYmxlQmF0Y2hSZWFkaW5nID0gUmVmbGVjdC5nZXRNZXRhZGF0YSgnZGlzYWJsZUJhdGNoUmVhZGluZycsIHRoaXMpO1xuICAgIGNvbnN0IG1hcDogeyBbaWQ6IHN0cmluZ106IHN0cmluZ1tdIH0gPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdtYXAnLCB0aGlzKTtcbiAgICBjb25zdCBjaHVua3MgPSBjaHVua0FycmF5KGlkcywgZGlzYWJsZUJhdGNoUmVhZGluZyA/IDEgOiAyMSk7XG4gICAgZGVidWcoYHJlYWQgWyR7Y2h1bmtzLm1hcChjaHVuayA9PiBgWyR7Y2h1bmsuam9pbigpfV1gKS5qb2luKCl9XSBmcm9tIFske3RoaXMuYWRkcmVzc31dYCk7XG4gICAgY29uc3QgcmVxdWVzdHMgPSBjaHVua3MubWFwKGNodW5rID0+IGNyZWF0ZU5tc1JlYWQodGhpcy5hZGRyZXNzLCAuLi5jaHVuaykpO1xuICAgIHJldHVybiByZXF1ZXN0cy5yZWR1Y2UoXG4gICAgICBhc3luYyAocHJvbWlzZSwgZGF0YWdyYW0pID0+IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvbWlzZTtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShkYXRhZ3JhbSk7XG4gICAgICAgIGNvbnN0IGRhdGFncmFtczogTm1zRGF0YWdyYW1bXSA9IEFycmF5LmlzQXJyYXkocmVzcG9uc2UpXG4gICAgICAgICAgPyByZXNwb25zZSBhcyBObXNEYXRhZ3JhbVtdXG4gICAgICAgICAgOiBbcmVzcG9uc2UgYXMgTm1zRGF0YWdyYW1dO1xuICAgICAgICBkYXRhZ3JhbXMuZm9yRWFjaCgoeyBpZCwgdmFsdWUsIHN0YXR1cyB9KSA9PiB7XG4gICAgICAgICAgaWYgKHN0YXR1cyA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5zZXRSYXdWYWx1ZShpZCwgdmFsdWUsIGZhbHNlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zZXRFcnJvcihpZCwgbmV3IE5pYnVzRXJyb3Ioc3RhdHVzISwgdGhpcykpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBuYW1lcyA9IG1hcFtpZF07XG4gICAgICAgICAgY29uc29sZS5hc3NlcnQobmFtZXMgJiYgbmFtZXMubGVuZ3RoID4gMCwgYEludmFsaWQgaWQgJHtpZH1gKTtcbiAgICAgICAgICBuYW1lcy5mb3JFYWNoKChwcm9wTmFtZSkgPT4ge1xuICAgICAgICAgICAgcmVzdWx0W3Byb3BOYW1lXSA9IHN0YXR1cyA9PT0gMFxuICAgICAgICAgICAgICA/IHRoaXNbcHJvcE5hbWVdXG4gICAgICAgICAgICAgIDogeyBlcnJvcjogKHRoaXMuZ2V0RXJyb3IoaWQpIHx8IHt9KS5tZXNzYWdlIHx8ICdlcnJvcicgfTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9LFxuICAgICAgUHJvbWlzZS5yZXNvbHZlKHt9IGFzIHsgW25hbWU6IHN0cmluZ106IGFueSB9KSxcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgdXBsb2FkKGRvbWFpbjogc3RyaW5nLCBvZmZzZXQgPSAwLCBzaXplPzogbnVtYmVyKTogUHJvbWlzZTxCdWZmZXI+IHtcbiAgICBjb25zdCB7IGNvbm5lY3Rpb24gfSA9IHRoaXM7XG4gICAgdHJ5IHtcbiAgICAgIGlmICghY29ubmVjdGlvbikgdGhyb3cgbmV3IEVycm9yKCdkaXNjb25uZWN0ZWQnKTtcbiAgICAgIGNvbnN0IHJlcVVwbG9hZCA9IGNyZWF0ZU5tc1JlcXVlc3REb21haW5VcGxvYWQodGhpcy5hZGRyZXNzLCBkb21haW4ucGFkRW5kKDgsICdcXDAnKSk7XG4gICAgICBjb25zdCB7IGlkLCB2YWx1ZTogZG9tYWluU2l6ZSwgc3RhdHVzIH0gPVxuICAgICAgICBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShyZXFVcGxvYWQpIGFzIE5tc0RhdGFncmFtO1xuICAgICAgaWYgKHN0YXR1cyAhPT0gMCkge1xuICAgICAgICAvLyBkZWJ1ZygnPGVycm9yPicsIHN0YXR1cyk7XG4gICAgICAgIHRocm93IG5ldyBOaWJ1c0Vycm9yKHN0YXR1cyEsIHRoaXMsICdSZXF1ZXN0IHVwbG9hZCBkb21haW4gZXJyb3InKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGluaXRVcGxvYWQgPSBjcmVhdGVObXNJbml0aWF0ZVVwbG9hZFNlcXVlbmNlKHRoaXMuYWRkcmVzcywgaWQpO1xuICAgICAgY29uc3QgeyBzdGF0dXM6IGluaXRTdGF0IH0gPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShpbml0VXBsb2FkKSBhcyBObXNEYXRhZ3JhbTtcbiAgICAgIGlmIChpbml0U3RhdCAhPT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgTmlidXNFcnJvcihpbml0U3RhdCEsIHRoaXMsICdJbml0aWF0ZSB1cGxvYWQgZG9tYWluIGVycm9yJyk7XG4gICAgICB9XG4gICAgICBjb25zdCB0b3RhbCA9IHNpemUgfHwgKGRvbWFpblNpemUgLSBvZmZzZXQpO1xuICAgICAgbGV0IHJlc3QgPSB0b3RhbDtcbiAgICAgIGxldCBwb3MgPSBvZmZzZXQ7XG4gICAgICB0aGlzLmVtaXQoXG4gICAgICAgICd1cGxvYWRTdGFydCcsXG4gICAgICAgIHtcbiAgICAgICAgICBkb21haW4sXG4gICAgICAgICAgZG9tYWluU2l6ZSxcbiAgICAgICAgICBvZmZzZXQsXG4gICAgICAgICAgc2l6ZTogdG90YWwsXG4gICAgICAgIH0sXG4gICAgICApO1xuICAgICAgY29uc3QgYnVmczogQnVmZmVyW10gPSBbXTtcbiAgICAgIHdoaWxlIChyZXN0ID4gMCkge1xuICAgICAgICBjb25zdCBsZW5ndGggPSBNYXRoLm1pbigyNTUsIHJlc3QpO1xuICAgICAgICBjb25zdCB1cGxvYWRTZWdtZW50ID0gY3JlYXRlTm1zVXBsb2FkU2VnbWVudCh0aGlzLmFkZHJlc3MsIGlkLCBwb3MsIGxlbmd0aCk7XG4gICAgICAgIGNvbnN0IHsgc3RhdHVzOiB1cGxvYWRTdGF0dXMsIHZhbHVlOiByZXN1bHQgfSA9XG4gICAgICAgICAgYXdhaXQgY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0odXBsb2FkU2VnbWVudCkgYXMgTm1zRGF0YWdyYW07XG4gICAgICAgIGlmICh1cGxvYWRTdGF0dXMgIT09IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgTmlidXNFcnJvcih1cGxvYWRTdGF0dXMhLCB0aGlzLCAnVXBsb2FkIHNlZ21lbnQgZXJyb3InKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVzdWx0LmRhdGEubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgYnVmcy5wdXNoKHJlc3VsdC5kYXRhKTtcbiAgICAgICAgdGhpcy5lbWl0KFxuICAgICAgICAgICd1cGxvYWREYXRhJyxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBkb21haW4sXG4gICAgICAgICAgICBwb3MsXG4gICAgICAgICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgICAgICB9LFxuICAgICAgICApO1xuICAgICAgICByZXN0IC09IHJlc3VsdC5kYXRhLmxlbmd0aDtcbiAgICAgICAgcG9zICs9IHJlc3VsdC5kYXRhLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHJlc3VsdCA9IEJ1ZmZlci5jb25jYXQoYnVmcyk7XG4gICAgICB0aGlzLmVtaXQoXG4gICAgICAgICd1cGxvYWRGaW5pc2gnLFxuICAgICAgICB7XG4gICAgICAgICAgZG9tYWluLFxuICAgICAgICAgIG9mZnNldCxcbiAgICAgICAgICBkYXRhOiByZXN1bHQsXG4gICAgICAgIH0sXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLmVtaXQoJ3VwbG9hZEVycm9yJywgZSk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGRvd25sb2FkKGRvbWFpbjogc3RyaW5nLCBidWZmZXI6IEJ1ZmZlciwgb2Zmc2V0ID0gMCwgbm9UZXJtID0gZmFsc2UpIHtcbiAgICBjb25zdCB7IGNvbm5lY3Rpb24gfSA9IHRoaXM7XG4gICAgaWYgKCFjb25uZWN0aW9uKSB0aHJvdyBuZXcgRXJyb3IoJ2Rpc2Nvbm5lY3RlZCcpO1xuICAgIGNvbnN0IHJlcURvd25sb2FkID0gY3JlYXRlTm1zUmVxdWVzdERvbWFpbkRvd25sb2FkKHRoaXMuYWRkcmVzcywgZG9tYWluLnBhZEVuZCg4LCAnXFwwJykpO1xuICAgIGNvbnN0IHsgaWQsIHZhbHVlOiBtYXgsIHN0YXR1cyB9ID0gYXdhaXQgY29ubmVjdGlvbi5zZW5kRGF0YWdyYW0ocmVxRG93bmxvYWQpIGFzIE5tc0RhdGFncmFtO1xuICAgIGlmIChzdGF0dXMgIT09IDApIHtcbiAgICAgIC8vIGRlYnVnKCc8ZXJyb3I+Jywgc3RhdHVzKTtcbiAgICAgIHRocm93IG5ldyBOaWJ1c0Vycm9yKHN0YXR1cyEsIHRoaXMsICdSZXF1ZXN0IGRvd25sb2FkIGRvbWFpbiBlcnJvcicpO1xuICAgIH1cbiAgICBjb25zdCB0ZXJtaW5hdGUgPSBhc3luYyAoZXJyPzogRXJyb3IpID0+IHtcbiAgICAgIGxldCB0ZXJtU3RhdCA9IDA7XG4gICAgICBpZiAoIW5vVGVybSkge1xuICAgICAgICBjb25zdCByZXEgPSBjcmVhdGVObXNUZXJtaW5hdGVEb3dubG9hZFNlcXVlbmNlKHRoaXMuYWRkcmVzcywgaWQpO1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShyZXEpIGFzIE5tc0RhdGFncmFtO1xuICAgICAgICB0ZXJtU3RhdCA9IHJlcy5zdGF0dXMhO1xuICAgICAgfVxuICAgICAgaWYgKGVycikgdGhyb3cgZXJyO1xuICAgICAgaWYgKHRlcm1TdGF0ICE9PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBOaWJ1c0Vycm9yKFxuICAgICAgICAgIHRlcm1TdGF0ISxcbiAgICAgICAgICB0aGlzLFxuICAgICAgICAgICdUZXJtaW5hdGUgZG93bmxvYWQgc2VxdWVuY2UgZXJyb3IsIG1heWJlIG5lZWQgLS1uby10ZXJtJyxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGlmIChidWZmZXIubGVuZ3RoID4gbWF4IC0gb2Zmc2V0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEJ1ZmZlciB0byBsYXJnZS4gRXhwZWN0ZWQgJHttYXggLSBvZmZzZXR9IGJ5dGVzYCk7XG4gICAgfVxuICAgIGNvbnN0IGluaXREb3dubG9hZCA9IGNyZWF0ZU5tc0luaXRpYXRlRG93bmxvYWRTZXF1ZW5jZSh0aGlzLmFkZHJlc3MsIGlkKTtcbiAgICBjb25zdCB7IHN0YXR1czogaW5pdFN0YXQgfSA9IGF3YWl0IGNvbm5lY3Rpb24uc2VuZERhdGFncmFtKGluaXREb3dubG9hZCkgYXMgTm1zRGF0YWdyYW07XG4gICAgaWYgKGluaXRTdGF0ICE9PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgTmlidXNFcnJvcihpbml0U3RhdCEsIHRoaXMsICdJbml0aWF0ZSBkb3dubG9hZCBkb21haW4gZXJyb3InKTtcbiAgICB9XG4gICAgdGhpcy5lbWl0KFxuICAgICAgJ2Rvd25sb2FkU3RhcnQnLFxuICAgICAge1xuICAgICAgICBkb21haW4sXG4gICAgICAgIG9mZnNldCxcbiAgICAgICAgZG9tYWluU2l6ZTogbWF4LFxuICAgICAgICBzaXplOiBidWZmZXIubGVuZ3RoLFxuICAgICAgfSxcbiAgICApO1xuICAgIGNvbnN0IGNyYyA9IGNyYzE2Y2NpdHQoYnVmZmVyLCAwKTtcbiAgICBjb25zdCBjaHVua1NpemUgPSBOTVNfTUFYX0RBVEFfTEVOR1RIIC0gNDtcbiAgICBjb25zdCBjaHVua3MgPSBjaHVua0FycmF5KGJ1ZmZlciwgY2h1bmtTaXplKTtcbiAgICBhd2FpdCBjaHVua3MucmVkdWNlKGFzeW5jIChwcmV2LCBjaHVuazogQnVmZmVyLCBpKSA9PiB7XG4gICAgICBhd2FpdCBwcmV2O1xuICAgICAgY29uc3QgcG9zID0gaSAqIGNodW5rU2l6ZSArIG9mZnNldDtcbiAgICAgIGNvbnN0IHNlZ21lbnREb3dubG9hZCA9XG4gICAgICAgIGNyZWF0ZU5tc0Rvd25sb2FkU2VnbWVudCh0aGlzLmFkZHJlc3MsIGlkISwgcG9zLCBjaHVuayk7XG4gICAgICBjb25zdCB7IHN0YXR1czogZG93bmxvYWRTdGF0IH0gPVxuICAgICAgICBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbShzZWdtZW50RG93bmxvYWQpIGFzIE5tc0RhdGFncmFtO1xuICAgICAgaWYgKGRvd25sb2FkU3RhdCAhPT0gMCkge1xuICAgICAgICBhd2FpdCB0ZXJtaW5hdGUobmV3IE5pYnVzRXJyb3IoZG93bmxvYWRTdGF0ISwgdGhpcywgJ0Rvd25sb2FkIHNlZ21lbnQgZXJyb3InKSk7XG4gICAgICB9XG4gICAgICB0aGlzLmVtaXQoXG4gICAgICAgICdkb3dubG9hZERhdGEnLFxuICAgICAgICB7XG4gICAgICAgICAgZG9tYWluLFxuICAgICAgICAgIGxlbmd0aDogY2h1bmsubGVuZ3RoLFxuICAgICAgICB9LFxuICAgICAgKTtcbiAgICB9LCBQcm9taXNlLnJlc29sdmUoKSk7XG4gICAgY29uc3QgdmVyaWZ5ID0gY3JlYXRlTm1zVmVyaWZ5RG9tYWluQ2hlY2tzdW0odGhpcy5hZGRyZXNzLCBpZCwgb2Zmc2V0LCBidWZmZXIubGVuZ3RoLCBjcmMpO1xuICAgIGNvbnN0IHsgc3RhdHVzOiB2ZXJpZnlTdGF0IH0gPSBhd2FpdCBjb25uZWN0aW9uLnNlbmREYXRhZ3JhbSh2ZXJpZnkpIGFzIE5tc0RhdGFncmFtO1xuICAgIGlmICh2ZXJpZnlTdGF0ICE9PSAwKSB7XG4gICAgICBhd2FpdCB0ZXJtaW5hdGUobmV3IE5pYnVzRXJyb3IodmVyaWZ5U3RhdCEsIHRoaXMsICdEb3dubG9hZCBzZWdtZW50IGVycm9yJykpO1xuICAgIH1cbiAgICBhd2FpdCB0ZXJtaW5hdGUoKTtcbiAgICB0aGlzLmVtaXQoXG4gICAgICAnZG93bmxvYWRGaW5pc2gnLFxuICAgICAge1xuICAgICAgICBkb21haW4sXG4gICAgICAgIG9mZnNldCxcbiAgICAgICAgc2l6ZTogYnVmZmVyLmxlbmd0aCxcbiAgICAgIH0sXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIGV4ZWN1dGUocHJvZ3JhbTogc3RyaW5nLCBhcmdzPzogUmVjb3JkPHN0cmluZywgYW55Pikge1xuICAgIGNvbnN0IHsgY29ubmVjdGlvbiB9ID0gdGhpcztcbiAgICBpZiAoIWNvbm5lY3Rpb24pIHRocm93IG5ldyBFcnJvcignZGlzY29ubmVjdGVkJyk7XG4gICAgY29uc3Qgc3Vicm91dGluZXMgPSBSZWZsZWN0LmdldE1ldGFkYXRhKCdzdWJyb3V0aW5lcycsIHRoaXMpIGFzIFJlY29yZDxzdHJpbmcsIElTdWJyb3V0aW5lRGVzYz47XG4gICAgaWYgKCFzdWJyb3V0aW5lcyB8fCAhUmVmbGVjdC5oYXMoc3Vicm91dGluZXMsIHByb2dyYW0pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gcHJvZ3JhbSAke3Byb2dyYW19YCk7XG4gICAgfVxuICAgIGNvbnN0IHN1YnJvdXRpbmUgPSBzdWJyb3V0aW5lc1twcm9ncmFtXTtcbiAgICBjb25zdCBwcm9wczogVHlwZWRWYWx1ZVtdID0gW107XG4gICAgaWYgKHN1YnJvdXRpbmUuYXJncykge1xuICAgICAgT2JqZWN0LmVudHJpZXMoc3Vicm91dGluZS5hcmdzKS5mb3JFYWNoKChbbmFtZSwgZGVzY10pID0+IHtcbiAgICAgICAgY29uc3QgYXJnID0gYXJncyAmJiBhcmdzW25hbWVdO1xuICAgICAgICBpZiAoIWFyZykgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBhcmcgJHtuYW1lfSBpbiBwcm9ncmFtICR7cHJvZ3JhbX1gKTtcbiAgICAgICAgcHJvcHMucHVzaChbZGVzYy50eXBlLCBhcmddKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBjb25zdCByZXEgPSBjcmVhdGVFeGVjdXRlUHJvZ3JhbUludm9jYXRpb24oXG4gICAgICB0aGlzLmFkZHJlc3MsXG4gICAgICBzdWJyb3V0aW5lLmlkLFxuICAgICAgc3Vicm91dGluZS5ub3RSZXBseSxcbiAgICAgIC4uLnByb3BzLFxuICAgICk7XG4gICAgcmV0dXJuIGNvbm5lY3Rpb24uc2VuZERhdGFncmFtKHJlcSk7XG4gIH1cbn1cblxuLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lXG5pbnRlcmZhY2UgRGV2aWNlUHJvdG90eXBlIHtcbiAgcmVhZG9ubHkgYWRkcmVzczogQWRkcmVzcztcbiAgW21pYlByb3BlcnR5OiBzdHJpbmddOiBhbnk7XG4gICRjb3VudFJlZjogbnVtYmVyO1xuICBbJHZhbHVlc106IHsgW2lkOiBudW1iZXJdOiBhbnkgfTtcbiAgWyRlcnJvcnNdOiB7IFtpZDogbnVtYmVyXTogRXJyb3IgfTtcbiAgWyRkaXJ0aWVzXTogeyBbaWQ6IG51bWJlcl06IGJvb2xlYW4gfTtcbn1cblxuZnVuY3Rpb24gZmluZE1pYkJ5VHlwZSh0eXBlOiBudW1iZXIsIHZlcnNpb24/OiBudW1iZXIpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBjb25zdCBjb25mID0gcGF0aC5yZXNvbHZlKGNvbmZpZ0RpciB8fCAnL3RtcCcsICdjb25maWdzdG9yZScsIHBrZ05hbWUpO1xuICBjb25zdCB2YWxpZGF0ZSA9IENvbmZpZ1YuZGVjb2RlKHJlcXVpcmUoY29uZikpO1xuICBpZiAodmFsaWRhdGUuaXNMZWZ0KCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgY29uZmlnIGZpbGUgJHtjb25mfVxuICAke1BhdGhSZXBvcnRlci5yZXBvcnQodmFsaWRhdGUpfWApO1xuICB9XG4gIGNvbnN0IHsgbWliVHlwZXMgfSA9IHZhbGlkYXRlLnZhbHVlO1xuICBjb25zdCBtaWJzID0gbWliVHlwZXMhW3R5cGVdO1xuICBpZiAobWlicyAmJiBtaWJzLmxlbmd0aCkge1xuICAgIGxldCBtaWJUeXBlID0gbWlic1swXTtcbiAgICBpZiAodmVyc2lvbiAmJiBtaWJzLmxlbmd0aCA+IDEpIHtcbiAgICAgIG1pYlR5cGUgPSBfLmZpbmRMYXN0KG1pYnMsICh7IG1pblZlcnNpb24gPSAwIH0pID0+IG1pblZlcnNpb24gPD0gdmVyc2lvbikgfHwgbWliVHlwZTtcbiAgICB9XG4gICAgcmV0dXJuIG1pYlR5cGUubWliO1xuICB9XG4gIC8vIGNvbnN0IGNhY2hlTWlicyA9IE9iamVjdC5rZXlzKG1pYlR5cGVzQ2FjaGUpO1xuICAvLyBjb25zdCBjYWNoZWQgPSBjYWNoZU1pYnMuZmluZChtaWIgPT5cbiAgLy8gICBSZWZsZWN0LmdldE1ldGFkYXRhKCdkZXZpY2VUeXBlJywgbWliVHlwZXNDYWNoZVttaWJdLnByb3RvdHlwZSkgPT09IHR5cGUpO1xuICAvLyBpZiAoY2FjaGVkKSByZXR1cm4gY2FjaGVkO1xuICAvLyBjb25zdCBtaWJzID0gZ2V0TWlic1N5bmMoKTtcbiAgLy8gcmV0dXJuIF8uZGlmZmVyZW5jZShtaWJzLCBjYWNoZU1pYnMpLmZpbmQoKG1pYk5hbWUpID0+IHtcbiAgLy8gICBjb25zdCBtaWJmaWxlID0gZ2V0TWliRmlsZShtaWJOYW1lKTtcbiAgLy8gICBjb25zdCBtaWI6IElNaWJEZXZpY2UgPSByZXF1aXJlKG1pYmZpbGUpO1xuICAvLyAgIGNvbnN0IHsgdHlwZXMgfSA9IG1pYjtcbiAgLy8gICBjb25zdCBkZXZpY2UgPSB0eXBlc1ttaWIuZGV2aWNlXSBhcyBJTWliRGV2aWNlVHlwZTtcbiAgLy8gICByZXR1cm4gdG9JbnQoZGV2aWNlLmFwcGluZm8uZGV2aWNlX3R5cGUpID09PSB0eXBlO1xuICAvLyB9KTtcbn1cblxuZGVjbGFyZSBpbnRlcmZhY2UgRGV2aWNlcyB7XG4gIG9uKGV2ZW50OiAnbmV3JyB8ICdkZWxldGUnLCBkZXZpY2VMaXN0ZW5lcjogKGRldmljZTogSURldmljZSkgPT4gdm9pZCk6IHRoaXM7XG4gIG9uY2UoZXZlbnQ6ICduZXcnIHwgJ2RlbGV0ZScsIGRldmljZUxpc3RlbmVyOiAoZGV2aWNlOiBJRGV2aWNlKSA9PiB2b2lkKTogdGhpcztcbiAgYWRkTGlzdGVuZXIoZXZlbnQ6ICduZXcnIHwgJ2RlbGV0ZScsIGRldmljZUxpc3RlbmVyOiAoZGV2aWNlOiBJRGV2aWNlKSA9PiB2b2lkKTogdGhpcztcbn1cblxuZnVuY3Rpb24gZ2V0Q29uc3RydWN0b3IobWliOiBzdHJpbmcpOiBGdW5jdGlvbiB7XG4gIGxldCBjb25zdHJ1Y3RvciA9IG1pYlR5cGVzQ2FjaGVbbWliXTtcbiAgaWYgKCFjb25zdHJ1Y3Rvcikge1xuICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZVxuICAgIGZ1bmN0aW9uIERldmljZSh0aGlzOiBEZXZpY2VQcm90b3R5cGUsIGFkZHJlc3M6IEFkZHJlc3MpIHtcbiAgICAgIEV2ZW50RW1pdHRlci5hcHBseSh0aGlzKTtcbiAgICAgIHRoaXNbJHZhbHVlc10gPSB7fTtcbiAgICAgIHRoaXNbJGVycm9yc10gPSB7fTtcbiAgICAgIHRoaXNbJGRpcnRpZXNdID0ge307XG4gICAgICBSZWZsZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdhZGRyZXNzJywgd2l0aFZhbHVlKGFkZHJlc3MpKTtcbiAgICAgIHRoaXMuJGNvdW50UmVmID0gMTtcbiAgICAgIGRlYnVnKG5ldyBFcnJvcignQ1JFQVRFJykuc3RhY2spO1xuICAgICAgLy8gdGhpcy4kZGVib3VuY2VEcmFpbiA9IF8uZGVib3VuY2UodGhpcy5kcmFpbiwgMjUpO1xuICAgIH1cblxuICAgIGNvbnN0IHByb3RvdHlwZSA9IG5ldyBEZXZpY2VQcm90b3R5cGUobWliKTtcbiAgICBEZXZpY2UucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShwcm90b3R5cGUpO1xuICAgIGNvbnN0cnVjdG9yID0gRGV2aWNlO1xuICAgIG1pYlR5cGVzQ2FjaGVbbWliXSA9IGNvbnN0cnVjdG9yO1xuICB9XG4gIHJldHVybiBjb25zdHJ1Y3Rvcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE1pYlByb3RvdHlwZShtaWI6IHN0cmluZyk6IE9iamVjdCB7XG4gIHJldHVybiBnZXRDb25zdHJ1Y3RvcihtaWIpLnByb3RvdHlwZTtcbn1cblxuY2xhc3MgRGV2aWNlcyBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG4gIGdldCA9ICgpOiBJRGV2aWNlW10gPT4gXy52YWx1ZXMoZGV2aWNlTWFwKTtcblxuICBmaW5kID0gKGFkZHJlc3M6IEFkZHJlc3NQYXJhbSk6IElEZXZpY2UgfCB1bmRlZmluZWQgPT4ge1xuICAgIGNvbnN0IHRhcmdldEFkZHJlc3MgPSBuZXcgQWRkcmVzcyhhZGRyZXNzKTtcbiAgICByZXR1cm4gZGV2aWNlTWFwW3RhcmdldEFkZHJlc3MudG9TdHJpbmcoKV07XG4gIH07XG5cbiAgY3JlYXRlKGFkZHJlc3M6IEFkZHJlc3NQYXJhbSwgbWliOiBzdHJpbmcpOiBJRGV2aWNlO1xuICBjcmVhdGUoYWRkcmVzczogQWRkcmVzc1BhcmFtLCB0eXBlOiBudW1iZXIsIHZlcnNpb24/OiBudW1iZXIpOiBJRGV2aWNlO1xuICBjcmVhdGUoYWRkcmVzczogQWRkcmVzc1BhcmFtLCBtaWJPclR5cGU6IGFueSwgdmVyc2lvbj86IG51bWJlcik6IElEZXZpY2Uge1xuICAgIGxldCBtaWI6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBpZiAodHlwZW9mIG1pYk9yVHlwZSA9PT0gJ251bWJlcicpIHtcbiAgICAgIG1pYiA9IGZpbmRNaWJCeVR5cGUobWliT3JUeXBlLCB2ZXJzaW9uKTtcbiAgICAgIGlmIChtaWIgPT09IHVuZGVmaW5lZCkgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIG1pYiB0eXBlJyk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgbWliT3JUeXBlID09PSAnc3RyaW5nJykge1xuICAgICAgbWliID0gU3RyaW5nKG1pYk9yVHlwZSB8fCAnbWluaWhvc3RfdjIuMDZiJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbWliIG9yIHR5cGUgZXhwZWN0ZWQsIGdvdCAke21pYk9yVHlwZX1gKTtcbiAgICB9XG4gICAgY29uc3QgdGFyZ2V0QWRkcmVzcyA9IG5ldyBBZGRyZXNzKGFkZHJlc3MpO1xuICAgIGxldCBkZXZpY2UgPSBkZXZpY2VNYXBbdGFyZ2V0QWRkcmVzcy50b1N0cmluZygpXTtcbiAgICBpZiAoZGV2aWNlKSB7XG4gICAgICBjb25zb2xlLmFzc2VydChcbiAgICAgICAgUmVmbGVjdC5nZXRNZXRhZGF0YSgnbWliJywgZGV2aWNlKSA9PT0gbWliLFxuICAgICAgICBgbWlicyBhcmUgZGlmZmVyZW50LCBleHBlY3RlZCAke21pYn1gLFxuICAgICAgKTtcbiAgICAgIGRldmljZS5hZGRyZWYoKTtcbiAgICAgIHJldHVybiBkZXZpY2U7XG4gICAgfVxuXG4gICAgY29uc3QgY29uc3RydWN0b3IgPSBnZXRDb25zdHJ1Y3RvcihtaWIpO1xuICAgIGRldmljZSA9IFJlZmxlY3QuY29uc3RydWN0KGNvbnN0cnVjdG9yLCBbdGFyZ2V0QWRkcmVzc10pO1xuICAgIGlmICghdGFyZ2V0QWRkcmVzcy5pc0VtcHR5KSB7XG4gICAgICBkZXZpY2VNYXBbdGFyZ2V0QWRkcmVzcy50b1N0cmluZygpXSA9IGRldmljZTtcbiAgICAgIHByb2Nlc3MubmV4dFRpY2soKCkgPT4gdGhpcy5lbWl0KCduZXcnLCBkZXZpY2UpKTtcbiAgICB9XG4gICAgcmV0dXJuIGRldmljZTtcbiAgfVxufVxuXG5jb25zdCBkZXZpY2VzID0gbmV3IERldmljZXMoKTtcblxuZXhwb3J0IGRlZmF1bHQgZGV2aWNlcztcbiJdfQ==