/// <reference lib="webworker" />
import EbmlDecoder from '@sarakusha/ebml';
import CancelError from '@sarakusha/ebml/CancelError';
import type { FadeOptions } from '@sarakusha/ebml/FadeTransform';
import FadeTransform from '@sarakusha/ebml/FadeTransform';
import RangeFetcher from '@sarakusha/ebml/RangeFetcher';
import ReducingValve from '@sarakusha/ebml/ReducingValve';
import VideoChunkGenerator from '@sarakusha/ebml/VideoChunkGenerator';
import VideoFrameGenerator from '@sarakusha/ebml/VideoFrameGenerator';
// import VideoFrameTransformer from '@sarakusha/ebml/VideoFrameTransformer';

let controller: AbortController | undefined;
let readable: ReadableStream<VideoFrame> | undefined;
const noop = () => {};
let play = noop;
let pause = noop;
let cancel = false;
let fade: FadeTransform | undefined;

onmessage = async (event: MessageEvent<unknown>) => {
  const data = event.data;
  if (typeof data !== 'object' || data === null) return;
  const d = data as {
    uri?: string;
    fade?: FadeOptions;
    closed?: boolean;
    play?: () => void;
    pause?: () => void;
    close?: () => void;
    disableFadeOut?: boolean;
  };
  if ('uri' in data && typeof d.uri === 'string') {
    const ebml = new EbmlDecoder();
    const chunkGenerator = new VideoChunkGenerator();
    const frameGenerator = new VideoFrameGenerator(chunkGenerator.config, 20);
    fade = new FadeTransform(d.fade);
    const valve = new ReducingValve(d.closed);
    play = valve.open;
    pause = valve.close;
    if (controller) controller.abort(new CancelError());
    controller = new AbortController();
    const fetcher = new RangeFetcher(d.uri, {
      abortController: controller,
      chunkSize: 5 * 1024 * 1024,
    });

    try {
      readable = fetcher
        .pipeThrough(ebml)
        .pipeThrough(chunkGenerator)
        .pipeThrough(frameGenerator)
        .pipeThrough(fade)
        .pipeThrough(valve);
      if (!readable) return;
      const reader = readable.getReader();
      const transfer = async () => {
        if (cancel) {
          await reader.cancel('cancel');
          return;
        }
        const { value: frame, done } = await reader.read();
        if (done) {
          postMessage({ done: true });
          return;
        }
        if (frame) {
          postMessage({ frame }, [frame as never]);
        }
        await transfer();
      };
      await transfer();
    } catch (err) {
      postMessage({ err });
    } finally {
      play = noop;
      pause = noop;

      close();
    }
  } else if ('play' in data && d.play) {
    postMessage({ state: 'playing...', noop: play === noop });
    play();
  } else if ('pause' in data && d.pause) {
    pause();
  } else if ('close' in data && d.close) {
    controller?.abort(new CancelError());
    cancel = true;
  } else if ('disableFadeOut' in data) {
    fade?.setDisableFadeOut(Boolean(d.disableFadeOut));
  }
};
