"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeAddressHandler = void 0;

require("source-map-support/register");

var _mib = require("@nata/nibus.js-client/lib/mib");

var _nibus = _interopRequireWildcard(require("@nata/nibus.js-client"));

var _nibus2 = require("@nata/nibus.js-client/lib/nibus");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

const makeAddressHandler = (action, breakout = false) => args => new Promise(async (resolve, reject) => {
  let hasFound = false;

  const close = err => {
    clearTimeout(timeout);

    _nibus.default.close();

    if (err || !hasFound) {
      return reject(err || 'Устройство не найдено');
    }

    resolve();
  };

  const mac = new _nibus.Address(args.mac);
  let count = await _nibus.default.start(); // const setCount: NibusCounter = (handler = (c: number) => c) => count = handler(count);

  const perform = async (connection, mibOrType, version) => {
    clearTimeout(timeout);

    const device = _mib.devices.create(mac, mibOrType, version);

    device.connection = connection;
    await action(device, args);
    hasFound = true;
  };

  _nibus.default.on('found', async ({
    address,
    connection
  }) => {
    try {
      if (address.equals(mac) && connection.description.mib) {
        if (!args.mib || args.mib === connection.description.mib) {
          await perform(connection, connection.description.mib);
          if (breakout) return close();
          wait();
        }
      }

      if (address.equals(mac) && connection.description.type || connection.description.link) {
        count += 1;
        const [version, type] = await connection.getVersion(mac);

        if (type) {
          await perform(connection, type, version);
          if (breakout) return close();
          wait();
        }
      }
    } catch (e) {
      close(e.message || e);
    }

    count -= 1;

    if (count === 0) {
      clearTimeout(timeout);
      process.nextTick(close);
    }
  });

  const wait = () => {
    count -= 1;

    if (count > 0) {
      timeout = setTimeout(wait, (0, _nibus2.getNibusTimeout)());
    } else {
      close();
    }
  };

  let timeout = setTimeout(wait, (0, _nibus2.getNibusTimeout)());
});

