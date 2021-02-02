/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { NibusError, IDevice } from '@nibus/core';

import Runnable, { RunnableEvents } from './Runnable';

export type IModuleInfo<T> = {
  x: number;
  y: number;
  info?: T;
  error?: string;
};

type LoaderOptions = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  selectors?: Set<number>;
};

interface MinihostLoaderEvents<T> extends RunnableEvents {
  column: (column: IModuleInfo<T>[]) => void;
}

/*
declare interface MinihostLoader<T> {
  on(event: 'start', listener: () => void): this;
  on(event: 'finish', listener: () => void): this;
  on(event: 'column', listener: (column: IModuleInfo<T>[]) => void): this;
  once(event: 'start', listener: () => void): this;
  once(event: 'finish', listener: () => void): this;
  once(event: 'column', listener: (column: IModuleInfo<T>[]) => void): this;
  addListener(event: 'start', listener: () => void): this;
  addListener(event: 'finish', listener: () => void): this;
  addListener(event: 'column', listener: (column: IModuleInfo<T>[]) => void): this;
  off(event: 'start', listener: () => void): this;
  off(event: 'finish', listener: () => void): this;
  off(event: 'column', listener: (column: IModuleInfo<T>[]) => void): this;
  removeListener(event: 'start', listener: () => void): this;
  removeListener(event: 'finish', listener: () => void): this;
  removeListener(event: 'column', listener: (column: IModuleInfo<T>[]) => void): this;
  emit(event: 'start'): boolean;
  emit(event: 'finish'): boolean;
  emit(event: 'column', column: IModuleInfo<T>[]): boolean;
}
*/

abstract class MinihostLoader<T> extends Runnable<
  LoaderOptions,
  MinihostLoaderEvents<T>,
  IModuleInfo<T>[]
> {
  protected xMin?: number;

  protected xMax?: number;

  protected yMin?: number;

  protected yMax?: number;

  protected selectors?: Set<number>;

  protected constructor(readonly device: IDevice) {
    super();
  }

  abstract getInfo(x: number, y: number): Promise<T>;

  abstract isInvertH(): boolean;

  abstract isInvertV(): boolean;

  private async readColumn(x: number): Promise<IModuleInfo<T>[]> {
    const { yMin, yMax } = this;
    const columnInfo: IModuleInfo<T>[] = [];
    let y = yMin!;
    try {
      while (y <= yMax! && !this.isCanceled) {
        // eslint-disable-next-line no-await-in-loop
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

  async runImpl({ xMin, xMax, yMin, yMax, selectors }: LoaderOptions): Promise<IModuleInfo<T>[]> {
    this.xMin = xMin;
    this.xMax = xMax;
    this.yMin = yMin;
    this.yMax = yMax;
    this.selectors = new Set(selectors);
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
      // eslint-disable-next-line no-await-in-loop
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
