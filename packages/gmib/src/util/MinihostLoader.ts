/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { NibusError } from '@nibus/core';
import { IDevice } from '@nibus/core/lib/mib';
import Runnable from './Runnable';

export type IModuleInfo<T> = {
  x: number,
  y: number,
  info?: T,
  error?: string,
};

type LoaderOptions = {
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
};

declare interface MinihostLoader<T> {
  on(event: 'start', listener: () => void): this;
  on(event: 'finish', listener: () => void): this;
  once(event: 'start', listener: () => void): this;
  once(event: 'finish', listener: () => void): this;
  addListener(event: 'start', listener: () => void): this;
  addListener(event: 'finish', listener: () => void): this;
  off(event: 'start', listener: () => void): this;
  off(event: 'finish', listener: () => void): this;
  removeListener(event: 'start', listener: () => void): this;
  removeListener(event: 'finish', listener: () => void): this;
  emit(event: 'start'): boolean;
  emit(event: 'finish'): boolean;
  on(event: 'column', listener: (column: IModuleInfo<T>[]) => void): this;
  once(event: 'column', listener: (column: IModuleInfo<T>[]) => void): this;
  addListener(event: 'column', listener: (column: IModuleInfo<T>[]) => void): this;
  off(event: 'column', listener: (column: IModuleInfo<T>[]) => void): this;
  removeListener(event: 'column', listener: (column: IModuleInfo<T>[]) => void): this;
  emit(event: 'column', column: IModuleInfo<T>[]): boolean;
}

abstract class MinihostLoader<T>
  extends Runnable<LoaderOptions, IModuleInfo<T>[]> {
  protected xMin?: number;
  protected xMax?: number;
  protected yMin?: number;
  protected yMax?: number;

  constructor(readonly device: IDevice) {
    super();
  }

  abstract async getInfo(x: number, y: number): Promise<T>;

  abstract isInvertH(): boolean;

  abstract isInvertV(): boolean;

  private async readColumn(x: number) {
    const { yMin, yMax } = this;
    const columnInfo: IModuleInfo<T>[] = [];
    let y = yMin!;
    try {
      while (y <= yMax! && !this.isCanceled) {
        const info = await this.getInfo(x, y);
        const module: IModuleInfo<T> = {
          x,
          y,
          info,
        };
        columnInfo.push(module);
        y += 1;
      }
    } catch (error) {
      if (!(error instanceof NibusError)) throw error;
      while (y <= yMax!) {
        const module: IModuleInfo<T> = {
          x,
          y,
          error: error.message,
        };
        columnInfo.push(module);
        y += 1;
      }
    }
    return columnInfo;
  }

  async runImpl({ xMin, xMax, yMin, yMax }: LoaderOptions) {
    this.xMin = xMin;
    this.xMax = xMax;
    this.yMin = yMin;
    this.yMax = yMax;
    const modules: IModuleInfo<T>[] = [];
    let x: number;
    let step: number;
    let check: (val: number) => boolean;
    if (this.isInvertH()) {
      x = xMax;
      step = -1;
      check = i => i >= xMin;
    } else {
      x = xMin;
      step = 1;
      check = i => i <= xMax;
    }
    while (check(x)) {
      let column = await this.readColumn(x);
      if (this.isInvertV()) {
        column = column.reverse();
      }
      this.emit('column', column);
      modules.push(...column);
      x += step;
    }
    return modules;
  }
}

export default MinihostLoader;
