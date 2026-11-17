import type { MediaInfo } from './mediaInfo';
import type { Playlist } from './playlist';
import type { Player } from './video';

export type PlaylistTimingSettings = Pick<
  Player,
  'playbackEngine' | 'disableFadeIn' | 'disableFadeOut'
>;

export const PLAYLIST_FADE_OUT_MS = 500;

/** Versioned identity of the ordered content and playback settings, independent of its name. */
export const getPlaylistTimingSignature = (
  playlist: Playlist,
  player: PlaylistTimingSettings,
): string =>
  JSON.stringify([
    1,
    player.playbackEngine ?? 'decoder',
    Boolean(player.disableFadeIn),
    Boolean(player.disableFadeOut),
    playlist.flags ?? 0,
    playlist.items.map(item => [
      item.id,
      item.md5,
      item.start ?? null,
      item.duration ?? null,
      item.flags ?? 0,
    ]),
  ]);

/** One pass, from the first frame to the final completion, excluding initial loading. */
export const calculatePlaylistDuration = (
  playlist: Playlist,
  media: Record<string, MediaInfo | undefined>,
  player: PlaylistTimingSettings,
): { mediaMs: number; fadeMs: number; totalMs: number; unknownItems: number } => {
  let mediaMs = 0;
  let fadeMs = 0;
  let unknownItems = 0;
  playlist.items.forEach((item, index) => {
    const duration = media[item.md5]?.duration;
    if (duration === undefined || !Number.isFinite(duration) || duration <= 0) {
      unknownItems += 1;
      return;
    }
    // The current playback engines play the entire file; legacy start/duration fields
    // are not applied by mediaStream. Do not promise trimming that playback doesn't do.
    mediaMs += duration * 1000;
    const next = playlist.items[(index + 1) % playlist.items.length];
    if (
      (player.playbackEngine ?? 'decoder') === 'decoder' &&
      !player.disableFadeOut &&
      item.md5 !== next?.md5
    ) {
      fadeMs += PLAYLIST_FADE_OUT_MS;
    }
  });
  return { mediaMs, fadeMs, totalMs: mediaMs + fadeMs, unknownItems };
};

export const formatPlaylistDuration = (milliseconds: number): string => {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '—';
  const tenths = Math.round(milliseconds / 100);
  const hours = Math.floor(tenths / 36_000);
  const minutes = Math.floor(tenths / 600) % 60;
  const seconds = Math.floor(tenths / 10) % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths % 10}`;
};
