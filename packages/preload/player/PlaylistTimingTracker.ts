import type { PlaybackEvent } from '/@common/playback';
import type { Playlist } from '/@common/playlist';
import { getPlaylistTimingSignature, type PlaylistTimingSettings } from '/@common/playlistTiming';

/** Only uninterrupted, ordered passes contribute. The monotonic clock includes inter-item gaps. */
export class PlaylistTimingTracker {
  private readonly contaminated = new Set<string>();
  private pass?: {
    signature: string;
    playlistId: number;
    index: number;
    started: number;
    playbackId?: string;
  };

  constructor(private readonly now: () => number = () => performance.now()) {}

  reset(): void {
    this.pass = undefined;
  }

  observe(
    event: Pick<
      PlaybackEvent,
      'event' | 'playlistId' | 'itemId' | 'mediaId' | 'playbackId' | 'engine'
    >,
    playlist: Playlist | undefined,
    settings: PlaylistTimingSettings,
  ): { signature: string; elapsedMs: number } | undefined {
    if (!playlist?.items.length || event.playlistId !== playlist.id) {
      this.reset();
      return undefined;
    }
    if (event.event !== 'started' && event.event !== 'completed') {
      // Output visibility observations do not change how long the content plays.
      if (event.event !== 'output-changed' && event.event !== 'progress') {
        this.reset();
        // A seek can happen before the first frame. Its subsequent started event
        // still belongs to the shortened attempt and must not begin a clean pass.
        this.contaminated.add(event.playbackId);
        if (this.contaminated.size > 100) {
          const oldest = this.contaminated.values().next().value;
          if (oldest !== undefined) this.contaminated.delete(oldest);
        }
      }
      return undefined;
    }
    if (this.contaminated.has(event.playbackId)) {
      this.reset();
      return undefined;
    }
    if (event.engine !== (settings.playbackEngine ?? 'decoder')) {
      this.reset();
      return undefined;
    }
    const signature = getPlaylistTimingSignature(playlist, settings);
    if (signature.length > 65_536) {
      this.reset();
      return undefined;
    }
    if (this.pass?.signature !== signature || this.pass?.playlistId !== playlist.id) this.reset();
    if (event.event === 'started') {
      if (this.pass?.playbackId) this.reset();
      const first = playlist.items[0];
      if (!this.pass && event.itemId === first.id && event.mediaId === first.md5) {
        this.pass = { signature, playlistId: playlist.id, index: 0, started: this.now() };
      }
      const expected = this.pass && playlist.items[this.pass.index];
      if (!expected || expected.id !== event.itemId || expected.md5 !== event.mediaId) {
        this.reset();
      } else if (this.pass) this.pass.playbackId = event.playbackId;
      return undefined;
    }
    const pass = this.pass;
    const expected = pass && playlist.items[pass.index];
    if (
      !pass ||
      pass.playbackId !== event.playbackId ||
      expected?.id !== event.itemId ||
      expected?.md5 !== event.mediaId
    ) {
      this.reset();
      return undefined;
    }
    pass.index += 1;
    pass.playbackId = undefined;
    if (pass.index < playlist.items.length) return undefined;
    const elapsedMs = this.now() - pass.started;
    this.reset();
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || elapsedMs > 7 * 24 * 60 * 60 * 1000)
      return undefined;
    return { signature, elapsedMs };
  }
}
