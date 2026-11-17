import { Box, Tooltip, Typography } from '@mui/material';
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
  explanation: string;
};

export const getPlaylistDurationDisplay = (
  playlist: Playlist,
  media: Record<string, MediaInfo | undefined>,
  player: Pick<Player, 'playbackEngine' | 'disableFadeIn' | 'disableFadeOut'>,
  statistics?: PlaylistTimingStatistics,
): PlaylistDurationDisplay => {
  const { totalMs, mediaMs, fadeMs, unknownItems } = calculatePlaylistDuration(
    playlist,
    media,
    player,
  );
  if (unknownItems > 0) {
    return {
      duration: mediaMs > 0 ? `≥ ${formatPlaylistDuration(mediaMs)}` : '—',
      explanation: `Полная длительность неизвестна: нет длительности у ${unknownItems} элементов. Показана сумма только известных длительностей роликов.`,
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
  const explanation = `Один полный проход: ролики ${formatPlaylistDuration(mediaMs)}, затухание ${(fadeMs / 1000).toFixed(1)} с.`;
  if (!sample) {
    return {
      duration: formatPlaylistDuration(totalMs),
      explanation: `${explanation} Для поправки нужны как минимум три полных прохода без пауз, перемоток, ошибок и ручных переключений на хосте с поддержкой этой статистики.`,
    };
  }
  // Round before choosing the sign so a small negative correction never reads “−0.0”.
  const correction = Math.round((sample.medianElapsedMs - totalMs) / 100) / 10;
  return {
    duration: formatPlaylistDuration(totalMs),
    correction: `${correction < 0 ? '−' : '+'}${Math.abs(correction).toFixed(1)} с`,
    explanation: `${explanation} Поправка по ${sample.sampleCount} проходам за последние 7 дней учитывает задержки между роликами. Ожидаемое время: ${formatPlaylistDuration(sample.medianElapsedMs)} (медиана).`,
  };
};

const PlaylistDuration = ({ value }: { value?: PlaylistDurationDisplay }) => {
  if (!value) return null;
  return (
    <Tooltip title={value.explanation}>
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
        <Typography component="span" variant="caption" color="text.secondary">
          {value.duration}
        </Typography>
        {value.correction && (
          <Typography component="span" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            {value.correction}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
};

export default PlaylistDuration;
