import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { PlaybackEvent } from '/@common/playback';

const PLAYBACK_LOG_RE = /^playback-(\d{4}-\d{2}-\d{2})\.jsonl(?:\.gz)?$/;
const MAX_DICTIONARY_ENTRIES = 4_096;
const MAX_TRACKED_RUNS = 10_000;
const MAX_RESIDENT_DAYS = 8;

type JsonRecord = Record<string, boolean | number | string | undefined>;

type DayState = {
  generation: number;
  initialized: boolean;
  nextContextId: number;
  nextMediaId: number;
  contexts: Map<string, number>;
  media: Map<string, number>;
};

type TrackedRun = {
  date: string;
  dayGeneration: number;
  run: number;
  startedAt: string;
  attribution: Pick<PlaybackEvent, 'engine' | 'filename' | 'mediaId' | 'playerId' | 'playlistId'>;
};

export type PlaybackLogFileSystem = Pick<typeof fs, 'appendFile' | 'mkdir' | 'readdir' | 'unlink'>;

export type PlaybackEventLogOptions = {
  directory: string;
  retentionDays: () => number;
  now?: () => Date;
  fileSystem?: PlaybackLogFileSystem;
  onMaintenanceError?: (error: unknown) => void;
  sessionId?: string;
};

export const utcDate = (date: Date): string => date.toISOString().slice(0, 10);

export const playbackLogFilename = (date: Date): string => `playback-${utcDate(date)}.jsonl`;

export const oldestRetainedUtcDate = (date: Date, retentionDays: number): string => {
  const oldest = new Date(date);
  oldest.setUTCDate(oldest.getUTCDate() - Math.max(1, retentionDays) + 1);
  return utcDate(oldest);
};

const utcTime = (timestamp: string): string => new Date(timestamp).toISOString().slice(11, 23);

const contextKey = (event: PlaybackEvent): string =>
  JSON.stringify([event.playerId, event.playlistId ?? null, event.engine ?? null]);

const mediaKey = (event: PlaybackEvent): string =>
  JSON.stringify([event.mediaId, event.filename ?? null]);

const runKey = (event: PlaybackEvent): string => JSON.stringify([event.playerId, event.playbackId]);

const isUtcCalendarDate = (value: string): boolean => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && utcDate(date) === value;
};

const trimOldest = <K>(
  collection: { delete(key: K): boolean; keys(): IterableIterator<K>; size: number },
  maximum: number,
): void => {
  while (collection.size > maximum) {
    const oldest = collection.keys().next().value;
    if (oldest === undefined) return;
    collection.delete(oldest);
  }
};

export class PlaybackEventLog {
  readonly directory: string;
  private readonly retentionDays: () => number;
  private readonly now: () => Date;
  private readonly fileSystem: PlaybackLogFileSystem;
  private readonly onMaintenanceError: (error: unknown) => void;
  private sessionId: string;
  private queue = Promise.resolve();
  private lastCleanupDate?: string;
  private readonly days = new Map<string, DayState>();
  private readonly runs = new Map<string, TrackedRun>();
  private readonly persistedQuarantines = new Set<string>();
  private nextRunId = 1;
  private nextDayGeneration = 1;

