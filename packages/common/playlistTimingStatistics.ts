/** A clean, uninterrupted pass, measured from the first frame to the last completion. */
export type PlaylistTimingSample = {
  signature: string;
  elapsedMs: number;
};

export type PlaylistTimingStatistics = {
  playerId: number;
  samples: {
    playlistId: number;
    signature: string;
    medianElapsedMs: number;
    sampleCount: number;
  }[];
};

export const isPlaylistTimingSample = (value: unknown): value is PlaylistTimingSample => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const sample = value as Record<string, unknown>;
  return (
    typeof sample['signature'] === 'string' &&
    sample['signature'].length > 0 &&
    sample['signature'].length <= 65_536 &&
    typeof sample['elapsedMs'] === 'number' &&
    Number.isFinite(sample['elapsedMs']) &&
    sample['elapsedMs'] > 0 &&
    sample['elapsedMs'] <= 7 * 24 * 60 * 60 * 1000
  );
};
