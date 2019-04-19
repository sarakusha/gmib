/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { IDevice } from '@nata/nibus.js-client/lib/mib';
import { EventEmitter } from 'events';

type ModuleInfo<T> = {
  x: number,
  y: number,
  info?: T,
  error?: Error | string,
};

abstract class MinihostLoader<T> extends EventEmitter {
  protected isCanceled = false;
  protected isRunning = false;
  private cancelPromise = Promise.resolve();
  private cancelResolve = () => {};
  protected xMin?: number;
  protected xMax?: number;
  protected yMin?: number;
  protected yMax?: number;

  // static abstract getResolutions(props?: Record<string, any>): {
  //   hres?: number,
  //   vres?: number,
  // }
  constructor(readonly device: IDevice) {
    super();
  }

  cancel() {
    if (!this.isRunning) return Promise.resolve();
    this.isCanceled = true;
    return this.cancelPromise;
  }

  abstract async getInfo(x: number, y: number): Promise<T>;
  abstract isInvertH(): boolean;
  abstract isInvertV(): boolean;

  private async readColumn(x: number) {
    const { yMin, yMax } = this;
    const columnInfo: ModuleInfo<T>[] = [];
    let y = yMin!;
    try {
      while (y <= yMax!) {
        if (this.isCanceled) {
          this.isRunning = false;
          this.cancelResolve();
          this.emit('finish');
          break;
        }
        const info = await this.getInfo(x, y);
        const module: ModuleInfo<T> = {
          x,
          y,
          info,
        };
        columnInfo.push(module);
        y += 1;
      }
    } catch (error) {
      while (y <= yMax!) {
        const module: ModuleInfo<T> = {
          x,
          y,
          error,
        };
        columnInfo.push(module);
        y += 1;
      }
    }
    return columnInfo;
  }

  async start(xMin: number, xMax: number, yMin: number, yMax: number) {
    if (this.isRunning) {
      await this.cancel();
    }
    this.xMin = xMin;
    this.xMax = xMax;
    this.yMin = yMin;
    this.yMax = yMax;
    this.isCanceled = false;
    this.cancelPromise = new Promise(resolve => this.cancelResolve = resolve);
    this.isRunning = true;
    this.emit('start');

    try {
      const modules: ModuleInfo<T>[] = [];
      const { xMin, xMax } = this;
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
    } finally {
      this.isRunning = false;
      this.emit('finish');
    }
  }
}

export default MinihostLoader;
