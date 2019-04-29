"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

require("source-map-support/register");

var _Address = _interopRequireDefault(require("../Address"));

var _nbconst = require("../nbconst");

var _nibus = require("../nibus");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class SarpDatagram extends _nibus.NibusDatagram {
  static isSarpFrame(frame) {
    return Buffer.isBuffer(frame) && frame.length === _nbconst.Offsets.DATA + 12 + 2 && frame[_nbconst.Offsets.PROTOCOL] === 2 && frame[_nbconst.Offsets.LENGTH] === 13;
  }

  constructor(frameOrOptions) {
    if (Buffer.isBuffer(frameOrOptions)) {
      super(frameOrOptions);

      _defineProperty(this, "isResponse", void 0);

      _defineProperty(this, "queryType", void 0);

      _defineProperty(this, "queryParam", void 0);

      _defineProperty(this, "mac", void 0);
    } else {
      const options = {
        isResponse: false,
        mac: _Address.default.empty.raw,
        ...frameOrOptions
      };

      if (options.queryParam.length !== 5) {
        throw new Error('Invalid query param');
      }

      if (options.mac.length !== 6) {
        throw new Error('Invalid mac param');
      }

      const nibusData = [(options.isResponse ? 0x80 : 0) | options.queryType, ...options.queryParam, ...options.mac];
      const nibusOptions = Object.assign({
        data: Buffer.from(nibusData),
        protocol: 2
      }, options);
      super(nibusOptions);

      _defineProperty(this, "isResponse", void 0);

      _defineProperty(this, "queryType", void 0);

      _defineProperty(this, "queryParam", void 0);

      _defineProperty(this, "mac", void 0);
    }

    const {
      data
    } = this;
    console.assert(data.length === 12, 'Unexpected sarp length');
    this.isResponse = (data[0] & 0x80) !== 0;
    this.queryType = data[0] & 0x0f;
    this.queryParam = data.slice(1, 6);
    this.mac = data.slice(6);
    Object.freeze(this);
  }

  get deviceType() {
    if (this.isResponse) return this.queryParam.readUInt16BE(3);
  }

}

