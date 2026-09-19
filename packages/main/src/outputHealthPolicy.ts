import {
  OUTPUT_HEALTH_RELOAD_COOLDOWN,
  OUTPUT_HEALTH_STALL_TIMEOUT,
  type PlayerOutputHealth,
} from '/@common/outputHealth';

export const hasConfirmedOutput = (health: PlayerOutputHealth, expectedIds: number[]): boolean =>
  expectedIds.length > 0 &&
  health.playbackState === 'playing' &&
  health.playable &&
  expectedIds.every(id =>
    health.outputs.some(
      output =>
        output.id === id &&
        output.state === 'showing' &&
        output.lastFrameAgeMs !== undefined &&
        output.lastFrameAgeMs < OUTPUT_HEALTH_STALL_TIMEOUT,
    ),
  );

/** Independent of renderer timers, but deliberately not an OS/application supervisor. */
export class OutputHealthPolicy {
  private lastReplyAt: number;
  private unhealthySince: number;
  private lastReloadAt = -Infinity;
  private latest?: PlayerOutputHealth;

  constructor(now: number) {
    this.lastReplyAt = now;
    this.unhealthySince = now;
  }

  report(health: PlayerOutputHealth, now: number): void {
    this.latest = health;
    this.lastReplyAt = now;
  }

  reset(now: number): void {
    this.latest = undefined;
    this.lastReplyAt = now;
    this.unhealthySince = now;
  }

  check(expectedIds: number[], active: boolean, now: number): string | undefined {
    if (!active || expectedIds.length === 0) {
      this.lastReplyAt = now;
      this.unhealthySince = now;
      return undefined;
    }
    const responsive = now - this.lastReplyAt < OUTPUT_HEALTH_STALL_TIMEOUT;
    // Quarantined/empty content is not an output failure. Reloading would discard
    // the renderer's quarantine and retry known broken files indefinitely.
    if (responsive && this.latest?.playbackState === 'playing' && !this.latest.playable) {
      this.unhealthySince = now;
      return undefined;
    }
    if (responsive && this.latest && hasConfirmedOutput(this.latest, expectedIds)) {
      this.unhealthySince = now;
      return undefined;
    }
    if (now - this.lastReloadAt < OUTPUT_HEALTH_RELOAD_COOLDOWN) return undefined;
    const reason = !responsive
      ? 'renderer did not answer output checks for 30 seconds'
      : now - this.unhealthySince >= 90_000
        ? 'output did not recover after 90 seconds'
        : undefined;
    if (reason) {
      this.lastReloadAt = now;
      this.reset(now);
    }
    return reason;
  }
}
