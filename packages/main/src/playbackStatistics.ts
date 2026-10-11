import { setImmediate as yieldToLoop } from 'node:timers/promises';

import type { PlaybackStatisticsEvent } from '/@common/playback';
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
  PlaybackStatistics,
  PlaybackStatisticsMetrics,
  PlaybackStatisticsQuery,
  PlaybackStatisticsRow,
} from '/@common/playbackStatistics';

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
  if (query.outputId !== undefined && (!Number.isSafeInteger(query.outputId) || query.outputId < 0))
    throw new PlaybackStatisticsQueryError('Invalid outputId');
  if (
    query.preset !== undefined &&
    query.preset !== 'today' &&
    query.preset !== 'yesterday' &&
    query.preset !== 'week'
  )
    throw new PlaybackStatisticsQueryError('Invalid preset');
  if (query.preset !== undefined && (query.from !== undefined || query.to !== undefined))
    throw new PlaybackStatisticsQueryError('Preset cannot be combined with from or to');
  if ((query.from === undefined) !== (query.to === undefined)) {
    throw new PlaybackStatisticsQueryError('Both from and to are required');
  }
  const today = localDate(now);
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const yesterday = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const dates =
    query.preset === 'today'
      ? { from: today, to: today }
      : query.preset === 'yesterday'
        ? { from: yesterday, to: yesterday }
        : { from: query.from ?? localDate(weekStart), to: query.to ?? today };
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

// Retained legacy segments can establish coverage, but never contribute duration.
const legacyInterval = (event: PlaybackStatisticsEvent) => ({
  start: Date.parse(event.segmentStartedAt ?? event.timestamp),
  end: Date.parse(event.timestamp),
});

/** One attempt occupies wall time until its first terminal event, including pauses and seeks. */
const attemptInterval = (events: PlaybackStatisticsEvent[]) => {
  const terminal = events.find(event =>
    ['completed', 'error', 'interrupted'].includes(event.event),
  );
  const observedStart = events.find(event => event.event === 'started')?.timestamp;
  const declaredStart = events
    .map(event => event.startedAt)
    .filter((value): value is string => value !== undefined && Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  const startedAt = observedStart ?? declaredStart;
  const start = startedAt === undefined ? NaN : Date.parse(startedAt);
  const end = terminal === undefined ? NaN : Date.parse(terminal.timestamp);
  const valid = Number.isFinite(start) && Number.isFinite(end) && end >= start;
  return { terminal, startedAt, start, end, valid };
};

const attemptOverlaps = (span: ReturnType<typeof attemptInterval>, from: number, to: number) =>
  span.valid && rangeOverlap(span.start, span.end, from, to) > 0;
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
  for (const attempt of attempts) {
    const span = attemptInterval(
      attempt.events.filter(event => Date.parse(event.timestamp) <= now.getTime()),
    );
    if (Number.isFinite(span.start)) first = Math.min(first, span.start);
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
    durationBasis: 'wall-clock',
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
  const relevantAttempts: PlaybackStatisticsEvent[][] = [];
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
    const span = attemptInterval(validEvents);
    const relevant = validEvents.filter(
      event =>
        inPeriod(event.timestamp) ||
        (event.event === 'progress' &&
          rangeOverlap(legacyInterval(event).start, legacyInterval(event).end, lower, upper) > 0),
    );
    if (!relevant.length && !attemptOverlaps(span, lower, upper)) continue;
    relevantAttempts.push(validEvents);
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
    const { terminal } = span;
    if (!terminal || (terminal.event === 'completed' && !span.valid))
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
    if (attemptOverlaps(span, lower, upper)) {
      const start = Math.max(span.start, lower);
      const end = Math.min(span.end, upper);
      const confirmed =
        terminal?.event === 'completed' &&
        scopedResult(terminal, query.outputId).status === 'confirmed';
      for (
        let date = calendarDate(localDate(new Date(start)));
        date.getTime() < end;
        date = nextDay(date)
      ) {
        const day = dayMap.get(localDate(date));
        if (!day) continue;
        day.hasRecords = true;
        const amount = rangeOverlap(start, end, date.getTime(), nextDay(date).getTime());
        day.playedMs += amount;
        row.playedMs += amount;
        result.totals.playedMs += amount;
        if (!confirmed) continue;
        day.successfulMs += amount;
        row.successfulMs += amount;
        result.totals.successfulMs += amount;
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
          rangeOverlap(legacyInterval(event).start, legacyInterval(event).end, lower, upper) > 0),
    );
    const outputs = attemptOutputs(observedInPeriod);
    // Bridge intervals whose only events lie outside the requested days.
    for (const attempt of relevantAttempts) {
      const historical = attempt.filter(event => Date.parse(event.timestamp) <= upper);
      for (const [id, output] of attemptOutputs(historical.length ? historical : attempt))
        if (!outputs.has(id)) outputs.set(id, output);
    }
    for (const [id, output] of outputs) {
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
    const span = attemptInterval(own);
    if (
      !own.length ||
      (!attemptOverlaps(span, period.from, period.to) &&
        !own.some(event => {
          const ms = Date.parse(event.timestamp);
          return (
            (ms >= period.from && ms < period.to) ||
            (event.event === 'progress' &&
              rangeOverlap(
                legacyInterval(event).start,
                legacyInterval(event).end,
                period.from,
                period.to,
              ) > 0)
          );
        }))
    )
      continue;
    if (query.outputId !== undefined && !attemptOutputs(own).has(query.outputId)) continue;
    const { terminal } = span;
    const playedMs = span.valid ? rangeOverlap(span.start, span.end, period.from, period.to) : 0;
    const successfulMs =
      terminal?.event === 'completed' &&
      scopedResult(terminal, query.outputId).status === 'confirmed'
        ? playedMs
        : 0;
    entries.push({
      playbackId: attempt.playbackId,
      mediaId: query.mediaId,
      filename: own.findLast(event => event.filename)?.filename ?? query.mediaId,
      startedAt: span.startedAt,
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
