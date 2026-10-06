// A playback clock starts with the first decoded frame, not with a play request.
// Otherwise startup/IO delays can make every frame of a short clip appear late.
const LATE_FRAME_TOLERANCE = 1000 / 30;
const CLOCK_REBASE_THRESHOLD = 250;

export default class FramePacer extends TransformStream<VideoFrame, VideoFrame> {
  #paused: boolean;

  #baseTime: number | undefined;

  #pausedAt: number | undefined;

  #cancelled: Error | undefined;

  #wake: (() => void) | undefined;

  #receivedFrames = 0;

  #outputFrames = 0;

  #droppedFrames = 0;

  #clockRebases = 0;

  #lastTimerSecond = -1;

  get diagnostics() {
    return {
      receivedFrames: this.#receivedFrames,
      outputFrames: this.#outputFrames,
      droppedFrames: this.#droppedFrames,
      clockRebases: this.#clockRebases,
    };
  }

  constructor(paused = false, onTime?: (time: number) => void) {
    super({
      transform: async (frame, controller) => {
        this.#receivedFrames += 1;
        try {
          const timestamp = frame.timestamp / 1000;
          if (!Number.isFinite(timestamp)) throw new Error('Video frame has an invalid timestamp');
          for (;;) {
            if (this.#cancelled) throw this.#cancelled;
            if (this.#paused) {
              await this.#wait();
              continue;
            }
            const now = performance.now();
            if (this.#baseTime === undefined) this.#baseTime = now - timestamp;
            let remaining = timestamp - (now - this.#baseTime);
            if (remaining < -CLOCK_REBASE_THRESHOLD) {
              // A stalled worker/decoder must resume the clip instead of rapidly
              // discarding the rest of it to catch up with wall-clock time.
              this.#baseTime = now - timestamp;
              this.#clockRebases += 1;
              remaining = 0;
            } else if (remaining < -LATE_FRAME_TOLERANCE) {
              this.#droppedFrames += 1;
              frame.close();
              return;
            }
            if (remaining > 0) {
              await this.#wait(remaining);
              continue;
            }
            controller.enqueue(frame);
            this.#outputFrames += 1;
            const second = Math.floor(timestamp / 1000);
            if (second !== this.#lastTimerSecond) {
              this.#lastTimerSecond = second;
              onTime?.(timestamp / 1000);
            }
            return;
          }
        } catch (error) {
          frame.close();
          throw error;
        }
      },
    });
    this.#paused = paused;
  }

  #wait(milliseconds?: number): Promise<void> {
    return new Promise(resolve => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const wake = () => {
        clearTimeout(timer);
        if (this.#wake === wake) this.#wake = undefined;
        resolve();
      };
      this.#wake = wake;
      if (milliseconds !== undefined) timer = setTimeout(wake, milliseconds);
    });
  }

  open = (): void => {
    if (!this.#paused) return;
    if (this.#baseTime !== undefined && this.#pausedAt !== undefined)
      this.#baseTime += performance.now() - this.#pausedAt;
    this.#pausedAt = undefined;
    this.#paused = false;
    this.#wake?.();
  };

  close = (): void => {
    if (this.#paused) return;
    this.#paused = true;
    if (this.#baseTime !== undefined) this.#pausedAt = performance.now();
    this.#wake?.();
  };

  cancel = (reason: Error): void => {
    this.#cancelled = reason;
    this.#wake?.();
  };
}
