/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { EventEmitter } from 'events';

declare interface Runnable<T, R = void> {
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
  run(options: T): Promise<R>;
  cancel(): Promise<void>;
}

abstract class Runnable<T, R = void> extends EventEmitter {
  protected isCanceled = false;

  protected isRunning = false;

  private cancelPromise = Promise.resolve();

  private cancelResolve = (): void => {};

  cancel(): Promise<void> {
    if (!this.isRunning) return Promise.resolve();
    this.isCanceled = true;
    return this.cancelPromise;
  }

  async run(options: T): Promise<R> {
    if (this.isRunning) {
      await this.cancel();
    }
    this.isCanceled = false;
    this.cancelPromise = new Promise(resolve => {
      this.cancelResolve = resolve;
    });
    this.isRunning = true;
    this.emit('start');
    try {
      return await this.runImpl(options);
    } finally {
      this.isRunning = false;
      this.emit('finish');
    }
  }

  protected abstract runImpl(options: T): Promise<R>;
}

export default Runnable;
