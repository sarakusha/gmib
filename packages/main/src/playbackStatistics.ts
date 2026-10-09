import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setImmediate as yieldToLoop } from 'node:timers/promises';
import { createGunzip } from 'node:zlib';

import { isPlaybackStatisticsEvent, type PlaybackStatisticsEvent } from '/@common/playback';
import type {
  PlaybackOutputResult,
  PlaybackOutputSnapshot,
  PlaybackOutputState,
} from '/@common/playbackOutput';
import { PLAYBACK_HISTORY_MAX_OFFSET } from '/@common/playbackStatistics';
import type {
  PlaybackHistory,
  PlaybackHistoryEntry,
  PlaybackHistoryQuery,
  PlaybackOutputStatistics,
  PlaybackStatistics,
  PlaybackStatisticsMetrics,
  PlaybackStatisticsQuery,
  PlaybackStatisticsRow,
} from '/@common/playbackStatistics';

const LOG_FILE = /^playback-(\d{4}-\d{2}-\d{2})\.jsonl(?:\.gz)?$/;
const MAX_LINE_LENGTH = 256 * 1024;
const emptyMetrics = (): PlaybackStatisticsMetrics => ({
  starts: 0,
  completed: 0,
  confirmed: 0,
  partial: 0,
  unconfirmed: 0,
  playedMs: 0,
  errors: 0,
  skipped: 0,
  interrupted: 0,
  successfulMs: 0,
});
const emptyQuality = (): PlaybackStatistics['quality'] => ({
  ignoredLegacyRecords: 0,
  invalidRecords: 0,
  incompleteAttempts: 0,
  unreadableFiles: 0,
});

export class PlaybackStatisticsQueryError extends Error {}

/** Uses the host's calendar, including daylight saving transitions. */
export const localDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const calendarDate = (value: string): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new PlaybackStatisticsQueryError('Invalid calendar date');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (year < 1900 || localDate(date) !== value)
    throw new PlaybackStatisticsQueryError('Invalid calendar date');
  return date;
};

const nextDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

export const statisticsPeriod = (query: PlaybackStatisticsQuery, now: Date) => {
  if (!Number.isSafeInteger(query.playerId) || query.playerId < 0) {
    throw new PlaybackStatisticsQueryError('Invalid playerId');
  }
  if ((query.from === undefined) !== (query.to === undefined)) {
    throw new PlaybackStatisticsQueryError('Both from and to are required');
  }
  if (query.outputId !== undefined && (!Number.isSafeInteger(query.outputId) || query.outputId < 0))
    throw new PlaybackStatisticsQueryError('Invalid outputId');
  const today = localDate(now);
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const dates = { from: query.from ?? localDate(weekStart), to: query.to ?? today };
  const from = calendarDate(dates.from);
  const to = nextDay(calendarDate(dates.to));
  if (from >= to) throw new PlaybackStatisticsQueryError('Period end precedes start');
  return { dates, from: from.getTime(), to: to.getTime(), today };
};

type Attempt = {
  playbackId: string;
  events: PlaybackStatisticsEvent[];
};

