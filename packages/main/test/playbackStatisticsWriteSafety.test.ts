import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { PlaybackStatisticsEvent } from '/@common/playback';
import type { PlaybackOutputResult, PlaybackOutputSnapshot } from '/@common/playbackOutput';
import { PlaybackStatisticsStore } from '../src/playbackStatisticsStore';

const timestamp = (seconds: number) => Date.parse('2020-10-09T12:00:00.000Z') + seconds * 1000;
const iso = (seconds: number) => new Date(timestamp(seconds)).toISOString();
const primary: PlaybackOutputSnapshot = {
  id: 1,
  name: 'Primary',
  display: -1,
  resolvedDisplayId: 16095738401594692,
  state: 'showing',
};
const secondary: PlaybackOutputSnapshot = { id: 2, name: 'Secondary', state: 'hidden' };
const event = (overrides: Partial<PlaybackStatisticsEvent> = {}): PlaybackStatisticsEvent => ({
  version: 3,
  eventId: randomUUID(),
  playbackId: randomUUID(),
  playerId: 1,
  mediaId: 'clip',
  filename: 'clip.mp4',
  attempt: 1,
  event: 'started',
  timestamp: iso(0),
  output: { outputs: [primary, secondary] },
  ...overrides,
});
const result = (
  status: PlaybackOutputResult['status'],
  outputs: PlaybackOutputSnapshot[],
): PlaybackOutputResult => ({
  status,
  reasons: status === 'confirmed' ? [] : ['hidden'],
  outputs: outputs.map(output => ({
    ...output,
    status,
    reasons: status === 'confirmed' ? [] : ['hidden'],
  })),
});
const stores: PlaybackStatisticsStore[] = [];
const create = () => {
  const store = new PlaybackStatisticsStore(':memory:', { now: () => new Date(iso(60)) });
  stores.push(store);
  return store;
};
afterEach(async () => {
  await Promise.all(stores.splice(0).map(store => store.close()));
});
const facts = (store: PlaybackStatisticsStore) =>
  store.read(async db => ({
    attempts: await db.all('SELECT * FROM attempts ORDER BY id'),
    seen: await db.all('SELECT * FROM seen_events ORDER BY at,id'),
    outputs: await db.all('SELECT * FROM attempt_outputs ORDER BY output_id'),
    observations: await db.all('SELECT * FROM output_observations ORDER BY at,output_id'),
    events: await db.all('SELECT * FROM events ORDER BY at,id'),
    segments: await db.all('SELECT * FROM segments ORDER BY id'),
    segmentOutputs: await db.all('SELECT * FROM segments_output ORDER BY segment_id,output_id'),
  }));
const attemptRow = (base: PlaybackStatisticsEvent, overrides: Record<string, unknown> = {}) => ({
  id: base.playbackId,
  player_id: 1,
  media_id: 'clip',
  attempt: 1,
  playlist_id: null,
  item_id: null,
  engine: null,
  filename: 'clip.mp4',
  filename_at: timestamp(0),
  first_at: timestamp(0),
  last_at: timestamp(0),
  started_at: timestamp(0),
  declared_started_at: null,
  completed_at: null,
  error_at: null,
  skipped_at: null,
  interrupted_at: null,
  terminal: null,
  terminal_at: null,
  result_status: null,
  result_reasons: null,
  completed_status: null,
  completed_reasons: null,
  ...overrides,
});
const outputRow = (
  base: PlaybackStatisticsEvent,
  output: PlaybackOutputSnapshot,
  seconds: number,
  overrides: Record<string, unknown> = {},
) => ({
  attempt_id: base.playbackId,
  output_id: output.id,
  name: output.name,
  display: output.display ?? null,
  resolved_display_id: output.resolvedDisplayId ?? null,
  metadata_at: timestamp(seconds),
  result_status: null,
  result_reasons: null,
  result_state: null,
  completed_status: null,
  completed_reasons: null,
  completed_state: null,
  ...overrides,
});
const observation = (output: PlaybackOutputSnapshot, seconds: number) => ({
  player_id: 1,
  output_id: output.id,
  at: timestamp(seconds),
  name: output.name,
  display: output.display ?? null,
  resolved_display_id: output.resolvedDisplayId ?? null,
});
const history = (events: PlaybackStatisticsEvent[]) => {
  const ordered = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return {
    seen: ordered.map(item => ({
      id: item.eventId,
      at: Date.parse(item.timestamp),
      attempt_id: item.playbackId,
    })),
    events: ordered.map(item => ({
      id: item.eventId,
      attempt_id: item.playbackId,
      at: Date.parse(item.timestamp),
      type: item.event,
      error: item.error ?? null,
      reason: item.reason ?? null,
      output: item.output ? JSON.stringify(item.output) : null,
      position: null,
      previous_position: null,
      quarantined: null,
    })),
    segments: [],
    segmentOutputs: [],
  };
};
const quality = (prefix: 'result' | 'completed', status: string, state: string) => ({
  [`${prefix}_status`]: status,
  [`${prefix}_reasons`]: status === 'confirmed' ? '[]' : '["hidden"]',
  [`${prefix}_state`]: state,
});

