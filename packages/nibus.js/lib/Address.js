"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.AddressType = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// import {noenum} from './utils';
const MAC_LENGTH = 6;

const isHex = str => /^(?:0X[0-9A-F]+)|(?:[0-9]*[A-F]+)/i.test(str);

const parseHex = str => parseInt(str, 16);

let AddressType;
exports.AddressType = AddressType;

(function (AddressType) {
  AddressType["broadcast"] = "broadcast";
  AddressType["empty"] = "empty";
  AddressType[AddressType["mac"] = 0] = "mac";
  AddressType[AddressType["net"] = 1] = "net";
  AddressType[AddressType["group"] = 2] = "group";
})(AddressType || (exports.AddressType = AddressType = {}));

const isEmpty = array => _lodash.default.every(array, b => b === 0);

const isBroadcast = array => _lodash.default.every(array, b => b === 255);

class Address {
  static toAddress(address) {
    if (address == null) {
      return address;
    }

    return address instanceof Address ? address : new Address(address);
  }

  static read(type, buffer, offset = 0) {
    if (buffer.length - offset < MAC_LENGTH) {
      throw new Error('Invalid buffer length');
    }

    switch (type) {
      case AddressType.mac:
        {
          const mac = buffer.slice(offset, offset + MAC_LENGTH);
          return new Address(mac);
        }

      case AddressType.net:
        {
          const net = [buffer.readUInt16LE(offset), buffer.readUInt8(offset + 2), buffer.readUInt16LE(offset + 3)];
          return new Address(net.join('.'));
        }

      case AddressType.group:
        {
          const group = [buffer.readUInt16LE(offset), buffer.readUInt8(offset + 2)];
          return new Address(group.join('.'));
        }

      default:
        throw new Error(`Invalid address type ${type}`);
    }
  }

  constructor(address = '') {
    _defineProperty(this, "type", void 0);

    _defineProperty(this, "domain", void 0);

    _defineProperty(this, "group", void 0);

    _defineProperty(this, "subnet", void 0);

    _defineProperty(this, "device", void 0);

    _defineProperty(this, "mac", void 0);

    _defineProperty(this, "raw", void 0);

    let pos = 0;

    if (typeof address === 'string') {
      this.raw = Buffer.alloc(MAC_LENGTH);

      switch (address) {
        case '':
          this.type = AddressType.empty;
          break;

        case 'broadcast':
          this.type = AddressType.broadcast;
          this.raw.fill(255);
          break;

        case 'auto':
          {
            this.raw.fill(0xFE, 0, 2);
            this.raw.writeUInt32BE(Address.autocount, 2);
            this.type = AddressType.mac;
            Address.autocount += 1;
            break;
          }

        default:
          if (!/^[0-9A-FX.:]+$/i.test(address)) {
            throw new Error('Invalid address');
          }

          if (address.indexOf('.') !== -1) {
            const parts = address.split('.', 4);
            const radix = _lodash.default.some(parts, isHex) ? 16 : 10;

            switch (parts.length) {
              case 2:
                {
                  const [domain, group] = parts;
                  this.domain = parseInt(domain, radix);
                  this.group = parseInt(group, radix);
                  this.type = AddressType.group;
                  pos = this.raw.writeUInt16LE(this.domain || 0, 0);
                  this.raw.writeUInt8(this.group || 0, pos);
                  break;
                }

              case 3:
                {
                  const [domain, subnet, device] = parts;
                  this.domain = parseInt(domain, radix);
                  this.subnet = parseInt(subnet, radix);
                  this.device = parseInt(device, radix);
                  this.type = AddressType.net;
                  pos = this.raw.writeUInt16LE(this.domain || 0, 0);
                  pos = this.raw.writeUInt8(this.subnet || 0, pos);
                  this.raw.writeUInt16LE(this.device || 0, pos);
                  break;
                }

              default:
                throw new Error('Invalid address');
            }
          } else {
            // MAC
            const [left, right, rest] = address.split('::', 3);

            if (rest) {
              throw new Error('Invalid address');
            }

            const lefts = left ? left.split(':') : [];
            const rights = right ? right.split(':') : [];
            let len = lefts.length + rights.length;

            if (len > MAC_LENGTH) {
              throw new Error('Invalid address');
            }

            const mac = lefts.map(parseHex);

            while (len < MAC_LENGTH) {
              mac.push(0);
              len += 1;
            }

            mac.push(...rights.map(parseHex));

            if (_lodash.default.some(mac, byte => byte < 0 || byte > 255)) {
              throw new Error('Invalid address');
            }

            this.mac = Buffer.from(mac);
            this.raw = this.mac;

            if (isEmpty(mac)) {
              this.type = AddressType.empty;
            } else if (isBroadcast(mac)) {
              this.type = AddressType.broadcast;
            } else {
              this.type = AddressType.mac;
            }
          }

      }
    } else if ((Array.isArray(address) || address instanceof Uint8Array) && address.length === MAC_LENGTH) {
      this.mac = Buffer.from(address);
      this.raw = this.mac;

      if (isEmpty(address)) {
        this.type = AddressType.empty;
      } else if (isBroadcast(address)) {
        this.type = AddressType.broadcast;
      } else {
        this.type = AddressType.mac;
      }
    } else if (address instanceof Address) {
      this.raw = Buffer.from(address.raw);
      this.type = address.type;

      if (address.mac) {
        this.mac = this.raw;
      }

      this.domain = address.domain;
      this.group = address.group;
      this.subnet = address.subnet;
      this.device = address.device;
    } else {
      throw new Error('Invalid address');
    }

    const value = this.raw;
    Object.defineProperty(this, 'raw', {
      value,
      enumerable: false
    });
    Object.freeze(this);
  }

  get isEmpty() {
    return this.type === AddressType.empty;
  }

  get isBroadcast() {
    return this.type === AddressType.broadcast;
  }

  get rawType() {
    switch (this.type) {
      case AddressType.empty:
      case AddressType.broadcast:
        return AddressType.mac;

      default:
        console.assert(0 <= this.type && this.type <= 2);
        return this.type;
    }
  }

  toString() {
    switch (this.type) {
      case AddressType.empty:
        return '::0';

      case AddressType.broadcast:
        return 'FF:FF:FF:FF:FF:FF';

      case AddressType.group:
        return `${this.domain}.${this.group}`;

      case AddressType.net:
        return `${this.domain}.${this.subnet}.${this.device}`;

      case AddressType.mac:
        {
          const mac = this.mac ? [...this.mac] : [];
          const first = mac.findIndex(b => b > 0);
          const str = [...mac.slice(first)].map(b => `0${b.toString(16)}`.slice(-2)).join(':').toUpperCase();
          return first > 0 ? `::${str}` : str;
        }

      default:
        throw new Error('Invalid address type');
    }
  }

  equals(other) {
    if (other == null) {
      return false;
    }

    const otherAddress = other instanceof Address ? other : new Address(other);
    return otherAddress.toString() === this.toString();
  }

}

exports.default = Address;

_defineProperty(Address, "autocount", 1);

_defineProperty(Address, "empty", new Address());

_defineProperty(Address, "broadcast", new Address('broadcast'));