import { mergeStreams } from '@sarakusha/ebml';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const workers = vi.hoisted(
  () =>
    [] as {
      onmessage?: (event: MessageEvent) => void;
      onerror?: (event: ErrorEvent) => void;
      postMessage: ReturnType<typeof vi.fn>;
      terminate: ReturnType<typeof vi.fn>;
    }[],
);

vi.mock('./decoder?worker&inline', () => ({
  default: class {
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor() {
      workers.push(this);
    }
  },
}));

import VideoSource from './VideoSource';

beforeEach(() => {
  workers.length = 0;
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout, clearTimeout });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('VideoSource with the real sequential stream merger', () => {
  it.each(['decoder', 'worker'] as const)(
    'keeps the output stream usable after a %s failure',
    async failure => {
      const output = mergeStreams<VideoFrame>();
      const received: VideoFrame[] = [];
      const controller = new AbortController();
      const drain = output
        .pipeTo(
          new WritableStream({
            write: frame => {
              received.push(frame);
            },
          }),
          {
            signal: controller.signal,
          },
        )
        .catch(() => undefined);
      const bad = new VideoSource('/bad.webm');
      const first = output.add(bad.readable);
      if (failure === 'decoder') {
        workers[0].onmessage?.(
          new MessageEvent('message', {
            data: { err: { message: 'invalid bitstream' } },
          }),
        );
      } else {
        workers[0].onerror?.({ preventDefault() {}, message: 'worker crashed' } as ErrorEvent);
      }
      await expect(first).resolves.toBeUndefined();
      expect(bad.closed).toBe(true);

      const good = new VideoSource('/good.webm');
      const frame = { timestamp: 0, close: vi.fn() } as unknown as VideoFrame;
      const second = output.add(good.readable);
      workers[1].onmessage?.(new MessageEvent('message', { data: { frame } }));
      workers[1].onmessage?.(new MessageEvent('message', { data: { done: true } }));
      await expect(second).resolves.toBeUndefined();
      expect(received).toEqual([frame]);
      expect(frame.close).not.toHaveBeenCalled();
      controller.abort();
      await drain;
    },
  );

  it('releases a frame arriving from a retired decoder without forwarding its event', () => {
    const onMessage = vi.fn();
    const source = new VideoSource('/old.webm', { onMessage });
    source.close();
    const close = vi.fn();
    workers[0].onmessage?.(
      new MessageEvent('message', {
        data: { frame: { timestamp: 0, close } },
      }),
    );
    expect(close).toHaveBeenCalledOnce();
    expect(onMessage).not.toHaveBeenCalled();
  });
});
