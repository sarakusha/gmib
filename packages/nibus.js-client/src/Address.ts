/*
 * @license
 * Copyright (c) 2019. OOO Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import _ from 'lodash';

const MAC_LENGTH = 6;

const isHex = (str: string) => /^(?:0X[0-9A-F]+)|(?:[0-9]*[A-F]+)/i.test(str);
const parseHex = (str: string) => parseInt(str, 16);

export enum AddressType {
  broadcast = 'broadcast',
  empty = 'empty',
  mac = 0,
  net = 1,
  group = 2,
}

const isEmpty = (array: number[] | Uint8Array) => _.every(array, b => b === 0);
const isBroadcast = (array: number[] | Uint8Array) => _.every(array, b => b === 255);

export type AddressParam = string | Buffer | number[] | Uint8Array | Address;

export default class Address {
  private static autocount = 1;
  public static readonly empty = new Address();
  public static broadcast = new Address('broadcast');

  public static toAddress(address?: AddressParam | null) {
    if (address == null) {
      return address;
    }
    return address instanceof Address ? address! : new Address(address);
  }

  public static read(type: AddressType, buffer: Buffer, offset: number = 0): Address {
    if (buffer.length - offset < MAC_LENGTH) {
      throw new Error('Invalid buffer length');
    }
    switch (type) {
      case AddressType.mac: {
        const mac = buffer.slice(offset, offset + MAC_LENGTH);
        return new Address(mac);
      }
      case AddressType.net: {
        const net = [
          buffer.readUInt16LE(offset),
          buffer.readUInt8(offset + 2),
          buffer.readUInt16LE(offset + 3),
        ];
        return new Address(net.join('.'));
      }
      case AddressType.group: {
        const group = [
          buffer.readUInt16LE(offset),
          buffer.readUInt8(offset + 2),
        ];
        return new Address(group.join('.'));
      }
      default:
        throw new Error(`Invalid address type ${type}`);
    }
  }

  public readonly type: AddressType;
  public readonly domain?: number;
  public readonly group?: number;
  public readonly subnet?: number;
  public readonly device?: number;
  public readonly mac?: Buffer;
  public readonly raw: Buffer;

  constructor(address: AddressParam = '') {
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
        case 'auto': {
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
            const radix = _.some(parts, isHex) ? 16 : 10;
            switch (parts.length) {
              case 2: {
                const [domain, group] = parts;
                this.domain = parseInt(domain, radix);
                this.group = parseInt(group, radix);
                this.type = AddressType.group;
                pos = this.raw.writeUInt16LE(this.domain || 0, 0);
                this.raw.writeUInt8(this.group || 0, pos);
                break;
              }
              case 3: {
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
            if (_.some(mac, byte => byte < 0 || byte > 255)) {
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
    } else if ((Array.isArray(address) || address instanceof Uint8Array)
      && address.length === MAC_LENGTH) {
      this.mac = Buffer.from(address as any[]);
      this.raw = this.mac!;
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
      enumerable: false,
    });
    Object.freeze(this);
  }

  get isEmpty() {
    return this.type === AddressType.empty;
  }

  get isBroadcast() {
    return this.type === AddressType.broadcast;
  }

  get rawType(): number {
    switch (this.type) {
      case AddressType.empty:
      case AddressType.broadcast:
        return AddressType.mac;
      default:
        console.assert(0 <= this.type && this.type <= 2);
        return this.type;
    }
  }

  public toString() {
    switch (this.type) {
      case AddressType.empty:
        return '::0';
      case AddressType.broadcast:
        return 'FF:FF:FF:FF:FF:FF';
      case AddressType.group:
        return `${this.domain}.${this.group}`;
      case AddressType.net:
        return `${this.domain}.${this.subnet}.${this.device}`;
      case AddressType.mac: {
        const mac = this.mac ? [...this.mac] : [];
        const first = mac.findIndex(b => b > 0);
        const str = [...mac.slice(first)]
          .map(b => `0${b.toString(16)}`.slice(-2))
          .join(':')
          .toUpperCase();
        return first > 0 ? `::${str}` : str;
      }
      default:
        throw new Error('Invalid address type');
    }
  }

  public equals(other?: string | number[] | Buffer | Address | null): boolean {
    if (other == null) {
      return false;
    }
    const otherAddress = other instanceof Address ? other : new Address(other);
    return otherAddress.toString() === this.toString();
  }
}