const uniqueAttempts = async (
  events: PlaybackStatisticsEvent[],
  playerId: number,
): Promise<Attempt[]> => {
  const ids = new Set<string>();
  const attempts = new Map<string, Attempt>();
  let processed = 0;
  for (const event of events) {
    if (++processed % 500 === 0) await yieldToLoop();
    if (event.playerId !== playerId || ids.has(event.eventId)) continue;
    ids.add(event.eventId);
    let attempt = attempts.get(event.playbackId);
    if (!attempt) {
      attempt = { playbackId: event.playbackId, events: [] };
      attempts.set(event.playbackId, attempt);
    }
    attempt.events.push(event);
  }
  for (const attempt of attempts.values()) {
    attempt.events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
  return [...attempts.values()];
};

const rangeOverlap = (start: number, end: number, from: number, to: number): number =>
  Math.max(0, Math.min(end, to) - Math.max(start, from));

/** Only observed active segments count; missing progress never becomes wall-clock airtime. */
const interval = (event: PlaybackStatisticsEvent) => ({
  start: Date.parse(event.segmentStartedAt ?? event.timestamp),
  end: Date.parse(event.timestamp),
  playedMs: event.playedMs ?? 0,
});

// Compacted intervals carry exact per-day output totals, never synthetic healthy states.
type EvidenceEvent = PlaybackStatisticsEvent & {
  outputDurations?: { all: number; outputs: Record<number, number> };
};
const outputTime = (event: EvidenceEvent, outputId?: number): number => {
  if (event.outputDurations)
    return outputId === undefined
      ? event.outputDurations.all
      : (event.outputDurations.outputs[outputId] ?? 0);
  const outputs = event.output?.outputs ?? [];
  const showing =
    outputId === undefined
      ? outputs.length > 0 && outputs.every(output => output.state === 'showing')
      : outputs.some(output => output.id === outputId && output.state === 'showing');
  return showing ? (event.playedMs ?? 0) : 0;
};
const attemptOutputs = (events: PlaybackStatisticsEvent[]): Map<number, PlaybackOutputSnapshot> => {
  const outputs = new Map<number, PlaybackOutputSnapshot>();
  const timestamps = new Map<number, string>();
  for (const event of events)
    for (const output of [
      ...(event.output?.outputs ?? []),
      ...(event.outputResult?.outputs ?? []),
    ]) {
      if ((timestamps.get(output.id) ?? '') > event.timestamp) continue;
      timestamps.set(output.id, event.timestamp);
      outputs.set(output.id, output);
    }
  return outputs;
};
const scopedResult = (
  event: PlaybackStatisticsEvent | undefined,
  outputId?: number,
): PlaybackOutputResult => {
  const result = event?.outputResult;
  if (outputId === undefined)
    return result ?? { status: 'unconfirmed', outputs: [], reasons: ['unknown'] };
  const output = result?.outputs.find(item => item.id === outputId);
  return {
    status: output?.status ?? 'unconfirmed',
    outputs: output ? [output] : [],
    reasons: output?.reasons ?? ['unknown'],
  };
};

export const aggregatePlaybackStatistics = async (
  events: PlaybackStatisticsEvent[],
  query: PlaybackStatisticsQuery,
  now = new Date(),
  quality = emptyQuality(),
  roundMilliseconds = true,
  includeOutputs = true,
): Promise<PlaybackStatistics> => {
  const period = statisticsPeriod(query, now);
  const attempts = await uniqueAttempts(events, query.playerId);
  const ownEvents = attempts
    .flatMap(attempt => attempt.events)
    .filter(event => Date.parse(event.timestamp) <= now.getTime());
  let first = Infinity;
  let last = -Infinity;
  for (const event of ownEvents) {
    // A retained progress segment is real evidence even when the start file has expired.
    first = Math.min(first, Date.parse(event.segmentStartedAt ?? event.timestamp));
    last = Math.max(last, Date.parse(event.timestamp));
  }
  const available = Number.isFinite(first)
    ? { from: new Date(first).toISOString(), to: new Date(last).toISOString() }
    : null;
  const lower = Math.max(first, period.from);
  const upper = Math.min(last, period.to);
  const effective =
    available && lower <= upper && lower < period.to && upper >= period.from
      ? { from: new Date(lower).toISOString(), to: new Date(upper).toISOString() }
      : null;
  const result: PlaybackStatistics = {
    playerId: query.playerId,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    today: period.today,
    generatedAt: now.toISOString(),
    requestedDates: period.dates,
    requested: { from: new Date(period.from).toISOString(), to: new Date(period.to).toISOString() },
    available,
    effective,
    clipped: !effective || lower > period.from || upper < period.to,
    totals: emptyMetrics(),
    rows: [],
    outputs: [],
    outputId: query.outputId,
    days: [],
    quality: { ...quality },
  };
  if (!effective) return result;
  const rows = new Map<string, PlaybackStatisticsRow>();
  const dayMap = new Map<string, PlaybackStatistics['days'][number]>();
  for (
    let date = calendarDate(localDate(new Date(lower)));
    date.getTime() <= upper && date.getTime() < period.to;
    date = nextDay(date)
  ) {
    const key = localDate(date);
    const day = { ...emptyMetrics(), date: key, hasRecords: false };
    dayMap.set(key, day);
    result.days.push(day);
  }
  const inPeriod = (timestamp: string) => {
    const ms = Date.parse(timestamp);
    return ms >= lower && ms <= upper && ms < period.to;
  };
  let processed = 0;
  for (const attempt of attempts) {
    if (++processed % 250 === 0) await yieldToLoop();
    const validEvents = attempt.events.filter(
      event => Date.parse(event.timestamp) <= now.getTime(),
    );
    if (
      !validEvents.length ||
      (query.outputId !== undefined && !attemptOutputs(validEvents).has(query.outputId))
    )
      continue;
    const relevant = validEvents.filter(
      event =>
        inPeriod(event.timestamp) ||
        (event.event === 'progress' &&
          rangeOverlap(interval(event).start, interval(event).end, lower, upper) > 0),
    );
    if (!relevant.length) continue;
    const attribution = validEvents[0];
    let row = rows.get(attribution.mediaId);
    if (!row) {
      row = {
        ...emptyMetrics(),
        mediaId: attribution.mediaId,
        filename: attribution.filename ?? attribution.mediaId,
      };
      rows.set(attribution.mediaId, row);
    }
    const latestName = validEvents.findLast(event => event.filename)?.filename;
    if (latestName) row.filename = latestName;
    const terminal = validEvents.find(event =>
      ['completed', 'error', 'interrupted'].includes(event.event),
    );
    const progresses = validEvents.filter(event => event.event === 'progress');
    if (!terminal || (terminal.event === 'completed' && !progresses.length))
      result.quality.incompleteAttempts += 1;
    const counted = new Set<string>();
    for (const event of relevant) {
      const day = dayMap.get(localDate(new Date(event.timestamp)));
      if (day && inPeriod(event.timestamp)) day.hasRecords = true;
      const metric = (
        {
          started: 'starts',
          completed: 'completed',
          error: 'errors',
          skipped: 'skipped',
          interrupted: 'interrupted',
        } as const
      )[event.event as 'started' | 'completed' | 'error' | 'skipped' | 'interrupted'];
      if (metric && inPeriod(event.timestamp) && !counted.has(metric)) {
        counted.add(metric);
        row[metric] += 1;
        result.totals[metric] += 1;
        if (day) day[metric] += 1;
        if (metric === 'completed') {
          const status = scopedResult(event, query.outputId).status;
          row[status] += 1;
          result.totals[status] += 1;
          if (day) day[status] += 1;
        }
      }
    }
    // Distinct event IDs may still overlap after a retry; never credit an interval twice.
    let creditedUntil = -Infinity;
    for (const event of progresses.sort((a, b) =>
      (a.segmentStartedAt ?? '').localeCompare(b.segmentStartedAt ?? ''),
    )) {
      const span = interval(event);
      const start = Math.max(span.start, creditedUntil, lower);
      const end = Math.min(span.end, upper);
      creditedUntil = Math.max(creditedUntil, span.end);
      if (end <= start || span.end <= span.start) continue;
      for (
        let date = calendarDate(localDate(new Date(start)));
        date.getTime() < end;
        date = nextDay(date)
      ) {
        const day = dayMap.get(localDate(date));
        if (!day) continue;
        day.hasRecords = true;
        const amount =
          (rangeOverlap(start, end, date.getTime(), nextDay(date).getTime()) * span.playedMs) /
          (span.end - span.start);
        day.playedMs += amount;
        row.playedMs += amount;
        result.totals.playedMs += amount;
        if (terminal?.event !== 'completed') continue;
        const healthy =
          span.playedMs > 0 ? (amount * outputTime(event, query.outputId)) / span.playedMs : 0;
        day.successfulMs += healthy;
        row.successfulMs += healthy;
        result.totals.successfulMs += healthy;
      }
    }
  }
  result.rows = [...rows.values()].sort(
    (a, b) => b.successfulMs - a.successfulMs || a.filename.localeCompare(b.filename),
  );
  if (includeOutputs) {
    const observedInPeriod = ownEvents.filter(
      event =>
        inPeriod(event.timestamp) ||
        (event.event === 'progress' &&
          rangeOverlap(interval(event).start, interval(event).end, lower, upper) > 0),
    );
    for (const [id, output] of attemptOutputs(observedInPeriod)) {
      const part = await aggregatePlaybackStatistics(
        events,
        { ...query, outputId: id },
        now,
        quality,
        false,
        false,
      );
      if (!part.rows.length) continue;
      const reasons = new Map<PlaybackOutputState, number>();
      for (const attempt of attempts) {
        const terminal = attempt.events.find(event => event.event === 'completed');
        if (!terminal || !inPeriod(terminal.timestamp) || !attemptOutputs(attempt.events).has(id))
          continue;
        for (const reason of new Set(scopedResult(terminal, id).reasons))
          reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
      }
      result.outputs.push({
        id: output.id,
        name: output.name,
        display: output.display,
        resolvedDisplayId: output.resolvedDisplayId,
        ...part.totals,
        reasons: [...reasons].map(([reason, count]) => ({ reason, count })),
      });
    }
    result.outputs.sort((a, b) => a.id - b.id);
  }
  if (roundMilliseconds)
    for (const metrics of [result.totals, ...result.rows, ...result.days, ...result.outputs]) {
      metrics.successfulMs = Math.round(metrics.successfulMs);
      metrics.playedMs = Math.round(metrics.playedMs);
    }
  return result;
};

export const aggregatePlaybackHistory = async (
  events: PlaybackStatisticsEvent[],
  query: PlaybackHistoryQuery,
  now = new Date(),
): Promise<PlaybackHistory> => {
  const period = statisticsPeriod(query, now);
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;
  if (
    !query.mediaId ||
    query.mediaId.length > 512 ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > PLAYBACK_HISTORY_MAX_OFFSET ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new PlaybackStatisticsQueryError('Invalid history pagination or mediaId');
  }
  const entries: PlaybackHistoryEntry[] = [];
  for (const attempt of await uniqueAttempts(events, query.playerId)) {
    const own = attempt.events.filter(
      event => event.mediaId === query.mediaId && Date.parse(event.timestamp) <= now.getTime(),
    );
    if (
      !own.length ||
      !own.some(event => {
        const ms = Date.parse(event.timestamp);
        return (
          (ms >= period.from && ms < period.to) ||
          (event.event === 'progress' &&
            rangeOverlap(interval(event).start, interval(event).end, period.from, period.to) > 0)
        );
      })
    )
      continue;
    if (query.outputId !== undefined && !attemptOutputs(own).has(query.outputId)) continue;
    const terminal = own.find(event => ['completed', 'error', 'interrupted'].includes(event.event));
    let playedMs = 0;
    let successfulMs = 0;
    let creditedUntil = -Infinity;
    for (const event of own
      .filter(event => event.event === 'progress')
      .sort((a, b) => (a.segmentStartedAt ?? '').localeCompare(b.segmentStartedAt ?? ''))) {
      const span = interval(event);
      const start = Math.max(span.start, creditedUntil);
      creditedUntil = Math.max(creditedUntil, span.end);
      if (span.end > span.start) {
        const ratio =
          rangeOverlap(start, span.end, period.from, period.to) / (span.end - span.start);
        playedMs += ratio * span.playedMs;
        if (terminal?.event === 'completed')
          successfulMs += ratio * outputTime(event, query.outputId);
      }
    }
    entries.push({
      playbackId: attempt.playbackId,
      mediaId: query.mediaId,
      filename: own.findLast(event => event.filename)?.filename ?? query.mediaId,
      startedAt: own.find(event => event.event === 'started')?.timestamp ?? own[0].startedAt,
      timestamp: (terminal ?? own[own.length - 1]).timestamp,
      outcome: (terminal?.event as PlaybackHistoryEntry['outcome']) ?? 'pending',
      playedMs: Math.round(playedMs),
      successfulMs: Math.round(successfulMs),
      outputResult: scopedResult(terminal, query.outputId),
      skipped: own.some(event => event.event === 'skipped'),
      events: own
        .filter(event => event.event !== 'progress')
        .map(({ event, timestamp, error, reason, output }) => ({
          event,
          timestamp,
          error,
          reason,
          output,
        })),
    });
  }
  entries.sort(
    (a, b) => b.timestamp.localeCompare(a.timestamp) || a.playbackId.localeCompare(b.playbackId),
  );
  return { entries: entries.slice(offset, offset + limit), total: entries.length, offset, limit };
};

const MAX_PENDING_ATTEMPTS = 1024;
const MAX_HISTORY_DETAILS = 1000;
const TERMINAL_EVENTS = new Set(['completed', 'error', 'interrupted']);

type BufferedAttempt = {
  events: PlaybackStatisticsEvent[];
  lastFileDay: string;
  terminal: boolean;
  compactAt: number;
};

/**
 * Calendar queries need only the active total within each local day. Compressing
 * observed intervals this way preserves pauses and seeks without retaining one
 * progress object every fifteen seconds for an unfinished, days-long playback.
 * Synthetic records are internal and are never persisted or accepted over IPC.
 */
const compactAttempt = (events: PlaybackStatisticsEvent[]): PlaybackStatisticsEvent[] => {
  const metricEvents = new Set(['started', 'completed', 'error', 'skipped', 'interrupted']);
  const dailyMetrics = new Map<string, PlaybackStatisticsEvent>();
  for (const event of events) {
    if (!metricEvents.has(event.event)) continue;
    const key = `${event.event}:${localDate(new Date(event.timestamp))}`;
    const previous = dailyMetrics.get(key);
    if (!previous || event.timestamp < previous.timestamp) dailyMetrics.set(key, event);
  }
  const essential = [...dailyMetrics.values()];
  // Keep an activity marker on days containing only pause/resume/seek metadata.
  // These events establish real history even though they add no numeric metric.
  const activity = new Map<string, PlaybackStatisticsEvent>();
  for (const event of events) {
    if (event.event !== 'progress' && !metricEvents.has(event.event))
      activity.set(localDate(new Date(event.timestamp)), event);
  }
  for (const event of activity.values()) essential.push(event);
  const spans = new Map<
    string,
    { start: number; end: number; playedMs: number; all: number; outputs: Record<number, number> }
  >();
  let creditedUntil = -Infinity;
  let reference: PlaybackStatisticsEvent | undefined;
  for (const event of events
    .filter(event => event.event === 'progress')
    .sort((a, b) => (a.segmentStartedAt ?? '').localeCompare(b.segmentStartedAt ?? ''))) {
    reference ??= event;
    const span = interval(event);
    const start = Math.max(span.start, creditedUntil);
    creditedUntil = Math.max(creditedUntil, span.end);
    if (span.end <= start || span.end <= span.start) continue;
    for (
      let date = calendarDate(localDate(new Date(start)));
      date.getTime() < span.end;
      date = nextDay(date)
    ) {
      const key = localDate(date);
      const dayStart = Math.max(start, date.getTime());
      const dayEnd = Math.min(span.end, nextDay(date).getTime());
      const amount = ((dayEnd - dayStart) * span.playedMs) / (span.end - span.start);
      const ratio = span.playedMs > 0 ? amount / span.playedMs : 0;
      const all = outputTime(event) * ratio;
      const outputs: Record<number, number> = {};
      const identities = attemptOutputs([event]);
      for (const id of Object.keys((event as EvidenceEvent).outputDurations?.outputs ?? {}))
        outputs[Number(id)] = outputTime(event, Number(id)) * ratio;
      for (const id of identities.keys()) outputs[id] = outputTime(event, id) * ratio;
      const previous = spans.get(key);
      if (previous) {
        previous.start = Math.min(previous.start, dayStart);
        previous.end = Math.max(previous.end, dayEnd);
        previous.playedMs += amount;
        previous.all += all;
        for (const [id, ms] of Object.entries(outputs))
          previous.outputs[Number(id)] = (previous.outputs[Number(id)] ?? 0) + ms;
      } else spans.set(key, { start: dayStart, end: dayEnd, playedMs: amount, all, outputs });
    }
  }
  if (reference) {
    for (const [date, span] of spans) {
      essential.push({
        ...reference,
        eventId: `summary:${reference.playbackId}:${date}`,
        segmentStartedAt: new Date(span.start).toISOString(),
        timestamp: new Date(span.end).toISOString(),
        playedMs: span.playedMs,
        output: { outputs: [...attemptOutputs(events).values()] },
        outputDurations: { all: span.all, outputs: span.outputs },
      } as EvidenceEvent);
    }
  }
  // A quarantine/recovery without a start must still establish coverage and a row.
  if (!essential.length && events.length) essential.push(events[events.length - 1]);
  return essential;
};

/**
 * Retain at most two UTC days of finished attempts plus compact unfinished state.
 * The extra day includes a skip delivered just after an error at UTC midnight.
 */
class AttemptBatches {
  private readonly attempts = new Map<string, BufferedAttempt>();

  constructor(private readonly flush: (events: PlaybackStatisticsEvent[]) => Promise<void>) {}

  add(event: PlaybackStatisticsEvent, fileDay: string): void {
    const buffered = this.attempts.get(event.playbackId);
    if (buffered) {
      // Recent activity keeps a live cross-day playback ahead of abandoned starts.
      this.attempts.delete(event.playbackId);
      this.attempts.set(event.playbackId, buffered);
      buffered.events.push(event);
      buffered.lastFileDay = fileDay;
      buffered.terminal ||= TERMINAL_EVENTS.has(event.event);
      if (buffered.events.length >= buffered.compactAt) {
        buffered.events = compactAttempt(buffered.events);
        buffered.compactAt = Math.max(256, buffered.events.length * 2);
      }
    } else {
      this.attempts.set(event.playbackId, {
        events: [event],
        lastFileDay: fileDay,
        terminal: TERMINAL_EVENTS.has(event.event),
        compactAt: 256,
      });
    }
  }

  async endDay(fileDay: string, final = false): Promise<void> {
    let batch: PlaybackStatisticsEvent[] = [];
    let batchAttempts = 0;
    let excessPending = Math.max(
      0,
      [...this.attempts.values()].filter(attempt => !attempt.terminal).length -
        MAX_PENDING_ATTEMPTS,
    );
    let visited = 0;
    for (const [id, attempt] of this.attempts) {
      if (++visited % 250 === 0) await yieldToLoop();
      if (
        final ||
        (attempt.terminal && attempt.lastFileDay < fileDay) ||
        (!attempt.terminal && excessPending > 0)
      ) {
        if (!attempt.terminal && excessPending > 0) excessPending -= 1;
        this.attempts.delete(id);
        for (const event of attempt.events) batch.push(event);
        batchAttempts += 1;
        if (batchAttempts >= 250) {
          await this.flush(batch);
          batch = [];
          batchAttempts = 0;
        }
      } else attempt.events = compactAttempt(attempt.events);
    }
    if (batch.length) await this.flush(batch);
  }
}

const addMetrics = (target: PlaybackStatisticsMetrics, source: PlaybackStatisticsMetrics): void => {
  for (const key of Object.keys(emptyMetrics()) as (keyof PlaybackStatisticsMetrics)[]) {
    // eslint-disable-next-line no-param-reassign
    target[key] += source[key];
  }
};

/**
 * Streaming reader: the working set grows with daily record volume, not with
 * retention duration. Requests are serialized so remote dashboards cannot
 * multiply that working set. Long attempts compact their progress incrementally.
 * Every request rechecks the files, so append, rotation and deletion are visible.
 */
export class PlaybackStatisticsReader {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly directory: string) {}

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async files(): Promise<string[]> {
    try {
      return (await fs.readdir(this.directory)).filter(name => LOG_FILE.test(name)).sort();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  private async readFile(
    filename: string,
    consume: (event: PlaybackStatisticsEvent) => void,
    quality: ReturnType<typeof emptyQuality>,
  ): Promise<void> {
    const source = createReadStream(path.join(this.directory, filename));
    const input = filename.endsWith('.gz') ? source.pipe(createGunzip()) : source;
    source.on('error', error => input.destroy(error));
    input.setEncoding('utf8');
    let line = '';
    let oversized = false;
    let count = 0;
    const parseLine = () => {
      let issue: 'invalidRecords' | 'ignoredLegacyRecords' | undefined;
      if (oversized) issue = 'invalidRecords';
      else if (line.trim()) {
        try {
          const value: unknown = JSON.parse(line);
          if (isPlaybackStatisticsEvent(value)) consume(value);
          else if (
            typeof value === 'object' &&
            value !== null &&
            'event' in value &&
            !('version' in value && value.version === 3)
          )
            issue = 'ignoredLegacyRecords';
          else issue = 'invalidRecords';
        } catch {
          issue = 'invalidRecords';
        }
      }
      // eslint-disable-next-line no-param-reassign
      if (issue) quality[issue] += 1;
      line = '';
      oversized = false;
    };
    try {
      for await (const data of input) {
        const chunk = String(data);
        let start = 0;
        for (;;) {
          const end = chunk.indexOf('\n', start);
          const part = chunk.slice(start, end < 0 ? undefined : end);
          if (!oversized) {
            if (line.length + part.length > MAX_LINE_LENGTH) {
              oversized = true;
              line = '';
            } else line += part;
          }
          if (end < 0) break;
          parseLine();
          if (++count % 500 === 0) await yieldToLoop();
          start = end + 1;
        }
      }
      if (line.length || oversized) parseLine();
    } finally {
      input.destroy();
      source.destroy();
    }
  }

  private async scan(
    playerId: number,
    now: Date,
    consume: (event: PlaybackStatisticsEvent, day: string) => void,
    endDay: (day: string) => Promise<void>,
  ): Promise<ReturnType<typeof emptyQuality>> {
    const quality = emptyQuality();
    let day: string | undefined;
    let ids = new Set<string>();
    let previousIds = new Set<string>();
    for (const filename of await this.files()) {
      const fileDay = LOG_FILE.exec(filename)![1];
      if (day !== fileDay) {
        if (day) await endDay(day);
        previousIds = ids;
        ids = new Set<string>();
        day = fileDay;
      }
      try {
        await this.readFile(
          filename,
          event => {
            if (event.playerId !== playerId || Date.parse(event.timestamp) > now.getTime()) return;
            if (ids.has(event.eventId) || previousIds.has(event.eventId)) return;
            ids.add(event.eventId);
            consume(event, fileDay);
          },
          quality,
        );
      } catch {
        // Already parsed complete records remain useful when a gzip tail is damaged.
        quality.unreadableFiles += 1;
      }
      await yieldToLoop();
    }
    if (day) await endDay(day);
    return quality;
  }

  async statistics(query: PlaybackStatisticsQuery): Promise<PlaybackStatistics> {
    const now = new Date();
    const period = statisticsPeriod(query, now);
    return this.serialize(async () => {
      let first = Infinity;
      let last = -Infinity;
      const rows = new Map<string, PlaybackStatisticsRow>();
      const outputs = new Map<number, PlaybackOutputStatistics>();
      const outputMetadata = new Map<number, { at: string; output: PlaybackOutputSnapshot }>();
      const days = new Map<string, PlaybackStatistics['days'][number]>();
      const totals = emptyMetrics();
      let incompleteAttempts = 0;
      const batches = new AttemptBatches(async events => {
        const part = await aggregatePlaybackStatistics(events, query, now, emptyQuality(), false);
        addMetrics(totals, part.totals);
        incompleteAttempts += part.quality.incompleteAttempts;
        for (const row of part.rows) {
          const existing = rows.get(row.mediaId);
          if (existing) {
            addMetrics(existing, row);
            existing.filename = row.filename;
          } else rows.set(row.mediaId, { ...row });
        }
        for (const output of part.outputs) {
          const existing = outputs.get(output.id);
          if (existing) {
            addMetrics(existing, output);
            existing.name = output.name;
            existing.display = output.display;
            existing.resolvedDisplayId = output.resolvedDisplayId;
            for (const reason of output.reasons) {
              const previous = existing.reasons.find(item => item.reason === reason.reason);
              if (previous) previous.count += reason.count;
              else existing.reasons.push({ ...reason });
            }
          } else
            outputs.set(output.id, {
              ...output,
              reasons: output.reasons.map(reason => ({ ...reason })),
            });
        }
        for (const day of part.days) {
          const existing = days.get(day.date);
          if (existing) {
            addMetrics(existing, day);
            existing.hasRecords ||= day.hasRecords;
          } else days.set(day.date, { ...day });
        }
      });
      const quality = await this.scan(
        query.playerId,
        now,
        (event, day) => {
          first = Math.min(first, Date.parse(event.segmentStartedAt ?? event.timestamp));
          last = Math.max(last, Date.parse(event.timestamp));
          const time = Date.parse(event.timestamp);
          if (
            (time >= period.from && time < period.to) ||
            (event.event === 'progress' &&
              rangeOverlap(interval(event).start, interval(event).end, period.from, period.to) > 0)
          ) {
            for (const output of attemptOutputs([event]).values()) {
              if ((outputMetadata.get(output.id)?.at ?? '') <= event.timestamp)
                outputMetadata.set(output.id, { at: event.timestamp, output });
            }
          }
          batches.add(event, day);
        },
        day => batches.endDay(day),
      );
      await batches.endDay('', true);
      // Build exactly the same clipped range/day skeleton as the pure aggregator,
      // using coverage sentinels that cannot create a playback metric.
      const coverage: PlaybackStatisticsEvent[] = Number.isFinite(first)
        ? [first, last].map((ms, i) => ({
            version: 3,
            eventId: `coverage-${i}`,
            playbackId: `coverage-${i}`,
            event: 'recovered',
            timestamp: new Date(ms).toISOString(),
            playerId: query.playerId,
            mediaId: 'coverage',
            attempt: 0,
          }))
        : [];
      const result = await aggregatePlaybackStatistics(coverage, query, now, quality);
      result.quality.incompleteAttempts = incompleteAttempts;
      result.totals = totals;
      result.outputs = [...outputs.values()]
        .sort((a, b) => a.id - b.id)
        .map(row => {
          const metadata = outputMetadata.get(row.id)?.output;
          return metadata
            ? {
                ...row,
                name: metadata.name,
                display: metadata.display,
                resolvedDisplayId: metadata.resolvedDisplayId,
              }
            : row;
        });
      result.rows = [...rows.values()].sort(
        (a, b) => b.successfulMs - a.successfulMs || a.filename.localeCompare(b.filename),
      );
      result.days = result.days.map(day => days.get(day.date) ?? { ...day, hasRecords: false });
      for (const metrics of [result.totals, ...result.rows, ...result.days, ...result.outputs]) {
        metrics.successfulMs = Math.round(metrics.successfulMs);
        metrics.playedMs = Math.round(metrics.playedMs);
      }
      return result;
    });
  }

  async history(query: PlaybackHistoryQuery): Promise<PlaybackHistory> {
    await aggregatePlaybackHistory([], query); // Validate before opening any log files.
    const now = new Date();
    return this.serialize(async () => {
      const offset = query.offset ?? 0;
      const limit = query.limit ?? 50;
      const keep = offset + limit;
      let total = 0;
      const candidates: PlaybackHistoryEntry[] = [];
      const batches = new AttemptBatches(async events => {
        // A batch has at most 250 attempts; query each page to retain all candidates.
        for (let batchOffset = 0; ; batchOffset += 100) {
          const part = await aggregatePlaybackHistory(
            events,
            { ...query, offset: batchOffset, limit: 100 },
            now,
          );
          if (batchOffset === 0) total += part.total;
          candidates.push(...part.entries.map(entry => ({ ...entry, events: [] })));
          if (batchOffset + 100 >= part.total) break;
        }
        candidates.sort(
          (a, b) =>
            b.timestamp.localeCompare(a.timestamp) || a.playbackId.localeCompare(b.playbackId),
        );
        if (candidates.length > keep) candidates.length = keep;
      });
      await this.scan(
        query.playerId,
        now,
        (event, day) => {
          if (event.mediaId === query.mediaId) batches.add(event, day);
        },
        day => batches.endDay(day),
      );
      await batches.endDay('', true);
      const entries = candidates.slice(offset, offset + limit);
      const selected = new Map(entries.map(entry => [entry.playbackId, entry]));
      const omitted = new Map<string, number>();
      if (entries.length) {
        await this.scan(
          query.playerId,
          now,
          event => {
            const entry = selected.get(event.playbackId);
            if (!entry || event.mediaId !== query.mediaId || event.event === 'progress') return;
            const { event: name, timestamp, error, reason, output } = event;
            entry.events.push({ event: name, timestamp, error, reason, output });
            if (entry.events.length > MAX_HISTORY_DETAILS) {
              entry.events.shift();
              omitted.set(entry.playbackId, (omitted.get(entry.playbackId) ?? 0) + 1);
            }
          },
          async () => {},
        );
        for (const entry of entries) {
          entry.events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
          const count = omitted.get(entry.playbackId);
          if (count)
            entry.events.unshift({
              event: 'details-truncated',
              timestamp: entry.events[0].timestamp,
              reason: `Показаны последние ${MAX_HISTORY_DETAILS} событий; более ранних событий: ${count}.`,
            });
        }
      }
      return { entries, total, offset, limit };
    });
  }
}