exports.default = SarpDatagram;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zYXJwL1NhcnBEYXRhZ3JhbS50cyJdLCJuYW1lcyI6WyJTYXJwRGF0YWdyYW0iLCJOaWJ1c0RhdGFncmFtIiwiaXNTYXJwRnJhbWUiLCJmcmFtZSIsIkJ1ZmZlciIsImlzQnVmZmVyIiwibGVuZ3RoIiwiT2Zmc2V0cyIsIkRBVEEiLCJQUk9UT0NPTCIsIkxFTkdUSCIsImNvbnN0cnVjdG9yIiwiZnJhbWVPck9wdGlvbnMiLCJvcHRpb25zIiwiaXNSZXNwb25zZSIsIm1hYyIsIkFkZHJlc3MiLCJlbXB0eSIsInJhdyIsInF1ZXJ5UGFyYW0iLCJFcnJvciIsIm5pYnVzRGF0YSIsInF1ZXJ5VHlwZSIsIm5pYnVzT3B0aW9ucyIsIk9iamVjdCIsImFzc2lnbiIsImRhdGEiLCJmcm9tIiwicHJvdG9jb2wiLCJjb25zb2xlIiwiYXNzZXJ0Iiwic2xpY2UiLCJmcmVlemUiLCJkZXZpY2VUeXBlIiwicmVhZFVJbnQxNkJFIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFVQTs7QUFDQTs7QUFDQTs7Ozs7O0FBVWUsTUFBTUEsWUFBTixTQUEyQkMsb0JBQTNCLENBQWlFO0FBQzlFLFNBQWNDLFdBQWQsQ0FBMEJDLEtBQTFCLEVBQXlDO0FBQ3ZDLFdBQU9DLE1BQU0sQ0FBQ0MsUUFBUCxDQUFnQkYsS0FBaEIsS0FBMEJBLEtBQUssQ0FBQ0csTUFBTixLQUFpQkMsaUJBQVFDLElBQVIsR0FBZSxFQUFmLEdBQW9CLENBQS9ELElBQ0ZMLEtBQUssQ0FBQ0ksaUJBQVFFLFFBQVQsQ0FBTCxLQUE0QixDQUQxQixJQUMrQk4sS0FBSyxDQUFDSSxpQkFBUUcsTUFBVCxDQUFMLEtBQTBCLEVBRGhFO0FBRUQ7O0FBT0RDLEVBQUFBLFdBQVcsQ0FBQ0MsY0FBRCxFQUF3QztBQUNqRCxRQUFJUixNQUFNLENBQUNDLFFBQVAsQ0FBZ0JPLGNBQWhCLENBQUosRUFBcUM7QUFDbkMsWUFBTUEsY0FBTjs7QUFEbUM7O0FBQUE7O0FBQUE7O0FBQUE7QUFFcEMsS0FGRCxNQUVPO0FBQ0wsWUFBTUMsT0FBTyxHQUFHO0FBQ2RDLFFBQUFBLFVBQVUsRUFBRSxLQURFO0FBRWRDLFFBQUFBLEdBQUcsRUFBRUMsaUJBQVFDLEtBQVIsQ0FBY0MsR0FGTDtBQUdkLFdBQUdOO0FBSFcsT0FBaEI7O0FBS0EsVUFBSUMsT0FBTyxDQUFDTSxVQUFSLENBQW1CYixNQUFuQixLQUE4QixDQUFsQyxFQUFxQztBQUNuQyxjQUFNLElBQUljLEtBQUosQ0FBVSxxQkFBVixDQUFOO0FBQ0Q7O0FBQ0QsVUFBSVAsT0FBTyxDQUFDRSxHQUFSLENBQVlULE1BQVosS0FBdUIsQ0FBM0IsRUFBOEI7QUFDNUIsY0FBTSxJQUFJYyxLQUFKLENBQVUsbUJBQVYsQ0FBTjtBQUNEOztBQUNELFlBQU1DLFNBQVMsR0FBRyxDQUNoQixDQUFDUixPQUFPLENBQUNDLFVBQVIsR0FBcUIsSUFBckIsR0FBNEIsQ0FBN0IsSUFBbUNELE9BQU8sQ0FBQ1MsU0FEM0IsRUFFaEIsR0FBR1QsT0FBTyxDQUFDTSxVQUZLLEVBR2hCLEdBQUdOLE9BQU8sQ0FBQ0UsR0FISyxDQUFsQjtBQU1BLFlBQU1RLFlBQTJCLEdBQUdDLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjO0FBQ2hEQyxRQUFBQSxJQUFJLEVBQUV0QixNQUFNLENBQUN1QixJQUFQLENBQVlOLFNBQVosQ0FEMEM7QUFFaERPLFFBQUFBLFFBQVEsRUFBRTtBQUZzQyxPQUFkLEVBR2pDZixPQUhpQyxDQUFwQztBQUlBLFlBQU1VLFlBQU47O0FBdEJLOztBQUFBOztBQUFBOztBQUFBO0FBdUJOOztBQUNELFVBQU07QUFBRUcsTUFBQUE7QUFBRixRQUFXLElBQWpCO0FBQ0FHLElBQUFBLE9BQU8sQ0FBQ0MsTUFBUixDQUFlSixJQUFJLENBQUNwQixNQUFMLEtBQWdCLEVBQS9CLEVBQW1DLHdCQUFuQztBQUNBLFNBQUtRLFVBQUwsR0FBa0IsQ0FBQ1ksSUFBSSxDQUFDLENBQUQsQ0FBSixHQUFVLElBQVgsTUFBcUIsQ0FBdkM7QUFDQSxTQUFLSixTQUFMLEdBQWtCSSxJQUFJLENBQUMsQ0FBRCxDQUFKLEdBQVUsSUFBNUI7QUFDQSxTQUFLUCxVQUFMLEdBQWtCTyxJQUFJLENBQUNLLEtBQUwsQ0FBVyxDQUFYLEVBQWMsQ0FBZCxDQUFsQjtBQUNBLFNBQUtoQixHQUFMLEdBQVdXLElBQUksQ0FBQ0ssS0FBTCxDQUFXLENBQVgsQ0FBWDtBQUNBUCxJQUFBQSxNQUFNLENBQUNRLE1BQVAsQ0FBYyxJQUFkO0FBQ0Q7O0FBRUQsTUFBSUMsVUFBSixHQUFxQztBQUNuQyxRQUFJLEtBQUtuQixVQUFULEVBQXFCLE9BQU8sS0FBS0ssVUFBTCxDQUFnQmUsWUFBaEIsQ0FBNkIsQ0FBN0IsQ0FBUDtBQUN0Qjs7QUFqRDZFIiwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTkuIE9PTyBOYXRhLUluZm9cbiAqIEBhdXRob3IgQW5kcmVpIFNhcmFrZWV2IDxhdnNAbmF0YS1pbmZvLnJ1PlxuICpcbiAqIFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBcIkBuYXRhXCIgcHJvamVjdC5cbiAqIEZvciB0aGUgZnVsbCBjb3B5cmlnaHQgYW5kIGxpY2Vuc2UgaW5mb3JtYXRpb24sIHBsZWFzZSB2aWV3XG4gKiB0aGUgRVVMQSBmaWxlIHRoYXQgd2FzIGRpc3RyaWJ1dGVkIHdpdGggdGhpcyBzb3VyY2UgY29kZS5cbiAqL1xuXG5pbXBvcnQgQWRkcmVzcyBmcm9tICcuLi9BZGRyZXNzJztcbmltcG9ydCB7IE9mZnNldHMgfSBmcm9tICcuLi9uYmNvbnN0JztcbmltcG9ydCB7IE5pYnVzRGF0YWdyYW0sIElOaWJ1c0NvbW1vbiwgSU5pYnVzT3B0aW9ucyB9IGZyb20gJy4uL25pYnVzJztcbmltcG9ydCBTYXJwUXVlcnlUeXBlIGZyb20gJy4vU2FycFF1ZXJ5VHlwZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNhcnBPcHRpb25zIGV4dGVuZHMgSU5pYnVzQ29tbW9uIHtcbiAgaXNSZXNwb25zZT86IGJvb2xlYW47XG4gIHF1ZXJ5VHlwZTogU2FycFF1ZXJ5VHlwZTtcbiAgcXVlcnlQYXJhbTogQnVmZmVyO1xuICBtYWM/OiBCdWZmZXI7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFNhcnBEYXRhZ3JhbSBleHRlbmRzIE5pYnVzRGF0YWdyYW0gaW1wbGVtZW50cyBJU2FycE9wdGlvbnMge1xuICBwdWJsaWMgc3RhdGljIGlzU2FycEZyYW1lKGZyYW1lOiBCdWZmZXIpIHtcbiAgICByZXR1cm4gQnVmZmVyLmlzQnVmZmVyKGZyYW1lKSAmJiBmcmFtZS5sZW5ndGggPT09IE9mZnNldHMuREFUQSArIDEyICsgMlxuICAgICAgJiYgZnJhbWVbT2Zmc2V0cy5QUk9UT0NPTF0gPT09IDIgJiYgZnJhbWVbT2Zmc2V0cy5MRU5HVEhdID09PSAxMztcbiAgfVxuXG4gIHB1YmxpYyByZWFkb25seSBpc1Jlc3BvbnNlOiBib29sZWFuO1xuICBwdWJsaWMgcmVhZG9ubHkgcXVlcnlUeXBlOiBTYXJwUXVlcnlUeXBlO1xuICBwdWJsaWMgcmVhZG9ubHkgcXVlcnlQYXJhbTogQnVmZmVyO1xuICBwdWJsaWMgcmVhZG9ubHkgbWFjOiBCdWZmZXI7XG5cbiAgY29uc3RydWN0b3IoZnJhbWVPck9wdGlvbnM6IElTYXJwT3B0aW9ucyB8IEJ1ZmZlcikge1xuICAgIGlmIChCdWZmZXIuaXNCdWZmZXIoZnJhbWVPck9wdGlvbnMpKSB7XG4gICAgICBzdXBlcihmcmFtZU9yT3B0aW9ucyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIGlzUmVzcG9uc2U6IGZhbHNlLFxuICAgICAgICBtYWM6IEFkZHJlc3MuZW1wdHkucmF3LFxuICAgICAgICAuLi5mcmFtZU9yT3B0aW9ucyxcbiAgICAgIH07XG4gICAgICBpZiAob3B0aW9ucy5xdWVyeVBhcmFtLmxlbmd0aCAhPT0gNSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcXVlcnkgcGFyYW0nKTtcbiAgICAgIH1cbiAgICAgIGlmIChvcHRpb25zLm1hYy5sZW5ndGggIT09IDYpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIG1hYyBwYXJhbScpO1xuICAgICAgfVxuICAgICAgY29uc3QgbmlidXNEYXRhID0gW1xuICAgICAgICAob3B0aW9ucy5pc1Jlc3BvbnNlID8gMHg4MCA6IDApIHwgKG9wdGlvbnMucXVlcnlUeXBlKSxcbiAgICAgICAgLi4ub3B0aW9ucy5xdWVyeVBhcmFtLFxuICAgICAgICAuLi5vcHRpb25zLm1hYyxcbiAgICAgIF07XG5cbiAgICAgIGNvbnN0IG5pYnVzT3B0aW9uczogSU5pYnVzT3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe1xuICAgICAgICBkYXRhOiBCdWZmZXIuZnJvbShuaWJ1c0RhdGEpLFxuICAgICAgICBwcm90b2NvbDogMixcbiAgICAgIH0sIG9wdGlvbnMpO1xuICAgICAgc3VwZXIobmlidXNPcHRpb25zKTtcbiAgICB9XG4gICAgY29uc3QgeyBkYXRhIH0gPSB0aGlzO1xuICAgIGNvbnNvbGUuYXNzZXJ0KGRhdGEubGVuZ3RoID09PSAxMiwgJ1VuZXhwZWN0ZWQgc2FycCBsZW5ndGgnKTtcbiAgICB0aGlzLmlzUmVzcG9uc2UgPSAoZGF0YVswXSAmIDB4ODApICE9PSAwO1xuICAgIHRoaXMucXVlcnlUeXBlID0gKGRhdGFbMF0gJiAweDBmKTtcbiAgICB0aGlzLnF1ZXJ5UGFyYW0gPSBkYXRhLnNsaWNlKDEsIDYpO1xuICAgIHRoaXMubWFjID0gZGF0YS5zbGljZSg2KTtcbiAgICBPYmplY3QuZnJlZXplKHRoaXMpO1xuICB9XG5cbiAgZ2V0IGRldmljZVR5cGUoKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAodGhpcy5pc1Jlc3BvbnNlKSByZXR1cm4gdGhpcy5xdWVyeVBhcmFtLnJlYWRVSW50MTZCRSgzKTtcbiAgfVxufVxuIl19