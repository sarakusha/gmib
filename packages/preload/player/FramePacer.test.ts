import ReducingValve from '@sarakusha/ebml/ReducingValve';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FramePacer from './FramePacer';

const frame = (milliseconds: number) =>
  ({ timestamp: milliseconds * 1000, close: vi.fn() }) as unknown as VideoFrame;

const consume = (pacer: TransformStream<VideoFrame, VideoFrame>) => {
  const frames: VideoFrame[] = [];
  const completed = pacer.readable.pipeTo(
    new WritableStream({
      write(value) {
        frames.push(value);
      },
    }),
  );
  return { frames, completed, writer: pacer.writable.getWriter() };
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  vi.stubGlobal('postMessage', vi.fn());
  await vi.advanceTimersByTimeAsync(1000);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('FramePacer', () => {
  it('reproduces the installed valve discarding an entire valid short clip after startup delay', async () => {
    const legacy = new ReducingValve(true);
    legacy.open();
    await vi.advanceTimersByTimeAsync(6000);
    const output = consume(legacy);
    for (let timestamp = 0; timestamp < 5000; timestamp += 40)
      await output.writer.write(frame(timestamp));
    await output.writer.close();
    await output.completed;
    expect(output.frames).toHaveLength(0);
    expect(postMessage).toHaveBeenCalledWith({ frames: 125, dropped: 125 });
  });

  it('plays all frames of the same delayed clip using a clock anchored to its first frame', async () => {
    const pacer = new FramePacer(true);
    pacer.open();
    await vi.advanceTimersByTimeAsync(6000);
    const output = consume(pacer);
    for (let timestamp = 0; timestamp < 5000; timestamp += 40) {
      if (timestamp) await vi.advanceTimersByTimeAsync(40);
      await output.writer.write(frame(timestamp));
    }
    await output.writer.close();
    await output.completed;
    expect(output.frames).toHaveLength(125);
    expect(pacer.diagnostics).toEqual({
      receivedFrames: 125,
      outputFrames: 125,
      droppedFrames: 0,
      clockRebases: 0,
    });
  });

  it('holds a preloaded frame until activated and excludes preload time from the clock', async () => {
    const pacer = new FramePacer(true);
    const output = consume(pacer);
    const first = frame(0);
    const pending = output.writer.write(first);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(output.frames).toEqual([]);
    pacer.open();
    await pending;
    await output.writer.close();
    await output.completed;
    expect(output.frames).toEqual([first]);
    expect(first.close).not.toHaveBeenCalled();
  });

  it('rebases after a long stall instead of dropping the remaining clip', async () => {
    const pacer = new FramePacer();
    const output = consume(pacer);
    await output.writer.write(frame(0));
    await vi.advanceTimersByTimeAsync(6000);
    await output.writer.write(frame(40));
    await vi.advanceTimersByTimeAsync(40);
    await output.writer.write(frame(80));
    await output.writer.close();
    await output.completed;
    expect(output.frames).toHaveLength(3);
    expect(pacer.diagnostics.clockRebases).toBe(1);
    expect(pacer.diagnostics.droppedFrames).toBe(0);
  });

  it('drops moderately late frames and paces a following frame without rebasing', async () => {
    const pacer = new FramePacer();
    const output = consume(pacer);
    await output.writer.write(frame(0));
    await vi.advanceTimersByTimeAsync(100);
    const late = frame(40);
    await output.writer.write(late);
    const pending = output.writer.write(frame(120));
    await vi.advanceTimersByTimeAsync(20);
    await pending;
    await output.writer.close();
    await output.completed;
    expect(late.close).toHaveBeenCalledOnce();
    expect(output.frames).toHaveLength(2);
    expect(pacer.diagnostics.droppedFrames).toBe(1);
    expect(pacer.diagnostics.clockRebases).toBe(0);
  });

  it('honors a pause during a timed wait and makes repeated play/pause idempotent', async () => {
    const pacer = new FramePacer();
    const output = consume(pacer);
    await output.writer.write(frame(0));
    const pending = output.writer.write(frame(100));
    await vi.advanceTimersByTimeAsync(25);
    pacer.close();
    await vi.advanceTimersByTimeAsync(200);
    pacer.close();
    await vi.advanceTimersByTimeAsync(300);
    expect(output.frames).toHaveLength(1);
    pacer.open();
    await vi.advanceTimersByTimeAsync(25);
    pacer.open();
    await vi.advanceTimersByTimeAsync(49);
    expect(output.frames).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    await output.writer.close();
    await output.completed;
    expect(output.frames).toHaveLength(2);
    expect(pacer.diagnostics.droppedFrames).toBe(0);
  });

  it.each(['paused', 'timed'] as const)(
    'cancels a %s frame without leaving a pending transform',
    async mode => {
      const pacer = new FramePacer(mode === 'paused');
      const output = consume(pacer);
      if (mode === 'timed') await output.writer.write(frame(0));
      const waiting = frame(mode === 'timed' ? 1000 : 0);
      const pending = output.writer.write(waiting);
      const failure = new Error('source retired');
      const writing = expect(pending).rejects.toThrow(failure);
      const reading = expect(output.completed).rejects.toThrow(failure);
      await vi.advanceTimersByTimeAsync(0);
      pacer.cancel(failure);
      await Promise.all([writing, reading]);
      expect(waiting.close).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
