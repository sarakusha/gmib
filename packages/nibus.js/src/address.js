import _ from 'lodash';

const MAC_LENGTH = 6;
const invalid = new Error('Invalid address');

const isHex = str => /^(?:0X[0-9A-F]+)|(?:[0-9]*[A-F]+)/i.test(str);
const parseHex = str => parseInt(str, 16);


const types = Object.freeze({
  empty: 'empty',
  broadcast: 'broadcast',
  group: 'group', // 2
  net: 'net', // 1
  mac: 'mac', // 0
});

export default class Address {
  static empty = new Address();
  static broadcast = new Address('broadcast');
  type = types.empty;
  domain = 0;
  group = 0;
  subnet = 0;
  device = 0;
  mac = Buffer.alloc(MAC_LENGTH);

  constructor(address = '') {
    if (typeof address === 'string') {
      switch (address) {
        case '':
          this.type = types.empty;
          break;
        case 'broadcast':
          this.type = types.broadcast;
          break;
        default:
          if (!/^[0-9A-FX.:]+$/i.test(address)) {
            throw invalid;
          }
          if (address.indexOf('.') !== -1) {
            const parts = address.split('.', 4);
            const radix = _.some(parts, isHex) ? 16 : 10;
            switch (parts.length) {
              case 2: {
                const [domain, group] = parts;
                this.domain = parseInt(domain, radix);
                this.group = parseInt(group, radix);
                this.type = types.group;
                break;
              }
              case 3: {
                const [domain, subnet, device] = parts;
                this.domain = parseInt(domain, radix);
                this.subnet = parseInt(subnet, radix);
                this.device = parseInt(device, radix);
                this.type = types.net;
                break;
              }
              default:
                throw invalid;
            }
          } else {
            // MAC
            // eslint-disable-next-line prefer-const
            let [left, right, rest] = address.split('::', 3);
            if (rest) throw invalid;
            left = left ? left.split(':') : [];
            right = right ? right.split(':') : [];
            let len = left.length + right.length;
            if (len > MAC_LENGTH) throw invalid;
            const mac = left.map(parseHex);
            while (len < MAC_LENGTH) {
              mac.push(0);
              len += 1;
            }
            mac.push(...right.map(parseHex));
            if (_.some(mac, byte => byte < 0 || byte > 255)) throw invalid;
            if (_.every(mac, byte => byte === 0)) {
              this.type = types.empty;
            } else if (_.every(mac, byte => byte === 255)) {
              this.type = types.broadcast;
            } else {
              this.mac = Buffer.from(mac);
              this.type = types.mac;
            }
          }
      }
    } else if ((Array.isArray(address) || address instanceof Uint8Array)
      && address.length === MAC_LENGTH) {
      this.mac = Buffer.from(address);
      this.type = types.mac;
    } else if (address instanceof Address) {
      this.type = address.type;
      this.mac = address.mac;
      this.domen = address.domen;
      this.group = address.group;
      this.subnet = address.subnet;
      this.device = address.device;
    } else {
      throw invalid;
    }
    Object.freeze(this);
  }

  get isEmpty() {
    return this.type === types.empty;
  }

  get raw() {
    const buffer = Buffer.alloc(MAC_LENGTH);
    let pos;
    switch (this.type) {
      case 'empty':
        return buffer;
      case 'broadcast':
        return Buffer.alloc(MAC_LENGTH, 255);
      case 'net':
        pos = buffer.writeUInt16LE(this.domain, 0);
        pos = buffer.writeUInt8(this.subnet, pos);
        buffer.writeUInt16LE(this.device, pos);
        return buffer;
      case 'group':
        pos = buffer.writeUInt16LE(this.domain, 0);
        buffer.writeUInt8(this.group, pos);
        return buffer;
      case 'mac':
        return Buffer.from(this.mac);
      default:
        return undefined;
    }
  }

  static read(type, buffer, offset) {
    if (!buffer || !buffer.length || buffer.length - offset < MAC_LENGTH) {
      throw new Error('Invalid buffer length');
    }
    switch (type) {
      case 0: {
        const mac = buffer.slice(offset, offset + MAC_LENGTH);
        return new Address(mac);
      }
      case 1: {
        const net = [
          buffer.readUInt16LE(offset),
          buffer.readUInt8(offset + 2),
          buffer.readUInt16LE(offset + 3),
        ];
        return new Address(net.join('.'));
      }
      case 2: {
        const group = [
          buffer.readUInt16LE(offset),
          buffer.readUInt8(offset + 2),
        ];
        return new Address(group.join('.'));
      }
      default:
        throw new Error('Invalid address type');
    }
  }

  toString() {
    switch (this.type) {
      case types.empty:
        return '::0';
      case types.broadcast:
        return 'FF:FF:FF:FF:FF:FF';
      case types.group:
        return `${this.domain}.${this.group}`;
      case types.net:
        return `${this.domain}.${this.subnet}.${this.device}`;
      case types.mac: {
        const first = this.mac.findIndex(b => b > 0);
        const str = [...this.mac.slice(first)]
          .map(b => `0${b.toString(16)}`.slice(-2))
          .join(':')
          .toUpperCase();
        return first > 0 ? `::${str}` : str;
      }
      default:
        throw new Error('Invalid address type');
    }
  }

  isEqual(other) {
    const otherAddress = other instanceof Address ? other : new Address(other);
    return otherAddress.toString() === this.toString();
  }
}
