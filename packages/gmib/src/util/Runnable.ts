/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { DefaultListener, TypedEmitter } from 'tiny-typed-emitter';

export interface RunnableEvents extends DefaultListener {
  start: () => void;
  finish: () => void;
}

abstract class Runnable<
  T,
  E extends RunnableEvents = RunnableEvents,
  R = void
> extends TypedEmitter<E> {
  protected isCanceled = false;

  protected isRunning = false;

  private cancelPromise = Promise.resolve();

  // eslint-disable-next-line class-methods-use-this
  private cancelResolve = (): void => {};

  cancel(): Promise<void> {
    if (!this.isRunning) return Promise.resolve();
    this.isCanceled = true;
    return this.cancelPromise;
  }

  async run(options: T): Promise<R> {
    const self = this as TypedEmitter<RunnableEvents>;
    if (this.isRunning) {
      await this.cancel();
    }
    this.isCanceled = false;
    this.cancelPromise = new Promise(resolve => {
      this.cancelResolve = resolve;
    });
    this.isRunning = true;
    self.emit('start');
    try {
      return await this.runImpl(options);
    } finally {
      this.isRunning = false;
      self.emit('finish');
      this.cancelResolve();
    }
  }

  protected abstract runImpl(options: T): Promise<R>;
}

export default Runnable;
