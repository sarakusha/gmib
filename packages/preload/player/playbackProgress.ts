export type PlaybackProgressSegment = {
  segmentStartedAt: string;
  timestamp: string;
  playedMs: number;
};

/** Count observed playback advance, never a seek jump or idle wall-clock time. */
export default class PlaybackProgress {
  private position?: number;
  private observedAt?: number;
  private segmentStart?: number;
  private segmentEnd?: number;
  private playedMs = 0;

  constructor(private readonly emit: (segment: PlaybackProgressSegment) => void) {}

  reset(position?: number, now = Date.now()): void {
    this.flush();
    this.position = position;
    this.observedAt = now;
  }

  observe(position: number, now = Date.now()): void {
    if (!Number.isFinite(position) || !Number.isFinite(now)) return;
    // Calendar time locates intervals in reports. A clock correction must not
    // create a negative interval or credit time across a backwards jump.
    if (this.observedAt !== undefined && now < this.observedAt) this.reset(undefined, now);
    if (this.position !== undefined && this.observedAt !== undefined) {
      const wallMs = Math.max(0, now - this.observedAt);
      const advanceMs = Math.max(0, (position - this.position) * 1000);
      const playedMs = Math.min(wallMs, advanceMs);
      // Do not spread credited playback across a long stalled interval. Account for
      // the observed advance at the end of that interval; accuracy is sample-bounded.
      const stalled = wallMs - playedMs > 250;
      if (stalled || position < this.position) this.flush();
      if (advanceMs > 0) {
        this.segmentStart ??= stalled ? now - playedMs : this.observedAt;
        this.segmentEnd = now;
        // Cap once per segment, not once per frame: delivery jitter often pairs
        // a delayed frame with a quickly arriving next frame.
        this.playedMs += stalled ? playedMs : advanceMs;
      }
    }
    this.position = position;
    this.observedAt = now;
    if (this.segmentStart !== undefined && now - this.segmentStart >= 15_000) this.flush();
  }

  flush(): void {
    if (this.segmentStart !== undefined && this.segmentEnd !== undefined && this.playedMs > 0) {
      this.emit({
        segmentStartedAt: new Date(this.segmentStart).toISOString(),
        timestamp: new Date(this.segmentEnd).toISOString(),
        playedMs: Math.max(0, Math.min(this.playedMs, this.segmentEnd - this.segmentStart)),
      });
    }
    this.segmentStart = undefined;
    this.segmentEnd = undefined;
    this.playedMs = 0;
  }
}