  constructor(options: PlaybackEventLogOptions) {
    this.directory = options.directory;
    this.retentionDays = options.retentionDays;
    this.now = options.now ?? (() => new Date());
    this.fileSystem = options.fileSystem ?? fs;
    this.onMaintenanceError = options.onMaintenanceError ?? (() => undefined);
    this.sessionId = options.sessionId ?? randomUUID();
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
      const timestamp = new Date(event.timestamp);
      const eventDate = utcDate(timestamp);
      if (eventDate < oldestRetainedUtcDate(now, this.retentionDays()) || eventDate > today) return;
      const eventRunKey = runKey(event);
      if (
        event.event === 'quarantined' &&
        event.quarantined &&
        this.persistedQuarantines.delete(eventRunKey)
      ) {
        return;
      }

      const day = this.days.get(eventDate) ?? this.createDay();
      const records: JsonRecord[] = [];
      if (!day.initialized) {
        records.push(
          { event: 'header', version: 2, date: eventDate, timezone: 'UTC' },
          { event: 'session', id: this.sessionId },
        );
      }

      const tracked = this.runs.get(eventRunKey);
      const attribution = tracked ? { ...event, ...tracked.attribution } : event;
      const context = this.referenceContext(day, attribution, records);
      const media = this.referenceMedia(day, attribution, records);
      const startedAt = tracked?.startedAt ?? event.startedAt;
      const isStarted = event.event === 'started';
      const sameDayRun =
        tracked?.date === eventDate && tracked.dayGeneration === day.generation
          ? tracked
          : undefined;
      const run = tracked?.run ?? this.nextRunId++;

      if (isStarted) {
        records.push({
          event: 'started',
          time: utcTime(event.timestamp),
          run,
          context,
          media,
          attempt: event.attempt > 1 ? event.attempt : undefined,
        });
      } else {
        const restoredRun = !sameDayRun && startedAt;
        if (restoredRun) {
          records.push({
            event: 'continued',
            time: utcTime(event.timestamp),
            run,
            context,
            media,
            startedAt,
            attempt: event.attempt > 1 ? event.attempt : undefined,
          });
        }
        records.push({
          event: event.event === 'quarantined' && event.quarantined ? 'error' : event.event,
          time: utcTime(event.timestamp),
          run,
          context: sameDayRun || restoredRun ? undefined : context,
          media: sameDayRun || restoredRun ? undefined : media,
          attempt: !sameDayRun && !restoredRun && event.attempt > 1 ? event.attempt : undefined,
          error: event.error,
          quarantined: event.quarantined ? true : undefined,
        });
      }

      const filename = path.join(this.directory, playbackLogFilename(timestamp));
      try {
        // A previous process may have died after writing only part of its last JSON line.
        // Every new session block starts on a fresh line so that the rest remains parseable.
        const separator = day.initialized ? '' : '\n';
        await this.fileSystem.appendFile(
          filename,
          separator + records.map(record => JSON.stringify(record)).join('\n') + '\n',
          'utf8',
        );
      } catch (error) {
        this.resetSessionAfterWriteFailure();
        throw error;
      }

      day.initialized = true;
      this.days.delete(eventDate);
      this.days.set(eventDate, day);
      if (isStarted) {
        this.runs.delete(eventRunKey);
        this.runs.set(eventRunKey, {
          date: eventDate,
          dayGeneration: day.generation,
          run,
          startedAt: event.startedAt ?? event.timestamp,
          attribution: {
            playerId: event.playerId,
            playlistId: event.playlistId,
            engine: event.engine,
            mediaId: event.mediaId,
            filename: event.filename,
          },
        });
        trimOldest(this.runs, MAX_TRACKED_RUNS);
      } else if (tracked) {
        this.runs.delete(eventRunKey);
      }
      if (event.event === 'error' && event.quarantined) {
        this.persistedQuarantines.add(eventRunKey);
        trimOldest(this.persistedQuarantines, MAX_TRACKED_RUNS);
      }
      this.pruneDays(now);
    });
  }

  cleanup(): Promise<void> {
    return this.enqueue(async () => {
      await this.fileSystem.mkdir(this.directory, { recursive: true });
      await this.cleanupFiles(this.now());
    });
  }

  private createDay(): DayState {
    return {
      generation: this.nextDayGeneration++,
      initialized: false,
      nextContextId: 1,
      nextMediaId: 1,
      contexts: new Map(),
      media: new Map(),
    };
  }

  private referenceContext(day: DayState, event: PlaybackEvent, records: JsonRecord[]): number {
    const key = contextKey(event);
    const existing = day.contexts.get(key);
    if (existing !== undefined) return existing;
    const id = day.nextContextId;
    // eslint-disable-next-line no-param-reassign
    day.nextContextId += 1;
    day.contexts.set(key, id);
    trimOldest(day.contexts, MAX_DICTIONARY_ENTRIES);
    records.push({
      event: 'context',
      id,
      playerId: event.playerId,
      playlistId: event.playlistId,
      engine: event.engine,
    });
    return id;
  }

  private referenceMedia(day: DayState, event: PlaybackEvent, records: JsonRecord[]): number {
    const key = mediaKey(event);
    const existing = day.media.get(key);
    if (existing !== undefined) return existing;
    const id = day.nextMediaId;
    // eslint-disable-next-line no-param-reassign
    day.nextMediaId += 1;
    day.media.set(key, id);
    trimOldest(day.media, MAX_DICTIONARY_ENTRIES);
    records.push({
      event: 'media',
      id,
      md5: event.mediaId,
      filename: event.filename,
    });
    return id;
  }

  private async cleanupFiles(now: Date): Promise<void> {
    const cutoff = oldestRetainedUtcDate(now, this.retentionDays());
    const entries = await this.fileSystem.readdir(this.directory);
    await Promise.all(
      entries.flatMap(filename => {
        const match = PLAYBACK_LOG_RE.exec(filename);
        return match?.[1] && isUtcCalendarDate(match[1]) && match[1] < cutoff
          ? [this.fileSystem.unlink(path.join(this.directory, filename))]
          : [];
      }),
    );
    this.lastCleanupDate = utcDate(now);
    this.pruneDays(now);
  }

  private pruneDays(now: Date): void {
    const cutoff = oldestRetainedUtcDate(now, this.retentionDays());
    const today = utcDate(now);
    for (const date of this.days.keys()) {
      if (date < cutoff || date > today) this.days.delete(date);
    }
    trimOldest(this.days, MAX_RESIDENT_DAYS);
  }

  private resetSessionAfterWriteFailure(): void {
    this.sessionId = randomUUID();
    this.days.clear();
    this.runs.clear();
    this.persistedQuarantines.clear();
    this.nextRunId = 1;
    this.nextDayGeneration = 1;
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => undefined);
    return result;
  }
}
