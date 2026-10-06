/// <reference lib="webworker" />
import EbmlDecoder from '@sarakusha/ebml';
import CancelError from '@sarakusha/ebml/CancelError';
import type { FadeOptions } from '@sarakusha/ebml/FadeTransform';
import FadeTransform from '@sarakusha/ebml/FadeTransform';
import RangeFetcher from '@sarakusha/ebml/RangeFetcher';
import VideoChunkGenerator from '@sarakusha/ebml/VideoChunkGenerator';
import VideoFrameGenerator from '@sarakusha/ebml/VideoFrameGenerator';

import { getLinuxDecoderConfig } from './playbackEngine';
import FramePacer from './FramePacer';

let controller: AbortController | undefined;
let readable: ReadableStream<VideoFrame> | undefined;
const noop = () => {};
let play = noop;
let pause = noop;
let cancel = false;

let fade: FadeTransform | undefined;
let pacer: FramePacer | undefined;

const serializeError = (err: unknown) => {
  if (err instanceof CancelError) return undefined;
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return { message: String(err) };
};

onmessage = async (event: MessageEvent<unknown>) => {
  const data = event.data;
  if (typeof data !== 'object' || data === null) return;
  const d = data as {
    uri?: string;
    fade?: FadeOptions;
    closed?: boolean;
    startTime?: number;
    preferSoftwareDecoding?: boolean;
    play?: boolean;
    pause?: boolean;
    close?: boolean;
    disableFadeOut?: boolean;
    disableFadeIn?: boolean;
  };
  if ('uri' in data && typeof d.uri === 'string') {
    cancel = false;
    let decodedFrames = 0;
    const diagnostics = () => ({ decodedFrames, ...pacer?.diagnostics });
    try {
      const ebml = new EbmlDecoder();
      const chunkGenerator = new VideoChunkGenerator({ startTime: d.startTime });
      void chunkGenerator.config.then(
        () => postMessage({ ready: true }),
        err => {
          const serialized = serializeError(err);
          if (serialized) postMessage({ err: serialized, diagnostics: diagnostics() });
        },
      );
      const decoderConfig = chunkGenerator.config.then(config =>
        getLinuxDecoderConfig(
          config,
          /Linux/i.test(navigator.userAgent) ? 'linux' : 'win32',
          Boolean(d.preferSoftwareDecoding),
        ),
      );
      const frameGenerator = new VideoFrameGenerator(decoderConfig, 20);
      fade = new FadeTransform(d.fade);
      pacer = new FramePacer(d.closed, timer => postMessage({ timer }));
      play = pacer.open;
      pause = pacer.close;
      if (controller) controller.abort(new CancelError());
      controller = new AbortController();
      const fetcher = new RangeFetcher(d.uri, {
        abortController: controller,
        chunkSize: 5 * 1024 * 1024,
      });

      readable = fetcher
        .pipeThrough(ebml)
        .pipeThrough(chunkGenerator)
        .pipeThrough(frameGenerator)
        .pipeThrough(
          new TransformStream<VideoFrame, VideoFrame>({
            transform(frame, output) {
              decodedFrames += 1;
              output.enqueue(frame);
            },
          }),
        )
        .pipeThrough(fade)
        .pipeThrough(pacer);
      if (!readable) return;
      const reader = readable.getReader();
      const transfer = async () => {
        if (cancel) {
          await reader.cancel('cancel');
          return;
        }
        const { value: frame, done } = await reader.read();
        if (done) {
          postMessage({ done: true, diagnostics: diagnostics() });
          return;
        }
        if (frame) {
          postMessage({ frame }, [frame as never]);
        }
        await transfer();
      };
      await transfer();
    } catch (err) {
      const serialized = serializeError(err);
      if (serialized) postMessage({ err: serialized, diagnostics: diagnostics() });
    } finally {
      play = noop;
      pause = noop;

      close();
    }
  } else if ('play' in data && d.play) {
    play();
  } else if ('pause' in data && d.pause) {
    pause();
  } else if ('close' in data && d.close) {
    const reason = new CancelError();
    pacer?.cancel(reason);
    controller?.abort(reason);
    cancel = true;
  } else if ('disableFadeOut' in data) {
    fade?.setDisableFadeOut(Boolean(d.disableFadeOut));
  } else if ('disableFadeIn' in data) {
    fade?.setDisableFadeIn?.(Boolean(d.disableFadeIn));
  }
};