exports.makeAddressHandler = makeAddressHandler;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jbGkvaGFuZGxlcnMudHMiXSwibmFtZXMiOlsibWFrZUFkZHJlc3NIYW5kbGVyIiwiYWN0aW9uIiwiYnJlYWtvdXQiLCJhcmdzIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJoYXNGb3VuZCIsImNsb3NlIiwiZXJyIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsInNlc3Npb24iLCJtYWMiLCJBZGRyZXNzIiwiY291bnQiLCJzdGFydCIsInBlcmZvcm0iLCJjb25uZWN0aW9uIiwibWliT3JUeXBlIiwidmVyc2lvbiIsImRldmljZSIsImRldmljZXMiLCJjcmVhdGUiLCJvbiIsImFkZHJlc3MiLCJlcXVhbHMiLCJkZXNjcmlwdGlvbiIsIm1pYiIsIndhaXQiLCJ0eXBlIiwibGluayIsImdldFZlcnNpb24iLCJlIiwibWVzc2FnZSIsInByb2Nlc3MiLCJuZXh0VGljayIsInNldFRpbWVvdXQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQVdBOztBQUNBOztBQUNBOzs7O0FBU0EsTUFBTUEsa0JBQWtCLEdBQUcsQ0FDMUJDLE1BRDBCLEVBQ0hDLFFBQVEsR0FBRyxLQURSLEtBRXhCQyxJQUFELElBQ0UsSUFBSUMsT0FBSixDQUFZLE9BQU9DLE9BQVAsRUFBZ0JDLE1BQWhCLEtBQTJCO0FBQ3JDLE1BQUlDLFFBQVEsR0FBRyxLQUFmOztBQUNBLFFBQU1DLEtBQUssR0FBSUMsR0FBRCxJQUFrQjtBQUM5QkMsSUFBQUEsWUFBWSxDQUFDQyxPQUFELENBQVo7O0FBQ0FDLG1CQUFRSixLQUFSOztBQUNBLFFBQUlDLEdBQUcsSUFBSSxDQUFDRixRQUFaLEVBQXNCO0FBQ3BCLGFBQU9ELE1BQU0sQ0FBQ0csR0FBRyxJQUFJLHVCQUFSLENBQWI7QUFDRDs7QUFDREosSUFBQUEsT0FBTztBQUNSLEdBUEQ7O0FBUUEsUUFBTVEsR0FBRyxHQUFHLElBQUlDLGNBQUosQ0FBWVgsSUFBSSxDQUFDVSxHQUFqQixDQUFaO0FBQ0EsTUFBSUUsS0FBSyxHQUFHLE1BQU1ILGVBQVFJLEtBQVIsRUFBbEIsQ0FYcUMsQ0FZckM7O0FBRUEsUUFBTUMsT0FBTyxHQUFHLE9BQU9DLFVBQVAsRUFBb0NDLFNBQXBDLEVBQW9EQyxPQUFwRCxLQUF5RTtBQUN2RlYsSUFBQUEsWUFBWSxDQUFDQyxPQUFELENBQVo7O0FBQ0EsVUFBTVUsTUFBTSxHQUFHQyxhQUFRQyxNQUFSLENBQWVWLEdBQWYsRUFBb0JNLFNBQXBCLEVBQStCQyxPQUEvQixDQUFmOztBQUNBQyxJQUFBQSxNQUFNLENBQUNILFVBQVAsR0FBb0JBLFVBQXBCO0FBQ0EsVUFBTWpCLE1BQU0sQ0FBQ29CLE1BQUQsRUFBU2xCLElBQVQsQ0FBWjtBQUNBSSxJQUFBQSxRQUFRLEdBQUcsSUFBWDtBQUNELEdBTkQ7O0FBUUFLLGlCQUFRWSxFQUFSLENBQVcsT0FBWCxFQUFvQixPQUFPO0FBQUVDLElBQUFBLE9BQUY7QUFBV1AsSUFBQUE7QUFBWCxHQUFQLEtBQW1DO0FBQ3JELFFBQUk7QUFDRixVQUFJTyxPQUFPLENBQUNDLE1BQVIsQ0FBZWIsR0FBZixLQUF1QkssVUFBVSxDQUFDUyxXQUFYLENBQXVCQyxHQUFsRCxFQUF1RDtBQUNyRCxZQUFJLENBQUN6QixJQUFJLENBQUN5QixHQUFOLElBQWF6QixJQUFJLENBQUN5QixHQUFMLEtBQWFWLFVBQVUsQ0FBQ1MsV0FBWCxDQUF1QkMsR0FBckQsRUFBMEQ7QUFDeEQsZ0JBQU1YLE9BQU8sQ0FBQ0MsVUFBRCxFQUFhQSxVQUFVLENBQUNTLFdBQVgsQ0FBdUJDLEdBQXBDLENBQWI7QUFDQSxjQUFJMUIsUUFBSixFQUFjLE9BQU9NLEtBQUssRUFBWjtBQUNkcUIsVUFBQUEsSUFBSTtBQUNMO0FBQ0Y7O0FBQ0QsVUFBSUosT0FBTyxDQUFDQyxNQUFSLENBQWViLEdBQWYsS0FBdUJLLFVBQVUsQ0FBQ1MsV0FBWCxDQUF1QkcsSUFBOUMsSUFBc0RaLFVBQVUsQ0FBQ1MsV0FBWCxDQUF1QkksSUFBakYsRUFBdUY7QUFDckZoQixRQUFBQSxLQUFLLElBQUksQ0FBVDtBQUNBLGNBQU0sQ0FBQ0ssT0FBRCxFQUFVVSxJQUFWLElBQWtCLE1BQU1aLFVBQVUsQ0FBQ2MsVUFBWCxDQUFzQm5CLEdBQXRCLENBQTlCOztBQUNBLFlBQUlpQixJQUFKLEVBQVU7QUFDUixnQkFBTWIsT0FBTyxDQUFDQyxVQUFELEVBQWFZLElBQWIsRUFBbUJWLE9BQW5CLENBQWI7QUFDQSxjQUFJbEIsUUFBSixFQUFjLE9BQU9NLEtBQUssRUFBWjtBQUNkcUIsVUFBQUEsSUFBSTtBQUNMO0FBQ0Y7QUFDRixLQWpCRCxDQWlCRSxPQUFPSSxDQUFQLEVBQVU7QUFDVnpCLE1BQUFBLEtBQUssQ0FBQ3lCLENBQUMsQ0FBQ0MsT0FBRixJQUFhRCxDQUFkLENBQUw7QUFDRDs7QUFDRGxCLElBQUFBLEtBQUssSUFBSSxDQUFUOztBQUNBLFFBQUlBLEtBQUssS0FBSyxDQUFkLEVBQWlCO0FBQ2ZMLE1BQUFBLFlBQVksQ0FBQ0MsT0FBRCxDQUFaO0FBQ0F3QixNQUFBQSxPQUFPLENBQUNDLFFBQVIsQ0FBaUI1QixLQUFqQjtBQUNEO0FBQ0YsR0ExQkQ7O0FBNEJBLFFBQU1xQixJQUFJLEdBQUcsTUFBTTtBQUNqQmQsSUFBQUEsS0FBSyxJQUFJLENBQVQ7O0FBQ0EsUUFBSUEsS0FBSyxHQUFHLENBQVosRUFBZTtBQUNiSixNQUFBQSxPQUFPLEdBQUcwQixVQUFVLENBQUNSLElBQUQsRUFBTyw4QkFBUCxDQUFwQjtBQUNELEtBRkQsTUFFTztBQUNMckIsTUFBQUEsS0FBSztBQUNOO0FBQ0YsR0FQRDs7QUFTQSxNQUFJRyxPQUFPLEdBQUcwQixVQUFVLENBQUNSLElBQUQsRUFBTyw4QkFBUCxDQUF4QjtBQUNELENBNURELENBSEoiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCAoYykgMjAxOS4gTmF0YS1JbmZvXG4gKiBAYXV0aG9yIEFuZHJlaSBTYXJha2VldiA8YXZzQG5hdGEtaW5mby5ydT5cbiAqXG4gKiBUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgXCJAbmF0YVwiIHByb2plY3QuXG4gKiBGb3IgdGhlIGZ1bGwgY29weXJpZ2h0IGFuZCBsaWNlbnNlIGluZm9ybWF0aW9uLCBwbGVhc2Ugdmlld1xuICogdGhlIEVVTEEgZmlsZSB0aGF0IHdhcyBkaXN0cmlidXRlZCB3aXRoIHRoaXMgc291cmNlIGNvZGUuXG4gKi9cblxuaW1wb3J0IHsgQXJndW1lbnRzLCBEZWZpbmVkIH0gZnJvbSAneWFyZ3MnO1xuaW1wb3J0IHsgZGV2aWNlcywgSURldmljZSB9IGZyb20gJ0BuYXRhL25pYnVzLmpzLWNsaWVudC9saWIvbWliJztcbmltcG9ydCBzZXNzaW9uLCB7IEFkZHJlc3MgfSBmcm9tICdAbmF0YS9uaWJ1cy5qcy1jbGllbnQnO1xuaW1wb3J0IHsgZ2V0TmlidXNUaW1lb3V0LCBOaWJ1c0Nvbm5lY3Rpb24gfSBmcm9tICdAbmF0YS9uaWJ1cy5qcy1jbGllbnQvbGliL25pYnVzJztcbmltcG9ydCB7IENvbW1vbk9wdHMgfSBmcm9tICcuL29wdGlvbnMnO1xuXG4vLyBleHBvcnQgdHlwZSBOaWJ1c0NvdW50ZXIgPSAoaGFuZGxlcjogKGNvdW50OiBudW1iZXIpID0+IG51bWJlcikgPT4gdm9pZDtcblxuaW50ZXJmYWNlIEFjdGlvbkZ1bmM8Tz4ge1xuICAoZGV2aWNlOiBJRGV2aWNlLCBhcmdzOiBBcmd1bWVudHM8Tz4pOiBQcm9taXNlPHZvaWQ+O1xufVxuXG5jb25zdCBtYWtlQWRkcmVzc0hhbmRsZXIgPSA8TyBleHRlbmRzIERlZmluZWQ8Q29tbW9uT3B0cywgJ20nIHwgJ21hYyc+PlxuKGFjdGlvbjogQWN0aW9uRnVuYzxPPiwgYnJlYWtvdXQgPSBmYWxzZSkgPT5cbiAgKGFyZ3M6IEFyZ3VtZW50czxPPikgPT5cbiAgICBuZXcgUHJvbWlzZShhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgaGFzRm91bmQgPSBmYWxzZTtcbiAgICAgIGNvbnN0IGNsb3NlID0gKGVycj86IHN0cmluZykgPT4ge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgIHNlc3Npb24uY2xvc2UoKTtcbiAgICAgICAgaWYgKGVyciB8fCAhaGFzRm91bmQpIHtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVyciB8fCAn0KPRgdGC0YDQvtC50YHRgtCy0L4g0L3QtSDQvdCw0LnQtNC10L3QvicpO1xuICAgICAgICB9XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH07XG4gICAgICBjb25zdCBtYWMgPSBuZXcgQWRkcmVzcyhhcmdzLm1hYyk7XG4gICAgICBsZXQgY291bnQgPSBhd2FpdCBzZXNzaW9uLnN0YXJ0KCk7XG4gICAgICAvLyBjb25zdCBzZXRDb3VudDogTmlidXNDb3VudGVyID0gKGhhbmRsZXIgPSAoYzogbnVtYmVyKSA9PiBjKSA9PiBjb3VudCA9IGhhbmRsZXIoY291bnQpO1xuXG4gICAgICBjb25zdCBwZXJmb3JtID0gYXN5bmMgKGNvbm5lY3Rpb246IE5pYnVzQ29ubmVjdGlvbiwgbWliT3JUeXBlOiBhbnksIHZlcnNpb24/OiBudW1iZXIpID0+IHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICBjb25zdCBkZXZpY2UgPSBkZXZpY2VzLmNyZWF0ZShtYWMsIG1pYk9yVHlwZSwgdmVyc2lvbik7XG4gICAgICAgIGRldmljZS5jb25uZWN0aW9uID0gY29ubmVjdGlvbjtcbiAgICAgICAgYXdhaXQgYWN0aW9uKGRldmljZSwgYXJncyk7XG4gICAgICAgIGhhc0ZvdW5kID0gdHJ1ZTtcbiAgICAgIH07XG5cbiAgICAgIHNlc3Npb24ub24oJ2ZvdW5kJywgYXN5bmMgKHsgYWRkcmVzcywgY29ubmVjdGlvbiB9KSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgaWYgKGFkZHJlc3MuZXF1YWxzKG1hYykgJiYgY29ubmVjdGlvbi5kZXNjcmlwdGlvbi5taWIpIHtcbiAgICAgICAgICAgIGlmICghYXJncy5taWIgfHwgYXJncy5taWIgPT09IGNvbm5lY3Rpb24uZGVzY3JpcHRpb24ubWliKSB7XG4gICAgICAgICAgICAgIGF3YWl0IHBlcmZvcm0oY29ubmVjdGlvbiwgY29ubmVjdGlvbi5kZXNjcmlwdGlvbi5taWIpO1xuICAgICAgICAgICAgICBpZiAoYnJlYWtvdXQpIHJldHVybiBjbG9zZSgpO1xuICAgICAgICAgICAgICB3YWl0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChhZGRyZXNzLmVxdWFscyhtYWMpICYmIGNvbm5lY3Rpb24uZGVzY3JpcHRpb24udHlwZSB8fCBjb25uZWN0aW9uLmRlc2NyaXB0aW9uLmxpbmspIHtcbiAgICAgICAgICAgIGNvdW50ICs9IDE7XG4gICAgICAgICAgICBjb25zdCBbdmVyc2lvbiwgdHlwZV0gPSBhd2FpdCBjb25uZWN0aW9uLmdldFZlcnNpb24obWFjKTtcbiAgICAgICAgICAgIGlmICh0eXBlKSB7XG4gICAgICAgICAgICAgIGF3YWl0IHBlcmZvcm0oY29ubmVjdGlvbiwgdHlwZSwgdmVyc2lvbik7XG4gICAgICAgICAgICAgIGlmIChicmVha291dCkgcmV0dXJuIGNsb3NlKCk7XG4gICAgICAgICAgICAgIHdhaXQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBjbG9zZShlLm1lc3NhZ2UgfHwgZSk7XG4gICAgICAgIH1cbiAgICAgICAgY291bnQgLT0gMTtcbiAgICAgICAgaWYgKGNvdW50ID09PSAwKSB7XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICAgIHByb2Nlc3MubmV4dFRpY2soY2xvc2UpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgY29uc3Qgd2FpdCA9ICgpID0+IHtcbiAgICAgICAgY291bnQgLT0gMTtcbiAgICAgICAgaWYgKGNvdW50ID4gMCkge1xuICAgICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KHdhaXQsIGdldE5pYnVzVGltZW91dCgpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjbG9zZSgpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBsZXQgdGltZW91dCA9IHNldFRpbWVvdXQod2FpdCwgZ2V0TmlidXNUaW1lb3V0KCkpO1xuICAgIH0pO1xuXG5leHBvcnQgeyBtYWtlQWRkcmVzc0hhbmRsZXIgfTtcbiJdfQ==