import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';

import type { PlaybackStatisticsEvent } from '/@common/playback';
import { isPlaybackOutputEvidence } from '/@common/playbackOutput';
import { PlaybackStatisticsStore } from '../src/playbackStatisticsStore';
import { PlaybackStatisticsSqlReader } from '../src/playbackStatisticsSql';

// Electron supplied this opaque display identifier on the affected Linux host.
const nativeDisplayId = 16095738401594692;
const output = {
  id: 1,
  name: 'Player output',
  display: -1,
  resolvedDisplayId: nativeDisplayId,
  state: 'showing' as const,
};

it('reads native display IDs above MAX_SAFE_INTEGER from the SQLite journal', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gmib-native-display-'));
  const now = () => new Date('2020-10-09T12:00:00.000Z');
  const logger = new PlaybackStatisticsStore(path.join(directory, 'playback.sqlite'), {
    retentionDays: () => 7,
    now,
  });
  try {
    const startedAt = '2020-10-09T10:00:00.000Z';
    const endedAt = '2020-10-09T10:00:05.000Z';
    const base = {
      version: 3 as const,
      playbackId: randomUUID(),
      playerId: 1,
      mediaId: 'clip',
      filename: 'clip.mp4',
      attempt: 1,
      startedAt,
      output: { outputs: [output] },
    };
    const events: PlaybackStatisticsEvent[] = [
      { ...base, eventId: randomUUID(), event: 'started', timestamp: startedAt },
      {
        ...base,
        eventId: randomUUID(),
        event: 'progress',
        timestamp: endedAt,
        segmentStartedAt: startedAt,
        playedMs: 5000,
      },
      {
        ...base,
        eventId: randomUUID(),
        event: 'completed',
        timestamp: endedAt,
        outputResult: {
          status: 'confirmed',
          outputs: [{ ...output, status: 'confirmed', reasons: [] }],
          reasons: [],
        },
      },
    ];
    for (const event of events) await logger.append(event);
    const reader = new PlaybackStatisticsSqlReader(logger, now);
    const query = { playerId: 1, from: '2020-10-09', to: '2020-10-09' };
    const stats = await reader.statistics(query);
    expect(stats.quality.invalidRecords).toBe(0);
    expect(stats.totals).toMatchObject({ starts: 1, completed: 1, confirmed: 1, playedMs: 5000 });
    expect(stats.outputs[0]).toMatchObject({ resolvedDisplayId: nativeDisplayId, confirmed: 1 });
    const history = await reader.history({ ...query, mediaId: 'clip' });
    expect(history.total).toBe(1);
    expect(history.entries[0].outputResult?.status).toBe('confirmed');
  } finally {
    await logger.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

it.each([NaN, Infinity, -Infinity, 1.5, '16095738401594692', null])(
  'rejects malformed native display ID %s',
  resolvedDisplayId => {
    expect(isPlaybackOutputEvidence({ outputs: [{ ...output, resolvedDisplayId }] })).toBe(false);
  },
);
