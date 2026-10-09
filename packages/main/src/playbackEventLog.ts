import fs from 'node:fs/promises';
import path from 'node:path';

const LEGACY_PLAYBACK_LOG = /^playback-(\d{4}-\d{2}-\d{2})\.jsonl(?:\.gz)?$/;

const isCalendarDate = (value: string): boolean => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/** Retire old daily logs without reading or importing them into playback.sqlite. */
export const cleanupLegacyPlaybackLogs = async (
  directory: string,
  retentionDays: number,
  now = new Date(),
): Promise<void> => {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) {
    throw new RangeError('Invalid playback log retention');
  }
  const oldest = new Date(now);
  oldest.setUTCDate(oldest.getUTCDate() - retentionDays + 1);
  const cutoff = oldest.toISOString().slice(0, 10);
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  await Promise.all(
    entries.map(async entry => {
      const date = LEGACY_PLAYBACK_LOG.exec(entry.name)?.[1];
      if (!entry.isFile() || !date || !isCalendarDate(date) || date >= cutoff) return;
      try {
        await fs.unlink(path.join(directory, entry.name));
      } catch (error) {
        // Another cleanup may have removed the same expired file concurrently.
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }),
  );
};
