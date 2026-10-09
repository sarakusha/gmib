import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { PlaybackStatisticsEvent } from '/@common/playback';
import type { PlaybackOutputSnapshot, PlaybackOutputResult } from '/@common/playbackOutput';
import {
  aggregatePlaybackStatistics,
  aggregatePlaybackHistory,
  PlaybackStatisticsReader,
} from '../src/playbackStatistics';

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
const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

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

  it('does not claim success for old records without output evidence', async () => {
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
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gmib-output-metadata-'));
    dirs.push(directory);
    await fs.writeFile(
      path.join(directory, 'playback-2020-10-08.jsonl'),
      events.map(item => JSON.stringify(item)).join('\n'),
    );
    expect((await new PlaybackStatisticsReader(directory).statistics(selected)).outputs).toEqual(
      expected.outputs,
    );
  });

  it('preserves output time through long-attempt compaction, rotation and retained-file reads', async () => {
    const id = randomUUID();
    const events = [make(id, 'started', 0, { output: { outputs: [output(1), output(2)] } })];
    for (let i = 0; i < 600; i += 1)
      events.push(
        make(id, 'progress', i + 1, {
          segmentStartedAt: t(i),
          playedMs: 1000,
          output: { outputs: [output(1), output(2, i % 2 ? 'hidden' : 'showing')] },
        }),
      );
    events.push(
      make(id, 'completed', 600, {
        outputResult: result([summary(1), summary(2, 'partial')], 'partial'),
      }),
    );
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gmib-output-statistics-'));
    dirs.push(directory);
    await fs.writeFile(
      path.join(directory, 'playback-2020-10-08.jsonl'),
      events.map(item => JSON.stringify(item)).join('\n'),
    );
    const reader = new PlaybackStatisticsReader(directory);
    for (const outputId of [undefined, 1, 2]) {
      const actual = await reader.statistics({ ...query, outputId });
      const expected = await aggregatePlaybackStatistics(events, { ...query, outputId });
      expect(actual.totals).toEqual(expected.totals);
      expect(actual.outputs).toEqual(expected.outputs);
      expect(actual.days).toEqual(expected.days);
      expect(await reader.history({ ...query, outputId, mediaId: 'clip' })).toEqual(
        await aggregatePlaybackHistory(events, { ...query, outputId, mediaId: 'clip' }),
      );
    }
    expect((await reader.statistics(query)).totals.successfulMs).toBe(300000);
  });
});
