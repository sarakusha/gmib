import type { FadeOptions } from '@sarakusha/ebml/FadeTransform';

import DecoderWorker from './decoder?worker&inline';

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
  preferSoftwareDecoding?: boolean;
};

type DecoderMessage = {
  ready?: boolean;
  frame?: VideoFrame;
  done?: boolean;
  duration?: number;
  seekStartTime?: number;
  timer?: number;
  debug?: string;
  recoverableError?: {
    message?: string;
  };
  err?: {
    message?: string;
  };
};

export default class VideoSource {
  #closed = false;

  #paused = true;

  #hasStarted = false;

  #duration = 0;

  #ready = false;

  get ready() {
    return this.#ready;
  }

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
    let delayTimeout = 0;
    const close = (hidden?: true) => {
      if (this.#closed) return;
      this.#closed = true;
      window.clearTimeout(delayTimeout);
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
        preferSoftwareDecoding: options.preferSoftwareDecoding,
        ...(options.fade && { fade: options.fade }),
      });
    };
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
      const payload: unknown = ev.data;
      if (!payload || typeof payload !== 'object') return;
      const data = payload as DecoderMessage;
      if (this.#closed) {
        data.frame?.close();
        return;
      }
      if (data.ready) this.#ready = true;
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
      // Let the owner replace this source while it is still usable. In particular,
      // decoder recovery needs to attach the replacement before this stream closes.
      onMessage(ev);
      if (data.err) {
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
    };

    decoder.onerror = event => {
      event.preventDefault();
      if (this.#closed) return;
      onMessage(
        new MessageEvent('message', {
          data: { err: { message: event.message || 'Decoder worker failed' } },
        }),
      );
      close();
    };
    decoder.onmessageerror = () => {
      if (this.#closed) return;
      onMessage(
        new MessageEvent('message', {
          data: { err: { message: 'Decoder worker message could not be decoded' } },
        }),
      );
      close();
    };

    this.decoder = decoder;
    this.readable = readable;
    this.close = close;
    this.#paused = !options.autoplay;
    this.play = () => {
      if (this.#closed) return;
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
      if (this.#closed) return;
      decoder.postMessage({ pause: true });
      this.#paused = true;
    };
  }
}
