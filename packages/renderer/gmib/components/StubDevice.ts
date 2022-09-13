/* eslint-disable class-methods-use-this,@typescript-eslint/no-explicit-any,
 @typescript-eslint/no-unused-vars */
import { EventEmitter } from 'events';

import timeid from '../util/timeid';

import type { DeviceId, IDevice, INibusConnection, NmsDatagram } from '@nibus/core';
import Address from '@nibus/core/Address';

export default class StubDevice extends EventEmitter implements IDevice {
  readonly address = Address.empty;

  readonly id: DeviceId;

  constructor(public connection?: INibusConnection) {
    super();
    this.id = timeid() as DeviceId;
  }

  download(_domain: string, _data: Buffer, _offset?: number, _noTerm?: boolean): Promise<void> {
    return Promise.reject(new Error('Not realized'));
  }

  drain(): Promise<number[]> {
    return Promise.reject(new Error('Not realized'));
  }

  execute(
    _program: string,
    _args?: Record<string, any>,
  ): Promise<NmsDatagram | NmsDatagram[] | undefined> {
    return Promise.reject(new Error('Not realized'));
  }

  getError(_idOrName: number | string): any {}

  getId(_idOrName: string | number): number {
    return 0;
  }

  getName(_idOrName: string | number): string {
    return '';
  }

  getRawValue(_idOrName: number | string): any {}

  isDirty(_idOrName: string | number): boolean {
    return false;
  }

  read(..._ids: number[]): Promise<{ [p: string]: any }> {
    return Promise.resolve({});
    // return Promise.reject(new Error('Not realized'));
  }

  release(): number {
    return 0;
  }

  upload(_domain: string, _offset?: number, _size?: number): Promise<Buffer> {
    return Promise.reject(new Error('Not realized'));
  }

  write(..._ids: number[]): Promise<number[]> {
    return Promise.reject(new Error('Not realized'));
  }

  toJSON(): unknown {
    return {};
  }
}
