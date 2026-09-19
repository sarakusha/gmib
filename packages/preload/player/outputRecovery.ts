import { OUTPUT_HEALTH_STALL_TIMEOUT } from '/@common/outputHealth';

/** Preserve the ladder across replacement windows; only sustained frames reset it. */
export default class OutputRecovery {
  private activeSince?: number;
  private progressSince?: number;
  private previousFrame?: number;
  private recoveredAt?: number;
  private stage = 0;

  observe(active: boolean, lastFrame: number | undefined, now: number) {
    if (!active) {
      this.activeSince = undefined;
      this.progressSince = undefined;
      return 'idle' as const;
    }
    this.activeSince ??= now;
    if (
      lastFrame !== undefined &&
      lastFrame !== this.previousFrame &&
      lastFrame >= this.activeSince
    ) {
      if (this.previousFrame === undefined || lastFrame - this.previousFrame > 10_000)
        this.progressSince = lastFrame;
      this.progressSince ??= lastFrame;
      this.previousFrame = lastFrame;
      if (lastFrame - this.progressSince >= OUTPUT_HEALTH_STALL_TIMEOUT) {
        this.stage = 0;
        this.recoveredAt = undefined;
      }
    }
    const deadline = Math.max(this.activeSince, lastFrame ?? 0, this.recoveredAt ?? 0);
    if (now - deadline < OUTPUT_HEALTH_STALL_TIMEOUT) return 'waiting' as const;
    this.progressSince = undefined;
    if (this.stage >= 2) return 'exhausted' as const;
    this.stage += 1;
    this.recoveredAt = now;
    return this.stage === 1 ? ('reattach' as const) : ('recreate' as const);
  }
}