describe('playback statistics append safety', () => {
  it('rolls back all facts on the final history insert failure and accepts a retry exactly once', async () => {
    const store = create();
    const base = event();
    const late = event({
      ...base,
      eventId: randomUUID(),
      event: 'completed',
      timestamp: iso(30),
      outputResult: result('confirmed', [primary, secondary]),
    });
    await store.append(base);
    await store.append(late);
    const before = await facts(store);
    const renamed = { ...primary, name: 'Renamed primary', state: 'hidden' as const };
    const added: PlaybackOutputSnapshot = { id: 3, name: 'New output', state: 'hidden' };
    const replacement = event({
      ...base,
      eventId: randomUUID(),
      event: 'completed',
      timestamp: iso(20),
      output: { outputs: [renamed, added] },
      outputResult: result('partial', [renamed, added]),
    });
    await store.write(db =>
      db.exec(`CREATE TRIGGER fail_history BEFORE INSERT ON events
        BEGIN SELECT RAISE(ABORT, 'injected history failure'); END;`),
    );
    await expect(store.append(replacement)).rejects.toThrow('injected history failure');
    expect(await facts(store)).toEqual(before);
    await store.write(db => db.exec('DROP TRIGGER fail_history'));
    await store.append(replacement);
    await store.append(replacement);
    expect(await facts(store)).toEqual({
      attempts: [
        attemptRow(base, {
          filename_at: timestamp(30),
          last_at: timestamp(30),
          completed_at: timestamp(20),
          terminal: 'completed',
          terminal_at: timestamp(20),
          result_status: 'partial',
          result_reasons: '["hidden"]',
          completed_status: 'partial',
          completed_reasons: '["hidden"]',
        }),
      ],
      outputs: [
        outputRow(base, primary, 30, {
          ...quality('result', 'partial', 'hidden'),
          ...quality('completed', 'partial', 'hidden'),
        }),
        outputRow(base, secondary, 30),
        outputRow(base, added, 20, {
          ...quality('result', 'partial', 'hidden'),
          ...quality('completed', 'partial', 'hidden'),
        }),
      ],
      observations: [
        observation(primary, 0),
        observation(secondary, 0),
        observation(renamed, 20),
        observation(added, 20),
      ],
      ...history([base, late, replacement]),
    });
  });

  it('ignores duplicate IDs with changed identities and payloads before checking attempt identity', async () => {
    const store = create();
    const base = event();
    await store.append(base);
    const before = await facts(store);
    await expect(
      store.append({
        ...base,
        playerId: 99,
        mediaId: 'other',
        filename: 'other.mp4',
        event: 'completed',
        timestamp: iso(40),
        outputResult: result('confirmed', [primary]),
      }),
    ).resolves.toBeUndefined();
    await expect(store.append({ ...base, playbackId: randomUUID() })).resolves.toBeUndefined();
    expect(await facts(store)).toEqual(before);
  });

  it('serializes concurrent duplicate deliveries without losing or multiplying the accepted facts', async () => {
    const store = create();
    const base = event();
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        store.append(index === 0 ? base : { ...base, mediaId: 'duplicate payload', playerId: 2 }),
      ),
    );
    expect(await facts(store)).toEqual({
      attempts: [attemptRow(base)],
      outputs: [outputRow(base, primary, 0), outputRow(base, secondary, 0)],
      observations: [observation(primary, 0), observation(secondary, 0)],
      ...history([base]),
    });
  });

  it('clears omitted output quality independently when earlier terminal and completion events arrive', async () => {
    const store = create();
    const base = event();
    const late = event({
      ...base,
      eventId: randomUUID(),
      event: 'completed',
      timestamp: iso(30),
      outputResult: result('confirmed', [primary, secondary]),
    });
    const error = event({
      ...base,
      eventId: randomUUID(),
      event: 'error',
      error: 'decoder failed',
      timestamp: iso(10),
      output: { outputs: [primary] },
      outputResult: result('unconfirmed', [primary]),
    });
    const completion = event({
      ...base,
      eventId: randomUUID(),
      event: 'completed',
      timestamp: iso(20),
      output: { outputs: [secondary] },
      outputResult: result('partial', [secondary]),
    });
    for (const item of [base, late, error, completion]) await store.append(item);
    const attempts = [
      attemptRow(base, {
        filename_at: timestamp(30),
        last_at: timestamp(30),
        completed_at: timestamp(20),
        error_at: timestamp(10),
        terminal: 'error',
        terminal_at: timestamp(10),
        result_status: 'unconfirmed',
        result_reasons: '["hidden"]',
        completed_status: 'partial',
        completed_reasons: '["hidden"]',
      }),
    ];
    const observations = [observation(primary, 0), observation(secondary, 0)];
    expect(await facts(store)).toEqual({
      attempts,
      outputs: [
        outputRow(base, primary, 30, quality('result', 'unconfirmed', 'showing')),
        outputRow(base, secondary, 30, quality('completed', 'partial', 'hidden')),
      ],
      observations,
      ...history([base, late, error, completion]),
    });
    const omittedTerminal = event({
      ...base,
      eventId: randomUUID(),
      event: 'interrupted',
      timestamp: iso(5),
      output: undefined,
    });
    await store.append(omittedTerminal);
    attempts[0] = {
      ...attempts[0],
      interrupted_at: timestamp(5),
      terminal: 'interrupted',
      terminal_at: timestamp(5),
      result_status: 'unconfirmed',
      result_reasons: '["unknown"]',
    };
    expect(await facts(store)).toEqual({
      attempts,
      outputs: [
        outputRow(base, primary, 30),
        outputRow(base, secondary, 30, quality('completed', 'partial', 'hidden')),
      ],
      observations,
      ...history([base, late, error, completion, omittedTerminal]),
    });
    const omittedCompletion = event({
      ...base,
      eventId: randomUUID(),
      event: 'completed',
      timestamp: iso(15),
      output: undefined,
    });
    await store.append(omittedCompletion);
    attempts[0] = {
      ...attempts[0],
      completed_at: timestamp(15),
      completed_status: 'unconfirmed',
      completed_reasons: '["unknown"]',
    };
    expect(await facts(store)).toEqual({
      attempts,
      outputs: [outputRow(base, primary, 30), outputRow(base, secondary, 30)],
      observations,
      ...history([base, late, error, completion, omittedTerminal, omittedCompletion]),
    });
  });
});
