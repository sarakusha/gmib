export const PLAYBACK_HISTORY_MAX_OFFSET = 10_000;

/** Calendar dates are interpreted in the playback host's time zone; `to` is inclusive. */
export type PlaybackStatisticsQuery = {
  playerId: number;
  from?: string;
  to?: string;
};

export type PlaybackStatisticsMetrics = {
  starts: number;
  completed: number;
  errors: number;
  skipped: number;
  interrupted: number;
  successfulMs: number;
};

export type PlaybackStatisticsRow = PlaybackStatisticsMetrics & {
  mediaId: string;
  filename: string;
};

export type PlaybackStatisticsRange = { from: string; to: string };

export type PlaybackStatistics = {
  playerId: number;
  timeZone: string;
  today: string;
  generatedAt: string;
  requestedDates: PlaybackStatisticsRange;
  requested: PlaybackStatisticsRange;
  available: PlaybackStatisticsRange | null;
  effective: PlaybackStatisticsRange | null;
  clipped: boolean;
  totals: PlaybackStatisticsMetrics;
  rows: PlaybackStatisticsRow[];
  days: (PlaybackStatisticsMetrics & { date: string; hasRecords: boolean })[];
  quality: {
    ignoredLegacyRecords: number;
    invalidRecords: number;
    incompleteAttempts: number;
    unreadableFiles: number;
  };
};

export type PlaybackHistoryQuery = PlaybackStatisticsQuery & {
  mediaId: string;
  offset?: number;
  limit?: number;
};

export type PlaybackHistoryEntry = {
  playbackId: string;
  mediaId: string;
  filename: string;
  startedAt?: string;
  timestamp: string;
  outcome: 'completed' | 'error' | 'interrupted' | 'pending';
  playedMs: number;
  skipped: boolean;
  events: { event: string; timestamp: string; error?: string; reason?: string }[];
};

export type PlaybackHistory = {
  entries: PlaybackHistoryEntry[];
  total: number;
  offset: number;
  limit: number;
};
