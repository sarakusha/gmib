import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import { Box, Typography } from '@mui/material';
import type { MediaInfo } from '/@common/mediaInfo';
import type { Playlist } from '/@common/playlist';
import {
  calculatePlaylistDuration,
  formatPlaylistDuration,
  getPlaylistTimingSignature,
} from '/@common/playlistTiming';
import type { PlaylistTimingStatistics } from '/@common/playlistTimingStatistics';
import type { Player } from '/@common/video';

export type PlaylistDurationDisplay = {
  duration: string;
  correction?: string;
};

export const getPlaylistDurationDisplay = (
  playlist: Playlist,
  media: Record<string, MediaInfo | undefined>,
  player: Pick<Player, 'playbackEngine' | 'disableFadeIn' | 'disableFadeOut'>,
  statistics?: PlaylistTimingStatistics,
): PlaylistDurationDisplay => {
  const { fadeMs, mediaMs, unknownItems } = calculatePlaylistDuration(playlist, media, player);
  if (unknownItems > 0) {
    return {
      duration: mediaMs > 0 ? `≥ ${formatPlaylistDuration(mediaMs)}` : '—',
    };
  }
  const signature = getPlaylistTimingSignature(playlist, player);
  const sample = statistics?.samples.find(
    item =>
      item.playlistId === playlist.id &&
      item.signature === signature &&
      item.sampleCount >= 3 &&
      Number.isFinite(item.medianElapsedMs) &&
      item.medianElapsedMs > 0,
  );
  if (!sample && fadeMs === 0) {
    return {
      duration: formatPlaylistDuration(mediaMs),
    };
  }
  // Observed elapsed time already includes fading; do not add it a second time.
  const correctionMs = sample ? sample.medianElapsedMs - mediaMs : fadeMs;
  const correction = Math.round(correctionMs / 100) / 10;
  return {
    duration: formatPlaylistDuration(mediaMs),
    correction:
      correction === 0
        ? undefined
        : `${correction < 0 ? '−' : '+'}${Math.abs(correction).toFixed(1)} с`,
  };
};

const PlaylistDuration = ({ value }: { value?: PlaylistDurationDisplay }) => {
  if (!value) return null;
  return (
    <Box
      component="span"
      aria-label={`Длительность плейлиста: ${value.duration}${value.correction ? ` ${value.correction}` : ''}`}
      sx={{
        display: 'inline-flex',
        gap: 0.5,
        alignItems: 'baseline',
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
      }}
    >
      <TimerOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary', alignSelf: 'center' }} />
      <Typography component="span" variant="caption" color="text.secondary">
        {value.duration}
      </Typography>
      {value.correction && (
        <Typography component="span" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
          {value.correction}
        </Typography>
      )}
    </Box>
  );
};

export default PlaylistDuration;
