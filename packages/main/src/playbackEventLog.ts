import fs from 'node:fs/promises';
import path from 'node:path';

import type { PlaybackEvent } from '/@common/playback';

const PLAYBACK_LOG_RE = /^playback-(\d{4}-\d{2}-\d{2})\.jsonl$/;

export type PlaybackLogFileSystem = Pick<typeof fs, 'appendFile' | 'mkdir' | 'readdir' | 'unlink'>;

export type PlaybackEventLogOptions = {
  directory: string;
  retentionDays: () => number;
  now?: () => Date;
  fileSystem?: PlaybackLogFileSystem;
  onMaintenanceError?: (error: unknown) => void;
};

export const utcDate = (date: Date): string => date.toISOString().slice(0, 10);

export const oldestRetainedUtcDate = (date: Date, retentionDays: number): string => {
  const oldest = new Date(date);
  oldest.setUTCDate(oldest.getUTCDate() - Math.max(1, retentionDays) + 1);
  return utcDate(oldest);
};

export class PlaybackEventLog {
  readonly directory: string;
  private readonly retentionDays: () => number;
  private readonly now: () => Date;
  private readonly fileSystem: PlaybackLogFileSystem;
  private readonly onMaintenanceError: (error: unknown) => void;
  private queue = Promise.resolve();
  private lastCleanupDate?: string;

  constructor(options: PlaybackEventLogOptions) {
    this.directory = options.directory;
    this.retentionDays = options.retentionDays;
    this.now = options.now ?? (() => new Date());
    this.fileSystem = options.fileSystem ?? fs;
    this.onMaintenanceError = options.onMaintenanceError ?? (() => undefined);
  }

  append(event: PlaybackEvent): Promise<void> {
    return this.enqueue(async () => {
      await this.fileSystem.mkdir(this.directory, { recursive: true });
      const now = this.now();
      const today = utcDate(now);
      if (this.lastCleanupDate !== today) {
        try {
          await this.cleanupFiles(now);
        } catch (error) {
          this.lastCleanupDate = today;
          this.onMaintenanceError(error);
        }
      }
      const eventDate = utcDate(new Date(event.timestamp));
      if (eventDate < oldestRetainedUtcDate(now, this.retentionDays()) || eventDate > today) return;
      const filename = path.join(this.directory, `playback-${eventDate}.jsonl`);
      await this.fileSystem.appendFile(filename, `${JSON.stringify(event)}\n`, 'utf8');
    });
  }

  cleanup(): Promise<void> {
    return this.enqueue(async () => {
      await this.fileSystem.mkdir(this.directory, { recursive: true });
      await this.cleanupFiles(this.now());
    });
  }

  private async cleanupFiles(now: Date): Promise<void> {
    const cutoff = oldestRetainedUtcDate(now, this.retentionDays());
    const entries = await this.fileSystem.readdir(this.directory);
    await Promise.all(
      entries.flatMap(filename => {
        const match = PLAYBACK_LOG_RE.exec(filename);
        return match?.[1] && match[1] < cutoff
          ? [this.fileSystem.unlink(path.join(this.directory, filename))]
          : [];
      }),
    );
    this.lastCleanupDate = utcDate(now);
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => undefined);
    return result;
  }
}
