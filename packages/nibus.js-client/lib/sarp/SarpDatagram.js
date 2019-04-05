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
  }

}

exports.default = SarpDatagram;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zYXJwL1NhcnBEYXRhZ3JhbS50cyJdLCJuYW1lcyI6WyJTYXJwRGF0YWdyYW0iLCJOaWJ1c0RhdGFncmFtIiwiaXNTYXJwRnJhbWUiLCJmcmFtZSIsIkJ1ZmZlciIsImlzQnVmZmVyIiwibGVuZ3RoIiwiT2Zmc2V0cyIsIkRBVEEiLCJQUk9UT0NPTCIsIkxFTkdUSCIsImNvbnN0cnVjdG9yIiwiZnJhbWVPck9wdGlvbnMiLCJvcHRpb25zIiwiaXNSZXNwb25zZSIsIm1hYyIsIkFkZHJlc3MiLCJlbXB0eSIsInJhdyIsInF1ZXJ5UGFyYW0iLCJFcnJvciIsIm5pYnVzRGF0YSIsInF1ZXJ5VHlwZSIsIm5pYnVzT3B0aW9ucyIsIk9iamVjdCIsImFzc2lnbiIsImRhdGEiLCJmcm9tIiwicHJvdG9jb2wiLCJjb25zb2xlIiwiYXNzZXJ0Iiwic2xpY2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQVVBOztBQUNBOztBQUNBOzs7Ozs7QUFVZSxNQUFNQSxZQUFOLFNBQTJCQyxvQkFBM0IsQ0FBaUU7QUFDOUUsU0FBY0MsV0FBZCxDQUEwQkMsS0FBMUIsRUFBeUM7QUFDdkMsV0FBT0MsTUFBTSxDQUFDQyxRQUFQLENBQWdCRixLQUFoQixLQUEwQkEsS0FBSyxDQUFDRyxNQUFOLEtBQWlCQyxpQkFBUUMsSUFBUixHQUFlLEVBQWYsR0FBb0IsQ0FBL0QsSUFDRkwsS0FBSyxDQUFDSSxpQkFBUUUsUUFBVCxDQUFMLEtBQTRCLENBRDFCLElBQytCTixLQUFLLENBQUNJLGlCQUFRRyxNQUFULENBQUwsS0FBMEIsRUFEaEU7QUFFRDs7QUFPREMsRUFBQUEsV0FBVyxDQUFDQyxjQUFELEVBQXdDO0FBQ2pELFFBQUlSLE1BQU0sQ0FBQ0MsUUFBUCxDQUFnQk8sY0FBaEIsQ0FBSixFQUFxQztBQUNuQyxZQUFNQSxjQUFOOztBQURtQzs7QUFBQTs7QUFBQTs7QUFBQTtBQUVwQyxLQUZELE1BRU87QUFDTCxZQUFNQyxPQUFPLEdBQUc7QUFDZEMsUUFBQUEsVUFBVSxFQUFFLEtBREU7QUFFZEMsUUFBQUEsR0FBRyxFQUFFQyxpQkFBUUMsS0FBUixDQUFjQyxHQUZMO0FBR2QsV0FBR047QUFIVyxPQUFoQjs7QUFLQSxVQUFJQyxPQUFPLENBQUNNLFVBQVIsQ0FBbUJiLE1BQW5CLEtBQThCLENBQWxDLEVBQXFDO0FBQ25DLGNBQU0sSUFBSWMsS0FBSixDQUFVLHFCQUFWLENBQU47QUFDRDs7QUFDRCxVQUFJUCxPQUFPLENBQUNFLEdBQVIsQ0FBWVQsTUFBWixLQUF1QixDQUEzQixFQUE4QjtBQUM1QixjQUFNLElBQUljLEtBQUosQ0FBVSxtQkFBVixDQUFOO0FBQ0Q7O0FBQ0QsWUFBTUMsU0FBUyxHQUFHLENBQ2hCLENBQUNSLE9BQU8sQ0FBQ0MsVUFBUixHQUFxQixJQUFyQixHQUE0QixDQUE3QixJQUFtQ0QsT0FBTyxDQUFDUyxTQUQzQixFQUVoQixHQUFHVCxPQUFPLENBQUNNLFVBRkssRUFHaEIsR0FBR04sT0FBTyxDQUFDRSxHQUhLLENBQWxCO0FBTUEsWUFBTVEsWUFBMkIsR0FBR0MsTUFBTSxDQUFDQyxNQUFQLENBQWM7QUFDaERDLFFBQUFBLElBQUksRUFBRXRCLE1BQU0sQ0FBQ3VCLElBQVAsQ0FBWU4sU0FBWixDQUQwQztBQUVoRE8sUUFBQUEsUUFBUSxFQUFFO0FBRnNDLE9BQWQsRUFHakNmLE9BSGlDLENBQXBDO0FBSUEsWUFBTVUsWUFBTjs7QUF0Qks7O0FBQUE7O0FBQUE7O0FBQUE7QUF1Qk47O0FBQ0QsVUFBTTtBQUFFRyxNQUFBQTtBQUFGLFFBQVcsSUFBakI7QUFDQUcsSUFBQUEsT0FBTyxDQUFDQyxNQUFSLENBQWVKLElBQUksQ0FBQ3BCLE1BQUwsS0FBZ0IsRUFBL0IsRUFBbUMsd0JBQW5DO0FBQ0EsU0FBS1EsVUFBTCxHQUFrQixDQUFDWSxJQUFJLENBQUMsQ0FBRCxDQUFKLEdBQVUsSUFBWCxNQUFxQixDQUF2QztBQUNBLFNBQUtKLFNBQUwsR0FBa0JJLElBQUksQ0FBQyxDQUFELENBQUosR0FBVSxJQUE1QjtBQUNBLFNBQUtQLFVBQUwsR0FBa0JPLElBQUksQ0FBQ0ssS0FBTCxDQUFXLENBQVgsRUFBYyxDQUFkLENBQWxCO0FBQ0EsU0FBS2hCLEdBQUwsR0FBV1csSUFBSSxDQUFDSyxLQUFMLENBQVcsQ0FBWCxDQUFYO0FBQ0Q7O0FBNUM2RSIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IChjKSAyMDE5LiBPT08gTmF0YS1JbmZvXG4gKiBAYXV0aG9yIEFuZHJlaSBTYXJha2VldiA8YXZzQG5hdGEtaW5mby5ydT5cbiAqXG4gKiBUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgXCJAbmF0YVwiIHByb2plY3QuXG4gKiBGb3IgdGhlIGZ1bGwgY29weXJpZ2h0IGFuZCBsaWNlbnNlIGluZm9ybWF0aW9uLCBwbGVhc2Ugdmlld1xuICogdGhlIEVVTEEgZmlsZSB0aGF0IHdhcyBkaXN0cmlidXRlZCB3aXRoIHRoaXMgc291cmNlIGNvZGUuXG4gKi9cblxuaW1wb3J0IEFkZHJlc3MgZnJvbSAnLi4vQWRkcmVzcyc7XG5pbXBvcnQgeyBPZmZzZXRzIH0gZnJvbSAnLi4vbmJjb25zdCc7XG5pbXBvcnQgeyBOaWJ1c0RhdGFncmFtLCBJTmlidXNDb21tb24sIElOaWJ1c09wdGlvbnMgfSBmcm9tICcuLi9uaWJ1cyc7XG5pbXBvcnQgU2FycFF1ZXJ5VHlwZSBmcm9tICcuL1NhcnBRdWVyeVR5cGUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElTYXJwT3B0aW9ucyBleHRlbmRzIElOaWJ1c0NvbW1vbiB7XG4gIGlzUmVzcG9uc2U/OiBib29sZWFuO1xuICBxdWVyeVR5cGU6IFNhcnBRdWVyeVR5cGU7XG4gIHF1ZXJ5UGFyYW06IEJ1ZmZlcjtcbiAgbWFjPzogQnVmZmVyO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTYXJwRGF0YWdyYW0gZXh0ZW5kcyBOaWJ1c0RhdGFncmFtIGltcGxlbWVudHMgSVNhcnBPcHRpb25zIHtcbiAgcHVibGljIHN0YXRpYyBpc1NhcnBGcmFtZShmcmFtZTogQnVmZmVyKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5pc0J1ZmZlcihmcmFtZSkgJiYgZnJhbWUubGVuZ3RoID09PSBPZmZzZXRzLkRBVEEgKyAxMiArIDJcbiAgICAgICYmIGZyYW1lW09mZnNldHMuUFJPVE9DT0xdID09PSAyICYmIGZyYW1lW09mZnNldHMuTEVOR1RIXSA9PT0gMTM7XG4gIH1cblxuICBwdWJsaWMgcmVhZG9ubHkgaXNSZXNwb25zZTogYm9vbGVhbjtcbiAgcHVibGljIHJlYWRvbmx5IHF1ZXJ5VHlwZTogU2FycFF1ZXJ5VHlwZTtcbiAgcHVibGljIHJlYWRvbmx5IHF1ZXJ5UGFyYW06IEJ1ZmZlcjtcbiAgcHVibGljIHJlYWRvbmx5IG1hYzogQnVmZmVyO1xuXG4gIGNvbnN0cnVjdG9yKGZyYW1lT3JPcHRpb25zOiBJU2FycE9wdGlvbnMgfCBCdWZmZXIpIHtcbiAgICBpZiAoQnVmZmVyLmlzQnVmZmVyKGZyYW1lT3JPcHRpb25zKSkge1xuICAgICAgc3VwZXIoZnJhbWVPck9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICBpc1Jlc3BvbnNlOiBmYWxzZSxcbiAgICAgICAgbWFjOiBBZGRyZXNzLmVtcHR5LnJhdyxcbiAgICAgICAgLi4uZnJhbWVPck9wdGlvbnMsXG4gICAgICB9O1xuICAgICAgaWYgKG9wdGlvbnMucXVlcnlQYXJhbS5sZW5ndGggIT09IDUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHF1ZXJ5IHBhcmFtJyk7XG4gICAgICB9XG4gICAgICBpZiAob3B0aW9ucy5tYWMubGVuZ3RoICE9PSA2KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBtYWMgcGFyYW0nKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IG5pYnVzRGF0YSA9IFtcbiAgICAgICAgKG9wdGlvbnMuaXNSZXNwb25zZSA/IDB4ODAgOiAwKSB8IChvcHRpb25zLnF1ZXJ5VHlwZSksXG4gICAgICAgIC4uLm9wdGlvbnMucXVlcnlQYXJhbSxcbiAgICAgICAgLi4ub3B0aW9ucy5tYWMsXG4gICAgICBdO1xuXG4gICAgICBjb25zdCBuaWJ1c09wdGlvbnM6IElOaWJ1c09wdGlvbnMgPSBPYmplY3QuYXNzaWduKHtcbiAgICAgICAgZGF0YTogQnVmZmVyLmZyb20obmlidXNEYXRhKSxcbiAgICAgICAgcHJvdG9jb2w6IDIsXG4gICAgICB9LCBvcHRpb25zKTtcbiAgICAgIHN1cGVyKG5pYnVzT3B0aW9ucyk7XG4gICAgfVxuICAgIGNvbnN0IHsgZGF0YSB9ID0gdGhpcztcbiAgICBjb25zb2xlLmFzc2VydChkYXRhLmxlbmd0aCA9PT0gMTIsICdVbmV4cGVjdGVkIHNhcnAgbGVuZ3RoJyk7XG4gICAgdGhpcy5pc1Jlc3BvbnNlID0gKGRhdGFbMF0gJiAweDgwKSAhPT0gMDtcbiAgICB0aGlzLnF1ZXJ5VHlwZSA9IChkYXRhWzBdICYgMHgwZik7XG4gICAgdGhpcy5xdWVyeVBhcmFtID0gZGF0YS5zbGljZSgxLCA2KTtcbiAgICB0aGlzLm1hYyA9IGRhdGEuc2xpY2UoNik7XG4gIH1cbn1cbiJdfQ==