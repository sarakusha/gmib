const DEFAULT_STALL_TIMEOUT = 30_000;
const POSITION_EPSILON = 0.01;

export default class PlaybackWatchdog {
  #active = false;

  #lastPosition: number | undefined;

  #lastProgressAt = 0;

  constructor(private readonly stallTimeout = DEFAULT_STALL_TIMEOUT) {}

  setActive(active: boolean, now = Date.now()): void {
    if (this.#active === active) return;
    this.#active = active;
    this.#lastPosition = undefined;
    this.#lastProgressAt = now;
  }

  defer(now = Date.now()): void {
    this.#lastProgressAt = now;
  }

  observe(active: boolean, position: number | undefined, now = Date.now()): boolean {
    this.setActive(active, now);
    if (!active) return false;

    if (
      typeof position === 'number' &&
      Number.isFinite(position) &&
      (this.#lastPosition === undefined ||
        Math.abs(position - this.#lastPosition) >= POSITION_EPSILON)
    ) {
      this.#lastPosition = position;
      this.#lastProgressAt = now;
      return false;
    }

    if (now - this.#lastProgressAt < this.stallTimeout) return false;
    this.#lastProgressAt = now;
    return true;
  }
}
