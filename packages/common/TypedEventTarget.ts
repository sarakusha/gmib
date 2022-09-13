/* eslint-disable @typescript-eslint/no-explicit-any */
import TypedEvent from './TypedEvent';
import { isTypedMessage } from './TypedMessage';

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

interface TypedEventListener {
  (event: TypedEvent): void;
}

type ListenerPair<T = unknown> = readonly [T, TypedEventListener];

export default class TypedEventTarget<
  L extends ListenerSignature<L> = DefaultListener,
> extends EventTarget {
  #listeners: { [P in keyof L]?: ListenerPair<L[P]>[] } = {};

  constructor(readonly target: string) {
    super();
    window.addEventListener('message', this.#eventListener);
  }

  #eventListener = (e: MessageEvent): void => {
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
    Object.entries(this.#listeners).forEach(([event, listeners]) => {
      (listeners as ListenerPair[]).forEach(([, eventListener]) =>
        this.removeEventListener(event, eventListener),
      );
    });
    this.#listeners = {};
    window.removeEventListener('message', this.#eventListener);
  }
}
