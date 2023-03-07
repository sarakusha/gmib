import type { FadeOptions } from '@sarakusha/ebml/FadeTransform';
import debugFactory from 'debug';

import DecoderWorker from './decoder?worker&inline';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:VideoSource`);
let lastId = 0;

export type VideoSourceMessageHandler = (this: VideoSource, ev: MessageEvent) => void;

export type VideoSourceOptions = {
  delay?: number;
  autoplay?: boolean;
  fade?: FadeOptions;
  index?: number;
  onMessage?: VideoSourceMessageHandler;
};

export default class VideoSource {
  #closed = false;

  #paused = true;

  #hasStarted = false;

  #duration = 0;

  readonly id;

  readonly decoder: Worker;

  readonly readable: ReadableStream<VideoFrame>;

  readonly close: () => void;

  readonly play: () => void;

  readonly pause: () => void;

  get closed() {
    return this.#closed;
  }

  get paused() {
    return this.#paused;
  }

  get hasStarted() {
    return this.#hasStarted;
  }

  get duration() {
    return this.#duration;
  }

  constructor(readonly uri: string, readonly options: VideoSourceOptions = {}) {
    lastId += 1;
    this.id = lastId;
    this.#hasStarted = !!options.autoplay;
    const decoder = new DecoderWorker();
    const { readable, writable } = new TransformStream<VideoFrame, VideoFrame>();
    const writer = writable.getWriter();
    const close = (hidden?: true) => {
      if (this.#closed) return;
      this.#closed = true;
      if (!hidden) {
        decoder.postMessage({ close: true });
        setTimeout(() => decoder.terminate(), 100);
      }
      writer.close().catch();
    };
    const start = (closed?: boolean) => {
      decoder.postMessage({
        uri,
        closed,
        ...(options.fade && { fade: options.fade }),
      });
    };
    let delayTimeout = 0;
    if (options.delay) {
      delayTimeout = window.setTimeout(() => {
        delayTimeout = 0;
        start(!options.autoplay);
      }, options.delay);
    } else {
      start(!options.autoplay);
    }
    const onMessage = options.onMessage ? options.onMessage.bind(this) : () => {};
    decoder.onmessage = ev => {
      const { data } = ev;
      if (typeof data !== 'object') return;
      if ('frame' in data) {
        if (readable.locked && !this.#closed) {
          writer.ready
            .then(() => writer.write(data.frame))
            .catch(() => {
              data.frame.close();
            });
        } else {
          data.frame.close();
        }
      }
      if ('done' in data && data.done) {
        close(true);
      }
      if ('duration' in data) this.#duration = data.duration;
      if ('err' in data) debug(`error: ${data.err.message}`);
      onMessage(ev);
    };

    this.decoder = decoder;
    this.readable = readable;
    this.close = close;
    this.#paused = !options.autoplay;
    this.play = () => {
      this.#hasStarted = true;
      if (delayTimeout) {
        window.clearTimeout(delayTimeout);
        delayTimeout = 0;
        start();
      } else {
        decoder.postMessage({ play: true });
      }
      this.#paused = false;
    };
    this.pause = () => {
      decoder.postMessage({ pause: true });
      this.#paused = true;
    };
  }
}
