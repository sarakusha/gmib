"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _Address = _interopRequireDefault(require("../Address"));

var _nbconst = require("../nbconst");

var _nibus = require("../nibus");

var _nms = require("./nms");

var _NmsServiceType = _interopRequireDefault(require("./NmsServiceType"));

var _NmsValueType = _interopRequireDefault(require("./NmsValueType"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const emptyBuffer = Buffer.alloc(0);

class NmsDatagram extends _nibus.NibusDatagram {
  static isNmsFrame(frame) {
    return frame[0] === _nbconst.PREAMBLE && frame.length > 15 && frame[_nbconst.Offsets.PROTOCOL] === 1 && frame[_nbconst.Offsets.LENGTH] > 3;
  }

  constructor(frameOrOptions) {
    if (Buffer.isBuffer(frameOrOptions)) {
      super(frameOrOptions);

      _defineProperty(this, "isResponse", void 0);

      _defineProperty(this, "notReply", void 0);

      _defineProperty(this, "service", void 0);

      _defineProperty(this, "id", void 0);

      _defineProperty(this, "nms", void 0);

      _defineProperty(this, "timeout", void 0);
    } else {
      const options = {
        source: new _Address.default('auto'),
        isResponse: false,
        notReply: false,
        nms: emptyBuffer,
        ...frameOrOptions
      };
      console.assert(options.nms.length <= _nbconst.NMS_MAX_DATA_LENGTH); // fix: NMS batch read

      const nmsLength = options.service !== _NmsServiceType.default.Read ? options.nms.length & 0x3f : 0;
      const nibusData = [(options.service & 0x1f) << 3 | (options.isResponse ? 4 : 0) | options.id >> 8 & 3, options.id & 0xff, (options.notReply ? 0x80 : 0) | nmsLength, ...options.nms];
      const nibusOptions = Object.assign({
        data: Buffer.from(nibusData),
        protocol: 1
      }, options);
      super(nibusOptions);

      _defineProperty(this, "isResponse", void 0);

      _defineProperty(this, "notReply", void 0);

      _defineProperty(this, "service", void 0);

      _defineProperty(this, "id", void 0);

      _defineProperty(this, "nms", void 0);

      _defineProperty(this, "timeout", void 0);

      if (frameOrOptions.timeout !== undefined) {
        this.timeout = frameOrOptions.timeout;
      }
    }

    const {
      data
    } = this;
    this.id = (data[0] & 3) << 8 | data[1];
    this.service = data[0] >> 3;
    this.isResponse = !!(data[0] & 4);
    this.notReply = !!(data[2] & 0x80); // fix: NMS batch read

    const nmsLength = this.service !== _NmsServiceType.default.Read ? data[2] & 0x3F : data.length - 3;
    this.nms = this.data.slice(3, 3 + nmsLength);
  }

  get valueType() {
    const {
      nms,
      service
    } = this;

    switch (service) {
      case _NmsServiceType.default.Read:
        if (nms.length > 2) {
          return this.nms[1];
        }

        break;

      case _NmsServiceType.default.InformationReport:
        return this.nms[0];

      case _NmsServiceType.default.UploadSegment:
        return _NmsValueType.default.UInt32;

      case _NmsServiceType.default.RequestDomainUpload:
        return _NmsValueType.default.UInt32;

      case _NmsServiceType.default.RequestDomainDownload:
        return _NmsValueType.default.UInt32;

      default:
        break;
    }

    return undefined;
  }

  get status() {
    if (this.nms.length === 0 || !this.isResponse) {
      return undefined;
    }

    return this.nms.readInt8(0);
  }

  get value() {
    const {
      valueType,
      nms,
      service
    } = this;

    if (valueType === undefined) {
      return undefined;
    }

    const {
      length
    } = nms;

    const safeDecode = (index, type = valueType) => length < index + (0, _nms.getSizeOf)(type) ? undefined : (0, _nms.decodeValue)(type, nms, index);

    switch (service) {
      case _NmsServiceType.default.Read:
        return safeDecode(2);

      case _NmsServiceType.default.InformationReport:
        return safeDecode(1);

      case _NmsServiceType.default.RequestDomainUpload:
        return safeDecode(1);

      case _NmsServiceType.default.UploadSegment:
        return {
          data: nms.slice(5),
          offset: safeDecode(1)
        };

      case _NmsServiceType.default.RequestDomainDownload:
        return safeDecode(1);

      default:
        return undefined;
    }
  }

  isResponseFor(req) {
    const {
      isResponse,
      service,
      source,
      id
    } = this;
    return isResponse && service === req.service && (source.equals(req.destination) || id === req.id && req.destination.isEmpty);
  }

  toJSON() {
    const {
      data,
      ...props
    } = super.toJSON();
    const result = { ...props,
      id: this.id,
      service: _NmsServiceType.default[this.service],
      data: undefined
    };

    if (this.isResponse || this.service === _NmsServiceType.default.InformationReport) {
      if (this.valueType !== undefined) {
        // result.value = JSON.stringify(this.value);
        result.value = this.value;
        result.valueType = _NmsValueType.default[this.valueType];
      }

      result.status = this.status;
    } else {
      result.notReply = this.notReply;
      result.nms = Buffer.from(this.nms);
    }

    return result;
  }

}

exports.default = NmsDatagram;