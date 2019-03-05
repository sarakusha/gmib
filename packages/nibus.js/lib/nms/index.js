"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createNmsRead = createNmsRead;
exports.createNmsWrite = createNmsWrite;
exports.createNmsInitiateUploadSequence = createNmsInitiateUploadSequence;
exports.createNmsRequestDomainUpload = createNmsRequestDomainUpload;
exports.createNmsUploadSegment = createNmsUploadSegment;
exports.createNmsRequestDomainDownload = createNmsRequestDomainDownload;
exports.createNmsInitiateDownloadSequence = createNmsInitiateDownloadSequence;
exports.createNmsDownloadSegment = createNmsDownloadSegment;
exports.createNmsTerminateDownloadSequence = createNmsTerminateDownloadSequence;
exports.createNmsVerifyDomainChecksum = createNmsVerifyDomainChecksum;
Object.defineProperty(exports, "getNmsType", {
  enumerable: true,
  get: function () {
    return _nms.getNmsType;
  }
});
Object.defineProperty(exports, "NmsDatagram", {
  enumerable: true,
  get: function () {
    return _NmsDatagram.default;
  }
});
Object.defineProperty(exports, "NmsServiceType", {
  enumerable: true,
  get: function () {
    return _NmsServiceType.default;
  }
});
Object.defineProperty(exports, "NmsValueType", {
  enumerable: true,
  get: function () {
    return _NmsValueType.default;
  }
});

var _lodash = _interopRequireDefault(require("lodash"));

var _nbconst = require("../nbconst");

var _nms = require("./nms");

var _NmsDatagram = _interopRequireDefault(require("./NmsDatagram"));

var _NmsServiceType = _interopRequireDefault(require("./NmsServiceType"));

var _NmsValueType = _interopRequireDefault(require("./NmsValueType"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function createNmsRead(destination, ...ids) {
  if (ids.length > 21) {
    throw new Error('To many properties (21)');
  }

  const [id, ...rest] = ids;

  const nms = _lodash.default.flatten(rest.map(next => [_NmsServiceType.default.Read << 3 | next >> 8, next & 0xff, 0]));

  const datagram = new _NmsDatagram.default({
    destination,
    id,
    isResponsible: true,
    nms: Buffer.from(nms),
    service: _NmsServiceType.default.Read
  }); // if (ids.length > 1) {
  //   datagram.data[2] = datagram.data[2] & 0xC0;
  // }

  return datagram;
}

function createNmsWrite(destination, id, type, value, isResponsible = true) {
  const nms = (0, _nms.encodeValue)(type, value);
  return new _NmsDatagram.default({
    destination,
    id,
    isResponsible,
    nms,
    service: _NmsServiceType.default.Write
  });
}

function createNmsInitiateUploadSequence(destination, id) {
  return new _NmsDatagram.default({
    destination,
    id,
    service: _NmsServiceType.default.InitiateUploadSequence
  });
}

function createNmsRequestDomainUpload(destination, domain) {
  if (domain.length !== 8) {
    throw new Error('domain must be string of 8 characters');
  }

  return new _NmsDatagram.default({
    destination,
    id: 0,
    nms: Buffer.from(domain, 'ascii'),
    service: _NmsServiceType.default.RequestDomainUpload
  });
}

function createNmsUploadSegment(destination, id, offset, length) {
  if (offset < 0 || 0xFFFF < offset) {
    throw new Error('Invalid offset');
  }

  if (length < 0 || 255 < length) {
    throw new Error('Invalid length');
  }

  const nms = Buffer.alloc(5);
  nms.writeUInt32LE(offset, 0);
  nms.writeUInt8(length, 4);
  return new _NmsDatagram.default({
    destination,
    id,
    nms,
    service: _NmsServiceType.default.UploadSegment
  });
}

function createNmsRequestDomainDownload(destination, domain) {
  if (domain.length !== 8) {
    throw new Error('domain must be string of 8 characters');
  }

  return new _NmsDatagram.default({
    destination,
    id: 0,
    nms: Buffer.from(domain, 'ascii'),
    service: _NmsServiceType.default.RequestDomainDownload
  });
}

function createNmsInitiateDownloadSequence(destination, id) {
  return new _NmsDatagram.default({
    destination,
    id,
    service: _NmsServiceType.default.InitiateDownloadSequence
  });
}

function createNmsDownloadSegment(destination, id, offset, data) {
  if (offset < 0 || 0xFFFF < offset) {
    throw new Error('Invalid offset');
  }

  const max = _nbconst.NMS_MAX_DATA_LENGTH - 4;

  if (data.length > max) {
    throw new Error(`Too big data. No more than ${max} bytes at a time`);
  }

  const ofs = Buffer.alloc(4, 0, 'binary');
  ofs.writeUInt32LE(offset, 0);
  return new _NmsDatagram.default({
    destination,
    id,
    nms: Buffer.concat([ofs, data]),
    service: _NmsServiceType.default.DownloadSegment
  });
}

function createNmsTerminateDownloadSequence(destination, id) {
  return new _NmsDatagram.default({
    destination,
    id,
    service: _NmsServiceType.default.TerminateDownloadSequence
  });
}

function createNmsVerifyDomainChecksum(destination, id, offset, size, crc) {
  if (offset < 0 || 0xFFFF < offset) {
    throw new Error('Invalid offset');
  }

  if (size < 0 || 0xFFFF < size) {
    throw new Error('Invalid size');
  }

  const nms = Buffer.alloc(10, 0, 'binary');
  nms.writeUInt32LE(offset, 0);
  nms.writeUInt32LE(size, 4);
  nms.writeUInt16LE(crc, 8);
  return new _NmsDatagram.default({
    destination,
    id,
    nms,
    service: _NmsServiceType.default.VerifyDomainChecksum
  });
}