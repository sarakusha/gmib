import type { IDevice } from '@nibus/core';
import type { NibusError } from '@nibus/core/errors';

import type { RunnableEvents } from '../../common/Runnable';
import Runnable from '../../common/Runnable';

import type { IModuleInfo, LoaderOptions } from '/@common/helpers';
import { calcMaxValue, isPositiveNumber, XMAX, YMAX } from '/@common/helpers';

interface MinihostLoaderEvents<T> extends RunnableEvents {
  column: (column: IModuleInfo<T>[]) => void;
}

// Не срабатывает instanceof!!!
const isNibusError = (error: unknown): error is NibusError =>
  Object.getPrototypeOf(error).constructor.name === 'NibusError';

abstract class MinihostLoader<T extends { t?: number }> extends Runnable<
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
    const { yMin = 0, yMax = 0 } = this;
    const columnInfo: IModuleInfo<T>[] = [];
    let y = yMin;
    try {
      while (y <= yMax && !this.isCanceled) {
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
      if (!isNibusError(error)) throw error;
      while (y <= yMax) {
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

  async runImpl(options: LoaderOptions): Promise<IModuleInfo<T>[]> {
    const { hres, vres, moduleHres, moduleVres, maxModulesH, maxModulesV } = this.device;
    const {
      xMin = 0,
      xMax = calcMaxValue(
        hres,
        moduleHres,
        isPositiveNumber(maxModulesH) ? maxModulesH.value : XMAX,
      ) - 1,
      yMin = 0,
      yMax = calcMaxValue(
        vres,
        moduleVres,
        isPositiveNumber(maxModulesV) ? maxModulesV.value : YMAX,
      ) - 1,
      selectors,
    } = options;
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
    while (!this.isCanceled && check(x)) {
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
