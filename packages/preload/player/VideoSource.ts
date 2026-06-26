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
  itemId?: string;
  onMessage?: VideoSourceMessageHandler;
  mediaId?: string;
  startTime?: number;
};

type DecoderMessage = {
  frame?: VideoFrame;
  done?: boolean;
  duration?: number;
  debug?: string;
  err?: {
    message?: string;
  };
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

  setDisableFadeOut(value = true) {
    this.options.fade = { ...this.options.fade, disableOut: value };
    this.decoder.postMessage({ disableFadeOut: value });
  }

  setDisableFadeIn(value = true) {
    this.options.fade = { ...this.options.fade, disableIn: value };
    this.decoder.postMessage({ disableFadeIn: value });
  }

  constructor(
    readonly uri: string,
    readonly options: VideoSourceOptions = {},
  ) {
    lastId += 1;
    this.id = lastId;
    this.#hasStarted = !!options.autoplay;
    const decoder = new DecoderWorker();
    let streamController: ReadableStreamDefaultController<VideoFrame> | undefined;
    const readable = new ReadableStream<VideoFrame>(
      {
        start: controller => {
          streamController = controller;
        },
        cancel: () => {
          close();
        },
      },
      new CountQueuingStrategy({ highWaterMark: 8 }),
    );
    const close = (hidden?: true) => {
      if (this.#closed) return;
      this.#closed = true;
      if (!hidden) {
        decoder.postMessage({ close: true });
        setTimeout(() => decoder.terminate(), 100);
      }
      try {
        streamController?.close();
      } catch {
        // Already closed or errored by the reader.
      }
      streamController = undefined;
    };
    const start = (closed?: boolean) => {
      decoder.postMessage({
        uri,
        closed,
        startTime: options.startTime,
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
    const sourceLabel =
      [options.itemId && `item=${options.itemId}`, options.mediaId && `media=${options.mediaId}`]
        .filter(Boolean)
        .join(' ') || uri;
    const onMessage = options.onMessage ? options.onMessage.bind(this) : () => {};
    decoder.onmessage = ev => {
      const payload: unknown = ev.data;
      if (!payload || typeof payload !== 'object') return;
      const data = payload as DecoderMessage;
      if (data.debug) debug(`${sourceLabel}: ${data.debug}`);
      if (data.frame) {
        if (streamController && !this.#closed && (streamController.desiredSize ?? 0) > 0) {
          streamController.enqueue(data.frame);
        } else {
          data.frame.close();
        }
      }
      if (data.done) {
        close(true);
      }
      if (typeof data.duration === 'number') this.#duration = data.duration;
      if (data.err) {
        debug(
          `${sourceLabel}: decoder error, ending source: ${data.err.message ?? 'unknown error'}`,
        );
        // Treat decoder failures as a source boundary so playback can continue
        // with the next item instead of tearing down the whole stream.
        try {
          streamController?.close();
        } catch {
          // Already closed by a concurrent close.
        }
        streamController = undefined;
        close(true);
      }
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
