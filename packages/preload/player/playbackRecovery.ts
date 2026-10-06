import type { PlaylistItem } from '/@common/playlist';

export type PlaybackAttempt = {
  mediaId: string;
  itemId: string;
  filename?: string;
  playlistId?: number;
  engine?: 'decoder' | 'capture';
  attempt: number;
  playbackId: string;
  startedAt?: string;
  started: boolean;
  failed: boolean;
};

type MediaRecovery = {
  failures: number;
  everPlayed: boolean;
  cooldowns: number;
  blockedUntil?: number;
};

const UNKNOWN_COOLDOWN_MS = 5 * 60_000;
const PLAYED_COOLDOWN_MS = 30_000;
const UNKNOWN_MAX_COOLDOWN_MS = 30 * 60_000;
const PLAYED_MAX_COOLDOWN_MS = 5 * 60_000;

/** Failure streaks survive source replacement and are shared by duplicate playlist entries. */
export default class PlaybackRecovery {
  private readonly media = new Map<string, MediaRecovery>();

  private readonly attempts = new WeakMap<PlaybackAttempt, MediaRecovery>();

  constructor(
    readonly limit = 3,
    private readonly now: () => number = Date.now,
  ) {}

  blocked(mediaId: string): boolean {
    const until = this.media.get(mediaId)?.blockedUntil;
    return until !== undefined && this.now() < until;
  }

  hasPlayed(mediaId: string): boolean {
    return this.media.get(mediaId)?.everPlayed ?? false;
  }

  /** First rendered frame proves the file has played, without forgiving earlier errors. */
  markPlayable(mediaId: string): void {
    this.state(mediaId).everPlayed = true;
  }

  /** Earliest pending quarantine expiry, useful when every item is blocked. */
  nextRetryAt(): number | undefined {
    let next: number | undefined;
    const now = this.now();
    for (const { blockedUntil } of this.media.values()) {
      if (blockedUntil !== undefined && blockedUntil > now) {
        next = Math.min(next ?? blockedUntil, blockedUntil);
      }
    }
    return next;
  }

  /** A cooldown expires independently of playback success. The caller may now try the item. */
  releaseExpired(): string[] {
    const released: string[] = [];
    const now = this.now();
    for (const [mediaId, state] of this.media) {
      if (state.blockedUntil !== undefined && state.blockedUntil <= now) {
        delete state.blockedUntil;
        released.push(mediaId);
      }
    }
    return released;
  }

  begin(
    item: PlaylistItem,
    filename?: string,
    context: Pick<PlaybackAttempt, 'playlistId' | 'engine'> = {},
  ): PlaybackAttempt {
    const state = this.state(item.md5);
    const attempt: PlaybackAttempt = {
      ...context,
      mediaId: item.md5,
      itemId: item.id,
      filename,
      attempt: state.failures + 1,
      playbackId: crypto.randomUUID(),
      started: false,
      failed: false,
    };
    this.attempts.set(attempt, state);
    return attempt;
  }

  fail(attempt: PlaybackAttempt): boolean {
    if (attempt.failed) return false;
    // eslint-disable-next-line no-param-reassign
    attempt.failed = true;
    const state = this.media.get(attempt.mediaId);
    if (!state || this.attempts.get(attempt) !== state || this.blocked(attempt.mediaId)) {
      return false;
    }
    state.failures += 1;
    if (state.failures >= (state.everPlayed ? this.limit * 2 : this.limit)) {
      const base = state.everPlayed ? PLAYED_COOLDOWN_MS : UNKNOWN_COOLDOWN_MS;
      const cap = state.everPlayed ? PLAYED_MAX_COOLDOWN_MS : UNKNOWN_MAX_COOLDOWN_MS;
      state.blockedUntil = this.now() + Math.min(base * 2 ** state.cooldowns, cap);
      state.cooldowns += 1;
    }
    return true;
  }

  reset(mediaId: string): void {
    const played = this.hasPlayed(mediaId);
    this.media.set(mediaId, {
      failures: 0,
      everPlayed: played,
      cooldowns: 0,
    });
  }

  /** A full playback proves this media worked and clears its failure history. */
  succeeded(mediaId: string): void {
    this.media.set(mediaId, { failures: 0, everPlayed: true, cooldowns: 0 });
  }

  select(items: PlaylistItem[], current?: string, advance = false): PlaylistItem | undefined {
    if (!items.length) return undefined;
    const index = items.findIndex(item => item.id === current);
    const start = index < 0 ? 0 : index + Number(advance);
    return Array.from(
      { length: items.length },
      (_, offset) => items[(start + offset) % items.length],
    ).find(item => !this.blocked(item.md5));
  }

  private state(mediaId: string): MediaRecovery {
    let state = this.media.get(mediaId);
    if (!state) {
      state = { failures: 0, everPlayed: false, cooldowns: 0 };
      this.media.set(mediaId, state);
    }
    return state;
  }
}
