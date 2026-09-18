import type { PlaylistItem } from '/@common/playlist';

export type PlaybackAttempt = {
  mediaId: string;
  itemId: string;
  filename?: string;
  attempt: number;
  playbackId: string;
  started: boolean;
  failed: boolean;
};

/** Failure streaks survive source replacement and are shared by duplicate playlist entries. */
export default class PlaybackRecovery {
  private readonly failures = new Map<string, number>();

  constructor(readonly limit = 3) {}

  blocked(mediaId: string): boolean {
    return (this.failures.get(mediaId) ?? 0) >= this.limit;
  }

  begin(item: PlaylistItem, filename?: string): PlaybackAttempt {
    return {
      mediaId: item.md5,
      itemId: item.id,
      filename,
      attempt: (this.failures.get(item.md5) ?? 0) + 1,
      playbackId: crypto.randomUUID(),
      started: false,
      failed: false,
    };
  }

  fail(attempt: PlaybackAttempt): boolean {
    if (attempt.failed) return false;
    // eslint-disable-next-line no-param-reassign
    attempt.failed = true;
    this.failures.set(attempt.mediaId, (this.failures.get(attempt.mediaId) ?? 0) + 1);
    return true;
  }

  reset(mediaId: string): void {
    this.failures.delete(mediaId);
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
}
