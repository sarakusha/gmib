/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { IDevice } from '@nibus/core/lib/mib';
import { Address } from '@nibus/core';
import { EventEmitter } from 'events';
import { NibusConnection } from '@nibus/core/lib/nibus';
import { DeviceId } from '@nibus/core/lib/mib/devices';
import { NmsDatagram } from '@nibus/core/lib/nms';
import timeid from '../util/timeid';

export default class StubDevice extends EventEmitter implements IDevice {
  readonly address = Address.empty;
  readonly id: DeviceId;

  constructor(public connection?: NibusConnection) {
    super();
    this.id = timeid() as DeviceId;
  }

  download(domain: string, data: Buffer, offset?: number, noTerm?: boolean): Promise<void> {
    return Promise.reject(new Error('Not realized'));
  }

  drain(): Promise<number[]> {
    return Promise.reject(new Error('Not realized'));
  }

  execute(
    program: string,
    args?: Record<string, any>): Promise<NmsDatagram | NmsDatagram[] | undefined> {
    return Promise.reject(new Error('Not realized'));
  }

  getError(idOrName: number | string): any {
  }

  getId(idOrName: string | number): number {
    return 0;
  }

  getName(idOrName: string | number): string {
    return '';
  }

  getRawValue(idOrName: number | string): any {
  }

  isDirty(idOrName: string | number): boolean {
    return false;
  }

  read(...ids: number[]): Promise<{ [p: string]: any }> {
    return Promise.resolve({});
    // return Promise.reject(new Error('Not realized'));
  }

  release(): number {
    return 0;
  }

  upload(domain: string, offset?: number, size?: number): Promise<Buffer> {
    return Promise.reject(new Error('Not realized'));
  }

  write(...ids: number[]): Promise<number[]> {
    return Promise.reject(new Error('Not realized'));
  }
}
