import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { PlaybackStatisticsEvent } from '/@common/playback';
import type { PlaybackOutputSnapshot, PlaybackOutputResult } from '/@common/playbackOutput';
import { aggregatePlaybackStatistics, aggregatePlaybackHistory } from '../src/playbackStatistics';

const query = { playerId: 1, from: '2020-10-01', to: '2020-10-31' };
const t = (seconds: number) =>
  new Date(Date.parse('2020-10-08T10:00:00Z') + seconds * 1000).toISOString();
const output = (
  id: number,
  state: PlaybackOutputSnapshot['state'] = 'showing',
): PlaybackOutputSnapshot => ({
  id,
  name: `Screen ${id}`,
  display: id,
  resolvedDisplayId: id,
  state,
});
const make = (
  playbackId: string,
  event: PlaybackStatisticsEvent['event'],
  seconds: number,
  extra: Partial<PlaybackStatisticsEvent> = {},
): PlaybackStatisticsEvent => ({
  version: 3,
  eventId: randomUUID(),
  playbackId,
  playerId: 1,
  mediaId: 'clip',
  attempt: 1,
  event,
  timestamp: t(seconds),
  ...extra,
});
const result = (
  outputs: PlaybackOutputResult['outputs'],
  status: PlaybackOutputResult['status'],
): PlaybackOutputResult => ({
  outputs,
  status,
  reasons: [...new Set(outputs.flatMap(item => item.reasons))],
});
const summary = (
  id: number,
  status: PlaybackOutputResult['status'] = 'confirmed',
): PlaybackOutputResult['outputs'][number] => ({
  ...output(id),
  status,
  reasons: status === 'confirmed' ? [] : ['hidden'],
});
const partial = () => {
  const id = randomUUID();
  return [
    make(id, 'started', 0, { output: { outputs: [output(1), output(2)] } }),
    make(id, 'progress', 5, {
      segmentStartedAt: t(0),
      playedMs: 5000,
      output: { outputs: [output(1), output(2)] },
    }),
    make(id, 'output-changed', 5, { output: { outputs: [output(1), output(2, 'hidden')] } }),
    make(id, 'progress', 10, {
      segmentStartedAt: t(5),
      playedMs: 5000,
      output: { outputs: [output(1), output(2, 'hidden')] },
    }),
    make(id, 'completed', 10, {
      outputResult: result([summary(1), summary(2, 'partial')], 'partial'),
    }),
  ];
};
describe('output-aware statistics', () => {
  it('does not sum screens and keeps source completion separate from full/partial display', async () => {
    const data = await aggregatePlaybackStatistics(partial(), query);
    expect(data.totals).toMatchObject({
      completed: 1,
      confirmed: 0,
      partial: 1,
      unconfirmed: 0,
      successfulMs: 5000,
      playedMs: 10000,
      errors: 0,
    });
    expect(
      data.outputs.map(item => [item.id, item.confirmed, item.partial, item.successfulMs]),
    ).toEqual([
      [1, 1, 0, 10000],
      [2, 0, 1, 5000],
    ]);
    expect(data.outputs[1].reasons).toEqual([{ reason: 'hidden', count: 1 }]);
    const filtered = await aggregatePlaybackStatistics(partial(), { ...query, outputId: 1 });
    expect(filtered.totals).toMatchObject({ confirmed: 1, partial: 0, successfulMs: 10000 });
    expect(filtered.outputs).toEqual(data.outputs);
    expect(
      (await aggregatePlaybackStatistics(partial(), { ...query, outputId: 999 })).rows,
    ).toEqual([]);
  });

  it('does not claim success without output evidence', async () => {
    const events = partial()
      .filter(item => item.event !== 'output-changed')
      .map(({ output: _output, outputResult: _result, ...rest }) => rest);
    const data = await aggregatePlaybackStatistics(events, query);
    expect(data.totals).toMatchObject({
      completed: 1,
      confirmed: 0,
      partial: 0,
      unconfirmed: 1,
      successfulMs: 0,
      playedMs: 10000,
    });
    expect(data.outputs).toEqual([]);
  });

  it('reports filtered history, output changes and time; file failures remain excluded', async () => {
    const events = partial();
    const history = await aggregatePlaybackHistory(events, {
      ...query,
      outputId: 2,
      mediaId: 'clip',
    });
    expect(history.entries[0]).toMatchObject({
      outputResult: { status: 'partial' },
      playedMs: 10000,
      successfulMs: 5000,
    });
    expect(
      history.entries[0].events.find(item => item.event === 'output-changed')?.output?.outputs[1]
        .state,
    ).toBe('hidden');
    const last = events[events.length - 1];
    last.event = 'error';
    last.error = 'decoder';
    const data = await aggregatePlaybackStatistics(events, query);
    expect(data.totals).toMatchObject({
      errors: 1,
      completed: 0,
      confirmed: 0,
      partial: 0,
      successfulMs: 0,
      playedMs: 10000,
    });
  });

  it('uses the display assignment observed in the selected period, not a later remap', async () => {
    const events = partial();
    const tomorrow = '2020-10-09T10:00:00.000Z';
    const id = randomUUID();
    events.push({
      ...make(id, 'started', 0),
      timestamp: tomorrow,
      output: { outputs: [{ ...output(1), display: 99, resolvedDisplayId: 99, name: 'Renamed' }] },
    });
    const selected = { ...query, from: '2020-10-08', to: '2020-10-08' };
    const expected = await aggregatePlaybackStatistics(events, selected);
    expect(expected.outputs[0]).toMatchObject({
      name: 'Screen 1',
      display: 1,
      resolvedDisplayId: 1,
    });
  });
});
