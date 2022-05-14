/* eslint-disable @typescript-eslint/no-explicit-any */
import TypedEvent from './TypedEvent';

import type { TypedMessage } from '/@common/helpers';

type ListenerSignature<L> = {
  [E in keyof L]: (...args: any[]) => any;
};

type DefaultListener = {
  [k: string]: (...args: any[]) => any;
};

// interface TypedEventTarget<L extends ListenerSignature<L> = DefaultListener> {
//   on<U extends keyof L>(event: U, listener: L[U]): this;
//   off<U extends keyof L>(event: U, listener: L[U]): this;
//   dispatchEvent<U extends keyof L>(event: U, ...args: Parameters<L[U]>): boolean;
// }

const hasProps = <N extends string>(data: unknown, ...names: N[]): data is Record<N, unknown> =>
  names.map(name => Object.prototype.hasOwnProperty.call(data, name)).every(Boolean);

const isTypedMessage = <T extends string>(data: unknown, target: T): data is TypedMessage<T> =>
  hasProps(data, 'target', 'type') && data.target === target && typeof data.type === 'string';

interface TypedEventListener {
  (event: TypedEvent): void;
}

export default class TypedEventTarget<
  L extends ListenerSignature<L> = DefaultListener,
> extends EventTarget {
  #listeners: { [P in keyof L]?: [L[P], TypedEventListener][] } = {};

  constructor(readonly target: string) {
    super();
    window.addEventListener('message', this.eventListener);
  }

  eventListener = (e: MessageEvent): void => {
    const { data, source } = e;
    if (source !== window || !isTypedMessage(data, this.target)) return;
    this.dispatchEvent(new TypedEvent(data.type, data.payload));
  };

  on<U extends keyof L>(event: U, listener: L[U], once = false): this {
    const eventListener: TypedEventListener = e => listener(e.payload);
    if (!this.#listeners[event]) {
      this.#listeners[event] = [];
    }
    const listeners = this.#listeners[event];
    listeners?.push([listener, eventListener]);
    this.addEventListener(event as string, eventListener, { once });
    return this;
  }

  once<U extends keyof L>(event: U, listener: L[U]): this {
    return this.on(event, listener, true);
  }

  off<U extends keyof L>(event: U, listener: L[U]): this {
    const listeners = this.#listeners[event];
    if (listeners) {
      const index = listeners.findIndex(item => item[0] === listener);
      if (index !== -1) {
        const [[, eventListener]] = listeners.splice(index, 1);
        this.removeEventListener(event as string, eventListener);
      }
    }

    return this;
  }

  release(): void {
    window.removeEventListener('message', this.eventListener);
  }
}
