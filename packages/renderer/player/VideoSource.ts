import DecoderWorker from './decoder?worker';

import type { FadeOptions } from '@sarakusha/ebml/FadeTransform';

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

  get duration() {
    return this.#duration;
  }

  constructor(readonly uri: string, readonly options: VideoSourceOptions = {}) {
    lastId += 1;
    this.id = lastId;
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
    setTimeout(
      () =>
        decoder.postMessage({
          uri,
          closed: !options.autoplay,
          ...(options.fade && { fade: options.fade }),
        }),
      options.delay ?? 0,
    );
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
      onMessage(ev);
    };

    this.decoder = decoder;
    this.readable = readable;
    this.close = close;
    this.#paused = !options.autoplay;
    this.play = () => {
      decoder.postMessage({ play: true });
      this.#paused = false;
    };
    this.pause = () => {
      decoder.postMessage({ pause: true });
      this.#paused = true;
    };
  }
}
