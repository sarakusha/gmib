"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

require("source-map-support/register");

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ubXMvTm1zRGF0YWdyYW0udHMiXSwibmFtZXMiOlsiZW1wdHlCdWZmZXIiLCJCdWZmZXIiLCJhbGxvYyIsIk5tc0RhdGFncmFtIiwiTmlidXNEYXRhZ3JhbSIsImlzTm1zRnJhbWUiLCJmcmFtZSIsIlBSRUFNQkxFIiwibGVuZ3RoIiwiT2Zmc2V0cyIsIlBST1RPQ09MIiwiTEVOR1RIIiwiY29uc3RydWN0b3IiLCJmcmFtZU9yT3B0aW9ucyIsImlzQnVmZmVyIiwib3B0aW9ucyIsInNvdXJjZSIsIkFkZHJlc3MiLCJpc1Jlc3BvbnNlIiwibm90UmVwbHkiLCJubXMiLCJjb25zb2xlIiwiYXNzZXJ0IiwiTk1TX01BWF9EQVRBX0xFTkdUSCIsIm5tc0xlbmd0aCIsInNlcnZpY2UiLCJObXNTZXJ2aWNlVHlwZSIsIlJlYWQiLCJuaWJ1c0RhdGEiLCJpZCIsIm5pYnVzT3B0aW9ucyIsIk9iamVjdCIsImFzc2lnbiIsImRhdGEiLCJmcm9tIiwicHJvdG9jb2wiLCJ0aW1lb3V0IiwidW5kZWZpbmVkIiwic2xpY2UiLCJ2YWx1ZVR5cGUiLCJJbmZvcm1hdGlvblJlcG9ydCIsIlVwbG9hZFNlZ21lbnQiLCJObXNWYWx1ZVR5cGUiLCJVSW50MzIiLCJSZXF1ZXN0RG9tYWluVXBsb2FkIiwiUmVxdWVzdERvbWFpbkRvd25sb2FkIiwic3RhdHVzIiwicmVhZEludDgiLCJ2YWx1ZSIsInNhZmVEZWNvZGUiLCJpbmRleCIsInR5cGUiLCJvZmZzZXQiLCJpc1Jlc3BvbnNlRm9yIiwicmVxIiwiZXF1YWxzIiwiZGVzdGluYXRpb24iLCJpc0VtcHR5IiwidG9KU09OIiwicHJvcHMiLCJyZXN1bHQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQVVBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOzs7Ozs7QUFZQSxNQUFNQSxXQUFXLEdBQUdDLE1BQU0sQ0FBQ0MsS0FBUCxDQUFhLENBQWIsQ0FBcEI7O0FBZWUsTUFBTUMsV0FBTixTQUEwQkMsb0JBQTFC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QUFDekIsRUFBWCxJQUFpQnlCLEdBQUcsQ0FBQ0UsV0FBSixDQUFnQkMsT0FEbkUsQ0FBUDtBQUVEOztBQUVNQyxFQUFBQSxNQUFQLEdBQWtDO0FBQ2hDLFVBQU07QUFBRXpCLE1BQUFBLElBQUY7QUFBUSxTQUFHMEI7QUFBWCxRQUFxQixNQUFNRCxNQUFOLEVBQTNCO0FBQ0EsVUFBTUUsTUFBd0IsR0FBRyxFQUMvQixHQUFHRCxLQUQ0QjtBQUUvQjlCLE1BQUFBLEVBQUUsRUFBRSxLQUFLQSxFQUZzQjtBQUcvQkosTUFBQUEsT0FBTyxFQUFFQyx3QkFBZSxLQUFLRCxPQUFwQixDQUhzQjtBQUkvQlEsTUFBQUEsSUFBSSxFQUFFSTtBQUp5QixLQUFqQzs7QUFNQSxRQUFJLEtBQUtuQixVQUFMLElBQW1CLEtBQUtPLE9BQUwsS0FBaUJDLHdCQUFlYyxpQkFBdkQsRUFBMEU7QUFDeEUsVUFBSSxLQUFLRCxTQUFMLEtBQW1CRixTQUF2QixFQUFrQztBQUNoQztBQUNBdUIsUUFBQUEsTUFBTSxDQUFDWixLQUFQLEdBQWUsS0FBS0EsS0FBcEI7QUFDQVksUUFBQUEsTUFBTSxDQUFDckIsU0FBUCxHQUFtQkcsc0JBQWEsS0FBS0gsU0FBbEIsQ0FBbkI7QUFDRDs7QUFDRHFCLE1BQUFBLE1BQU0sQ0FBQ2QsTUFBUCxHQUFnQixLQUFLQSxNQUFyQjtBQUNELEtBUEQsTUFPTztBQUNMYyxNQUFBQSxNQUFNLENBQUN6QyxRQUFQLEdBQWtCLEtBQUtBLFFBQXZCO0FBQ0F5QyxNQUFBQSxNQUFNLENBQUN4QyxHQUFQLEdBQWFuQixNQUFNLENBQUNpQyxJQUFQLENBQVksS0FBS2QsR0FBakIsQ0FBYjtBQUNEOztBQUNELFdBQU93QyxNQUFQO0FBQ0Q7O0FBM0kyRSIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IChjKSAyMDE5LiBPT08gTmF0YS1JbmZvXG4gKiBAYXV0aG9yIEFuZHJlaSBTYXJha2VldiA8YXZzQG5hdGEtaW5mby5ydT5cbiAqXG4gKiBUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgXCJAbmF0YVwiIHByb2plY3QuXG4gKiBGb3IgdGhlIGZ1bGwgY29weXJpZ2h0IGFuZCBsaWNlbnNlIGluZm9ybWF0aW9uLCBwbGVhc2Ugdmlld1xuICogdGhlIEVVTEEgZmlsZSB0aGF0IHdhcyBkaXN0cmlidXRlZCB3aXRoIHRoaXMgc291cmNlIGNvZGUuXG4gKi9cblxuaW1wb3J0IEFkZHJlc3MgZnJvbSAnLi4vQWRkcmVzcyc7XG5pbXBvcnQgeyBOTVNfTUFYX0RBVEFfTEVOR1RILCBPZmZzZXRzLCBQUkVBTUJMRSB9IGZyb20gJy4uL25iY29uc3QnO1xuaW1wb3J0IHsgSU5pYnVzQ29tbW9uLCBJTmlidXNEYXRhZ3JhbUpTT04sIElOaWJ1c09wdGlvbnMsIE5pYnVzRGF0YWdyYW0sIFByb3RvY29sIH0gZnJvbSAnLi4vbmlidXMnO1xuaW1wb3J0IHsgZGVjb2RlVmFsdWUsIGdldFNpemVPZiB9IGZyb20gJy4vbm1zJztcbmltcG9ydCBObXNTZXJ2aWNlVHlwZSBmcm9tICcuL05tc1NlcnZpY2VUeXBlJztcbmltcG9ydCBObXNWYWx1ZVR5cGUgZnJvbSAnLi9ObXNWYWx1ZVR5cGUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElObXNPcHRpb25zIGV4dGVuZHMgSU5pYnVzQ29tbW9uIHtcbiAgaWQ6IG51bWJlcjtcbiAgc2VydmljZTogTm1zU2VydmljZVR5cGU7XG4gIG5tcz86IEJ1ZmZlcjtcbiAgaXNSZXNwb25zZT86IGJvb2xlYW47XG4gIG5vdFJlcGx5PzogYm9vbGVhbjtcbiAgc3RhdHVzPzogbnVtYmVyO1xuICB0aW1lb3V0PzogbnVtYmVyO1xufVxuXG5jb25zdCBlbXB0eUJ1ZmZlciA9IEJ1ZmZlci5hbGxvYygwKTtcblxuZXhwb3J0IGludGVyZmFjZSBJTm1zRGF0YWdyYW1KU09OIGV4dGVuZHMgSU5pYnVzRGF0YWdyYW1KU09OIHtcbiAgcHJvdG9jb2w6IHN0cmluZztcbiAgZGF0YT86IG5ldmVyO1xuICBpZDogbnVtYmVyO1xuICBzZXJ2aWNlOiBzdHJpbmc7XG4gIG5tcz86IEJ1ZmZlcjtcbiAgaXNSZXNwb25zZT86IGJvb2xlYW47XG4gIG5vdFJlcGx5PzogYm9vbGVhbjtcbiAgdmFsdWU/OiBzdHJpbmc7XG4gIHZhbHVlVHlwZT86IHN0cmluZztcbiAgc3RhdHVzPzogbnVtYmVyO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBObXNEYXRhZ3JhbSBleHRlbmRzIE5pYnVzRGF0YWdyYW0gaW1wbGVtZW50cyBJTm1zT3B0aW9ucyB7XG4gIHB1YmxpYyBzdGF0aWMgaXNObXNGcmFtZShmcmFtZTogQnVmZmVyKSB7XG4gICAgcmV0dXJuIGZyYW1lWzBdID09PSBQUkVBTUJMRSAmJiBmcmFtZS5sZW5ndGggPiAxNSAmJiBmcmFtZVtPZmZzZXRzLlBST1RPQ09MXSA9PT0gMVxuICAgICAgJiYgZnJhbWVbT2Zmc2V0cy5MRU5HVEhdID4gMztcbiAgfVxuXG4gIHB1YmxpYyByZWFkb25seSBpc1Jlc3BvbnNlOiBib29sZWFuO1xuICBwdWJsaWMgcmVhZG9ubHkgbm90UmVwbHk6IGJvb2xlYW47XG4gIHB1YmxpYyByZWFkb25seSBzZXJ2aWNlOiBudW1iZXI7XG4gIHB1YmxpYyByZWFkb25seSBpZDogbnVtYmVyO1xuICBwdWJsaWMgcmVhZG9ubHkgbm1zOiBCdWZmZXI7XG4gIHB1YmxpYyByZWFkb25seSB0aW1lb3V0PzogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKGZyYW1lT3JPcHRpb25zOiBCdWZmZXIgfCBJTm1zT3B0aW9ucykge1xuICAgIGlmIChCdWZmZXIuaXNCdWZmZXIoZnJhbWVPck9wdGlvbnMpKSB7XG4gICAgICBzdXBlcihmcmFtZU9yT3B0aW9ucyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHNvdXJjZTogbmV3IEFkZHJlc3MoJ2F1dG8nKSxcbiAgICAgICAgaXNSZXNwb25zZTogZmFsc2UsXG4gICAgICAgIG5vdFJlcGx5OiBmYWxzZSxcbiAgICAgICAgbm1zOiBlbXB0eUJ1ZmZlcixcbiAgICAgICAgLi4uZnJhbWVPck9wdGlvbnMsXG4gICAgICB9O1xuICAgICAgY29uc29sZS5hc3NlcnQob3B0aW9ucy5ubXMubGVuZ3RoIDw9IE5NU19NQVhfREFUQV9MRU5HVEgpO1xuICAgICAgLy8gZml4OiBOTVMgYmF0Y2ggcmVhZFxuICAgICAgY29uc3Qgbm1zTGVuZ3RoID0gb3B0aW9ucy5zZXJ2aWNlICE9PSBObXNTZXJ2aWNlVHlwZS5SZWFkXG4gICAgICAgID8gKG9wdGlvbnMubm1zLmxlbmd0aCAmIDB4M2YpXG4gICAgICAgIDogMDtcbiAgICAgIGNvbnN0IG5pYnVzRGF0YSA9IFtcbiAgICAgICAgKChvcHRpb25zLnNlcnZpY2UgJiAweDFmKSA8PCAzKSB8IChvcHRpb25zLmlzUmVzcG9uc2UgPyA0IDogMCkgfCAoKG9wdGlvbnMuaWQgPj4gOCkgJiAzKSxcbiAgICAgICAgb3B0aW9ucy5pZCAmIDB4ZmYsXG4gICAgICAgIChvcHRpb25zLm5vdFJlcGx5ID8gMHg4MCA6IDApIHwgbm1zTGVuZ3RoLFxuICAgICAgICAuLi5vcHRpb25zLm5tcyxcbiAgICAgIF07XG4gICAgICBjb25zdCBuaWJ1c09wdGlvbnM6IElOaWJ1c09wdGlvbnMgPSBPYmplY3QuYXNzaWduKHtcbiAgICAgICAgZGF0YTogQnVmZmVyLmZyb20obmlidXNEYXRhKSxcbiAgICAgICAgcHJvdG9jb2w6IDEsXG4gICAgICB9LCBvcHRpb25zKTtcbiAgICAgIHN1cGVyKG5pYnVzT3B0aW9ucyk7XG4gICAgICBpZiAoZnJhbWVPck9wdGlvbnMudGltZW91dCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRoaXMudGltZW91dCA9IGZyYW1lT3JPcHRpb25zLnRpbWVvdXQ7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IHsgZGF0YSB9ID0gdGhpcztcbiAgICB0aGlzLmlkID0gKChkYXRhWzBdICYgMykgPDwgOCkgfCBkYXRhWzFdO1xuICAgIHRoaXMuc2VydmljZSA9IGRhdGFbMF0gPj4gMztcbiAgICB0aGlzLmlzUmVzcG9uc2UgPSAhIShkYXRhWzBdICYgNCk7XG4gICAgdGhpcy5ub3RSZXBseSA9ICEhKGRhdGFbMl0gJiAweDgwKTtcbiAgICAvLyBmaXg6IE5NUyBiYXRjaCByZWFkXG4gICAgY29uc3Qgbm1zTGVuZ3RoID0gdGhpcy5zZXJ2aWNlICE9PSBObXNTZXJ2aWNlVHlwZS5SZWFkXG4gICAgICA/IGRhdGFbMl0gJiAweDNGXG4gICAgICA6IGRhdGEubGVuZ3RoIC0gMztcbiAgICB0aGlzLm5tcyA9IHRoaXMuZGF0YS5zbGljZSgzLCAzICsgbm1zTGVuZ3RoKTtcbiAgfVxuXG4gIGdldCB2YWx1ZVR5cGUoKSB7XG4gICAgY29uc3QgeyBubXMsIHNlcnZpY2UgfSA9IHRoaXM7XG4gICAgc3dpdGNoIChzZXJ2aWNlKSB7XG4gICAgICBjYXNlIE5tc1NlcnZpY2VUeXBlLlJlYWQ6XG4gICAgICAgIGlmIChubXMubGVuZ3RoID4gMikge1xuICAgICAgICAgIHJldHVybiB0aGlzLm5tc1sxXTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgTm1zU2VydmljZVR5cGUuSW5mb3JtYXRpb25SZXBvcnQ6XG4gICAgICAgIHJldHVybiB0aGlzLm5tc1swXTtcbiAgICAgIGNhc2UgTm1zU2VydmljZVR5cGUuVXBsb2FkU2VnbWVudDpcbiAgICAgICAgcmV0dXJuIE5tc1ZhbHVlVHlwZS5VSW50MzI7XG4gICAgICBjYXNlIE5tc1NlcnZpY2VUeXBlLlJlcXVlc3REb21haW5VcGxvYWQ6XG4gICAgICAgIHJldHVybiBObXNWYWx1ZVR5cGUuVUludDMyO1xuICAgICAgY2FzZSBObXNTZXJ2aWNlVHlwZS5SZXF1ZXN0RG9tYWluRG93bmxvYWQ6XG4gICAgICAgIHJldHVybiBObXNWYWx1ZVR5cGUuVUludDMyO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICBnZXQgc3RhdHVzKCkge1xuICAgIGlmICh0aGlzLm5tcy5sZW5ndGggPT09IDAgfHwgIXRoaXMuaXNSZXNwb25zZSkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMubm1zLnJlYWRJbnQ4KDApO1xuICB9XG5cbiAgZ2V0IHZhbHVlKCkge1xuICAgIGNvbnN0IHsgdmFsdWVUeXBlLCBubXMsIHNlcnZpY2UgfSA9IHRoaXM7XG4gICAgaWYgKHZhbHVlVHlwZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBjb25zdCB7IGxlbmd0aCB9ID0gbm1zO1xuICAgIGNvbnN0IHNhZmVEZWNvZGUgPSAoaW5kZXg6IG51bWJlciwgdHlwZSA9IHZhbHVlVHlwZSkgPT4gKGxlbmd0aCA8IGluZGV4ICsgZ2V0U2l6ZU9mKHR5cGUpXG4gICAgICA/IHVuZGVmaW5lZFxuICAgICAgOiBkZWNvZGVWYWx1ZSh0eXBlLCBubXMsIGluZGV4KSk7XG4gICAgc3dpdGNoIChzZXJ2aWNlKSB7XG4gICAgICBjYXNlIE5tc1NlcnZpY2VUeXBlLlJlYWQ6XG4gICAgICAgIHJldHVybiBzYWZlRGVjb2RlKDIpO1xuICAgICAgY2FzZSBObXNTZXJ2aWNlVHlwZS5JbmZvcm1hdGlvblJlcG9ydDpcbiAgICAgICAgcmV0dXJuIHNhZmVEZWNvZGUoMSk7XG4gICAgICBjYXNlIE5tc1NlcnZpY2VUeXBlLlJlcXVlc3REb21haW5VcGxvYWQ6XG4gICAgICAgIHJldHVybiBzYWZlRGVjb2RlKDEpO1xuICAgICAgY2FzZSBObXNTZXJ2aWNlVHlwZS5VcGxvYWRTZWdtZW50OlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGRhdGE6IG5tcy5zbGljZSg1KSxcbiAgICAgICAgICBvZmZzZXQ6IHNhZmVEZWNvZGUoMSksXG4gICAgICAgIH07XG4gICAgICBjYXNlIE5tc1NlcnZpY2VUeXBlLlJlcXVlc3REb21haW5Eb3dubG9hZDpcbiAgICAgICAgcmV0dXJuIHNhZmVEZWNvZGUoMSk7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBpc1Jlc3BvbnNlRm9yKHJlcTogTm1zRGF0YWdyYW0pIHtcbiAgICBjb25zdCB7IGlzUmVzcG9uc2UsIHNlcnZpY2UsIHNvdXJjZSwgaWQgfSA9IHRoaXM7XG4gICAgcmV0dXJuIGlzUmVzcG9uc2UgJiYgc2VydmljZSA9PT0gcmVxLnNlcnZpY2VcbiAgICAgICYmIChzb3VyY2UuZXF1YWxzKHJlcS5kZXN0aW5hdGlvbikgfHwgKGlkID09PSByZXEuaWQgJiYgcmVxLmRlc3RpbmF0aW9uLmlzRW1wdHkpKTtcbiAgfVxuXG4gIHB1YmxpYyB0b0pTT04oKTogSU5tc0RhdGFncmFtSlNPTiB7XG4gICAgY29uc3QgeyBkYXRhLCAuLi5wcm9wcyB9ID0gc3VwZXIudG9KU09OKCk7XG4gICAgY29uc3QgcmVzdWx0OiBJTm1zRGF0YWdyYW1KU09OID0ge1xuICAgICAgLi4ucHJvcHMsXG4gICAgICBpZDogdGhpcy5pZCxcbiAgICAgIHNlcnZpY2U6IE5tc1NlcnZpY2VUeXBlW3RoaXMuc2VydmljZV0sXG4gICAgICBkYXRhOiB1bmRlZmluZWQsXG4gICAgfTtcbiAgICBpZiAodGhpcy5pc1Jlc3BvbnNlIHx8IHRoaXMuc2VydmljZSA9PT0gTm1zU2VydmljZVR5cGUuSW5mb3JtYXRpb25SZXBvcnQpIHtcbiAgICAgIGlmICh0aGlzLnZhbHVlVHlwZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIHJlc3VsdC52YWx1ZSA9IEpTT04uc3RyaW5naWZ5KHRoaXMudmFsdWUpO1xuICAgICAgICByZXN1bHQudmFsdWUgPSB0aGlzLnZhbHVlO1xuICAgICAgICByZXN1bHQudmFsdWVUeXBlID0gTm1zVmFsdWVUeXBlW3RoaXMudmFsdWVUeXBlXTtcbiAgICAgIH1cbiAgICAgIHJlc3VsdC5zdGF0dXMgPSB0aGlzLnN0YXR1cztcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0Lm5vdFJlcGx5ID0gdGhpcy5ub3RSZXBseTtcbiAgICAgIHJlc3VsdC5ubXMgPSBCdWZmZXIuZnJvbSh0aGlzLm5tcyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cbiJdfQ==