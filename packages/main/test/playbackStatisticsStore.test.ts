import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { PlaybackStatisticsEvent } from '/@common/playback';
import type { PlaybackOutputResult, PlaybackOutputSnapshot } from '/@common/playbackOutput';
import { PlaybackStatisticsStore, type PlaybackSqlDatabase } from '../src/playbackStatisticsStore';

const day = '2020-10-09';
const timestamp = (seconds: number) => new Date(`${day}T12:00:00.000Z`).getTime() + seconds * 1000;
const iso = (seconds: number) => new Date(timestamp(seconds)).toISOString();
const output: PlaybackOutputSnapshot = {
  id: 2,
  name: 'Primary display',
  display: -1,
  resolvedDisplayId: 16095738401594692,
  state: 'showing',
};
const result = (status: PlaybackOutputResult['status']): PlaybackOutputResult => ({
  status,
  reasons: status === 'confirmed' ? [] : ['hidden'],
  outputs: [{ ...output, status, reasons: status === 'confirmed' ? [] : ['hidden'] }],
});
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
  output: { outputs: [output] },
  ...overrides,
});
const stores: PlaybackStatisticsStore[] = [];
const directories: string[] = [];
const create = (options: ConstructorParameters<typeof PlaybackStatisticsStore>[1] = {}) => {
  const store = new PlaybackStatisticsStore(':memory:', {
    now: () => new Date(iso(60)),
    ...options,
  });
  stores.push(store);
  return store;
};
afterEach(async () => {
  await Promise.all(stores.splice(0).map(store => store.close()));
  await Promise.all(
    directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe('playback SQLite facts', () => {
  it('indexes seen events by attempt and timestamp for targeted lookup and cascade work', async () => {
    const store = create();
    const plan = await store.read(db =>
      db.all<{ detail: string }>(
        'EXPLAIN QUERY PLAN SELECT id FROM seen_events WHERE attempt_id=? AND at<=? ORDER BY at DESC LIMIT 1',
        ['attempt', timestamp(10)],
      ),
    );

    expect(plan.map(row => row.detail).join(' ')).toContain('seen_events_attempt_at');
  });

  it('persists facts and deduplicates event IDs across progress and event types after reopening', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gmib-playback-db-'));
    directories.push(directory);
    const filename = path.join(directory, 'playback.sqlite');
    let store = new PlaybackStatisticsStore(filename, { now: () => new Date(iso(60)) });
    stores.push(store);
    const started = event();
    const progress = event({
      playbackId: started.playbackId,
      event: 'progress',
      segmentStartedAt: iso(0),
      timestamp: iso(5),
      playedMs: 5000,
    });
    await Promise.all([store.append(started), store.append(progress), store.append(progress)]);
    await store.close();
    store = new PlaybackStatisticsStore(filename, { now: () => new Date(iso(60)) });
    stores.push(store);
    await store.append(progress);
    await store.append({
      ...progress,
      event: 'paused',
      segmentStartedAt: undefined,
      playedMs: undefined,
    });
    const counts = await store.read(async db => ({
      attempts: await db.get('SELECT COUNT(*) AS count FROM attempts'),
      segments: await db.get('SELECT COUNT(*) AS count, SUM(played_ms) AS played FROM segments'),
      events: await db.get('SELECT COUNT(*) AS count FROM events'),
      seen: await db.get('SELECT COUNT(*) AS count FROM seen_events'),
    }));
    expect(counts).toEqual({
      attempts: { count: 1 },
      segments: { count: 1, played: 5000 },
      events: { count: 1 },
      seen: { count: 2 },
    });
  });

  it('keeps earliest terminal and completion classifications independently for out-of-order events', async () => {
    const store = create();
    const base = event();
    await store.append(
      event({
        ...base,
        eventId: randomUUID(),
        event: 'completed',
        timestamp: iso(30),
        outputResult: result('confirmed'),
      }),
    );
    await store.append(
      event({
        ...base,
        eventId: randomUUID(),
        event: 'completed',
        timestamp: iso(20),
        outputResult: result('partial'),
      }),
    );
    await store.append(
      event({
        ...base,
        eventId: randomUUID(),
        event: 'error',
        error: 'failed',
        timestamp: iso(10),
        outputResult: result('unconfirmed'),
      }),
    );
    await store.append(
      event({ ...base, eventId: randomUUID(), event: 'skipped', timestamp: iso(15) }),
    );
    await store.append(base);
    expect(
      await store.read(db =>
        db.get(`SELECT started_at,completed_at,error_at,skipped_at,
      terminal,terminal_at,result_status,completed_status FROM attempts`),
      ),
    ).toEqual({
      started_at: timestamp(0),
      completed_at: timestamp(20),
      error_at: timestamp(10),
      skipped_at: timestamp(15),
      terminal: 'error',
      terminal_at: timestamp(10),
      result_status: 'unconfirmed',
      completed_status: 'partial',
    });
    expect(
      await store.read(db =>
        db.get(
          'SELECT result_status,completed_status,result_state,completed_state FROM attempt_outputs',
        ),
      ),
    ).toEqual({
      result_status: 'unconfirmed',
      completed_status: 'partial',
      result_state: 'showing',
      completed_state: 'showing',
    });
  });

  it('stores raw overlapping intervals and each output state without inventing healthy evidence', async () => {
    const store = create();
    const started = event();
    const second = { ...output, id: 3, name: 'Secondary', state: 'hidden' as const };
    await store.append(started);
    await store.append(
      event({
        playbackId: started.playbackId,
        event: 'progress',
        segmentStartedAt: iso(3),
        timestamp: iso(8),
        playedMs: 2500,
        output: { outputs: [output, second] },
      }),
    );
    await store.append(
      event({
        playbackId: started.playbackId,
        event: 'progress',
        segmentStartedAt: iso(0),
        timestamp: iso(5),
        playedMs: 5000,
        output: undefined,
      }),
    );
    expect(
      await store.read(db =>
        db.all('SELECT start_at,end_at,played_ms,all_showing FROM segments ORDER BY start_at'),
      ),
    ).toEqual([
      { start_at: timestamp(0), end_at: timestamp(5), played_ms: 5000, all_showing: 0 },
      { start_at: timestamp(3), end_at: timestamp(8), played_ms: 2500, all_showing: 0 },
    ]);
    expect(
      await store.read(db =>
        db.all('SELECT output_id,showing FROM segments_output ORDER BY output_id'),
      ),
    ).toEqual([
      { output_id: 2, showing: 1 },
      { output_id: 3, showing: 0 },
    ]);
  });

  it('tracks historical identities only when changed and preserves native display IDs as REAL', async () => {
    const store = create();
    const base = event();
    await store.append(base);
    await store.append(
      event({
        playbackId: base.playbackId,
        event: 'paused',
        timestamp: iso(1),
        output: { outputs: [{ ...output, state: 'hidden' }] },
      }),
    );
    await store.append(
      event({
        playbackId: base.playbackId,
        event: 'resumed',
        timestamp: iso(2),
        output: { outputs: [{ ...output, name: 'Renamed' }] },
      }),
    );
    await store.append(
      event({
        playbackId: base.playbackId,
        event: 'output-changed',
        timestamp: iso(-1),
        output: { outputs: [{ ...output, name: 'Earlier' }] },
      }),
    );
    const rows = await store.read(db =>
      db.all(
        'SELECT name,at,resolved_display_id,typeof(resolved_display_id) AS storage FROM output_observations ORDER BY at',
      ),
    );
    expect(rows).toEqual([
      {
        name: 'Earlier',
        at: timestamp(-1),
        resolved_display_id: output.resolvedDisplayId,
        storage: 'real',
      },
      {
        name: output.name,
        at: timestamp(0),
        resolved_display_id: output.resolvedDisplayId,
        storage: 'real',
      },
      {
        name: 'Renamed',
        at: timestamp(2),
        resolved_display_id: output.resolvedDisplayId,
        storage: 'real',
      },
    ]);
    expect(await store.read(db => db.get('SELECT name,metadata_at FROM attempt_outputs'))).toEqual({
      name: 'Renamed',
      metadata_at: timestamp(2),
    });
  });

  it('preserves terminal output state despite later health and label changes', async () => {
    const store = create();
    const base = event();
    await store.append(base);
    const completion = result('partial');
    completion.outputs[0].state = 'hidden';
    await store.append(
      event({
        playbackId: base.playbackId,
        event: 'completed',
        timestamp: iso(10),
        outputResult: completion,
      }),
    );
    await store.append(
      event({
        playbackId: base.playbackId,
        event: 'output-changed',
        timestamp: iso(20),
        filename: undefined,
        output: { outputs: [{ ...output, name: 'New label', state: 'showing' }] },
      }),
    );
    expect(
      await store.read(db =>
        db.get('SELECT name,result_state,completed_state FROM attempt_outputs'),
      ),
    ).toEqual({ name: 'New label', result_state: 'hidden', completed_state: 'hidden' });
    expect(await store.read(db => db.get('SELECT filename FROM attempts'))).toEqual({
      filename: 'clip.mp4',
    });
    await store.append(
      event({
        playbackId: base.playbackId,
        event: 'error',
        error: 'earlier',
        timestamp: iso(5),
        output: undefined,
        outputResult: undefined,
      }),
    );
    expect(
      await store.read(db =>
        db.get('SELECT result_status,result_state,completed_state FROM attempt_outputs'),
      ),
    ).toEqual({ result_status: null, result_state: null, completed_state: 'hidden' });
  });

  it('stores stable detailed attempt attribution and keeps snapshot-only results absent', async () => {
    const store = create();
    const base = event({
      attempt: 4,
      playlistId: 23,
      itemId: 'playlist-item',
      engine: 'decoder',
      startedAt: iso(0),
    });
    await store.append(base);
    await store.append(
      event({ playbackId: base.playbackId, event: 'completed', timestamp: iso(10) }),
    );
    expect(
      await store.read(db =>
        db.get('SELECT attempt,playlist_id,item_id,engine,declared_started_at FROM attempts'),
      ),
    ).toEqual({
      attempt: 4,
      playlist_id: 23,
      item_id: 'playlist-item',
      engine: 'decoder',
      declared_started_at: timestamp(0),
    });
    expect(
      await store.read(db =>
        db.get(
          'SELECT result_status,result_state,result_reasons,completed_status,completed_state,completed_reasons FROM attempt_outputs',
        ),
      ),
    ).toEqual({
      result_status: null,
      result_state: null,
      result_reasons: null,
      completed_status: null,
      completed_state: null,
      completed_reasons: null,
    });
  });

  it('retains seek and quarantine diagnostics without storing raw progress JSON', async () => {
    const store = create();
    const base = event();
    await store.append(base);
    await store.append(
      event({
        playbackId: base.playbackId,
        event: 'seeked',
        timestamp: iso(5),
        position: 8.5,
        previousPosition: 2.25,
        reason: 'operator-seek',
      }),
    );
    await store.append(
      event({
        playbackId: base.playbackId,
        event: 'quarantined',
        timestamp: iso(10),
        error: 'decoder failure',
        quarantined: true,
      }),
    );
    expect(
      await store.read(db =>
        db.all(
          'SELECT type,position,previous_position,quarantined,error,reason FROM events WHERE type<>? ORDER BY at',
          ['started'],
        ),
      ),
    ).toEqual([
      {
        type: 'seeked',
        position: 8.5,
        previous_position: 2.25,
        quarantined: null,
        error: null,
        reason: 'operator-seek',
      },
      {
        type: 'quarantined',
        position: null,
        previous_position: null,
        quarantined: 1,
        error: 'decoder failure',
        reason: null,
      },
    ]);
  });

  it('rejects identity changes atomically, leaves the queue usable, and never fabricates a pending outcome', async () => {
    const store = create();
    const base = event();
    await store.append(base);
    const conflict = event({
      playbackId: base.playbackId,
      mediaId: 'different',
      timestamp: iso(1),
    });
    await expect(store.append(conflict)).rejects.toThrow('identity changed');
    const conflictPlayer = {
      ...conflict,
      eventId: randomUUID(),
      mediaId: base.mediaId,
      playerId: 2,
    };
    await expect(store.append(conflictPlayer)).rejects.toThrow('identity changed');
    await store.append(event({ playbackId: base.playbackId, event: 'paused', timestamp: iso(2) }));
    expect(
      await store.read(db =>
        db.get('SELECT media_id,player_id,terminal,completed_at,last_at FROM attempts'),
      ),
    ).toEqual({
      media_id: 'clip',
      player_id: 1,
      terminal: null,
      completed_at: null,
      last_at: timestamp(2),
    });
    expect(await store.read(db => db.get('SELECT COUNT(*) AS count FROM seen_events'))).toEqual({
      count: 2,
    });
  });

  it('clips retained segments proportionally and preserves expired declared attribution and terminal facts', async () => {
    let now = new Date('2020-10-09T12:00:00.000Z');
    const store = create({ now: () => now, retentionDays: () => 2 });
    const before = '2020-10-08T23:59:55.000Z';
    const after = '2020-10-09T00:00:05.000Z';
    const base = event({ timestamp: before, startedAt: before });
    await store.append(base);
    await store.append(
      event({
        playbackId: base.playbackId,
        event: 'error',
        error: 'recoverable',
        timestamp: before,
        startedAt: before,
        outputResult: result('partial'),
      }),
    );
    await store.append(
      event({
        playbackId: base.playbackId,
        event: 'progress',
        timestamp: after,
        segmentStartedAt: before,
        playedMs: 8000,
        startedAt: before,
      }),
    );
    now = new Date('2020-10-10T12:00:00.000Z');
    await store.cleanup();
    await store.cleanup();
    expect(
      await store.read(db => db.get('SELECT start_at,end_at,played_ms FROM segments')),
    ).toEqual({
      start_at: Date.parse('2020-10-09T00:00:00.000Z'),
      end_at: Date.parse(after),
      played_ms: 4000,
    });
    expect(
      await store.read(db =>
        db.get(
          'SELECT first_at,last_at,started_at,declared_started_at,terminal,terminal_at FROM attempts',
        ),
      ),
    ).toEqual({
      first_at: Date.parse('2020-10-09T00:00:00.000Z'),
      last_at: Date.parse(after),
      started_at: Date.parse(before),
      declared_started_at: Date.parse(before),
      terminal: 'error',
      terminal_at: Date.parse(before),
    });
    expect(await store.read(db => db.get('SELECT COUNT(*) AS count FROM events'))).toEqual({
      count: 0,
    });
    expect(
      await store.read(db => db.get('SELECT COUNT(*) AS count FROM output_observations')),
    ).toEqual({ count: 1 });
    now = new Date('2020-10-11T12:00:00.000Z');
    await store.cleanup();
    for (const table of [
      'attempts',
      'segments',
      'segments_output',
      'events',
      'seen_events',
      'attempt_outputs',
      'output_observations',
    ])
      expect(await store.read(db => db.get(`SELECT COUNT(*) AS count FROM ${table}`))).toEqual({
        count: 0,
      });
  });

  it('clips crossing segments on arrival and ignores expired and future timestamps', async () => {
    const store = create({ retentionDays: () => 1 });
    await store.append(event({ timestamp: '2020-10-08T23:59:59.000Z' }));
    await store.append(event({ timestamp: iso(61) }));
    await store.append(
      event({
        event: 'progress',
        segmentStartedAt: '2020-10-08T23:59:55.000Z',
        timestamp: '2020-10-09T00:00:05.000Z',
        playedMs: 8000,
      }),
    );
    expect(await store.read(db => db.get('SELECT COUNT(*) AS count FROM attempts'))).toEqual({
      count: 1,
    });
    expect(await store.read(db => db.get('SELECT played_ms FROM segments'))).toEqual({
      played_ms: 4000,
    });
  });

  it('drains accepted writes before idempotent close and rejects subsequent operations', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gmib-playback-close-'));
    directories.push(directory);
    const filename = path.join(directory, 'playback.sqlite');
    const store = new PlaybackStatisticsStore(filename, { now: () => new Date(iso(60)) });
    stores.push(store);
    const accepted = Array.from({ length: 10 }, () => store.append(event()));
    const closing = store.close();
    expect(store.close()).toBe(closing);
    await expect(store.append(event())).rejects.toThrow('closing');
    await expect(store.read(db => db.get('SELECT 1'))).rejects.toThrow('closing');
    await expect(store.cleanup()).rejects.toThrow('closing');
    await Promise.all(accepted);
    await closing;
    const reopened = new PlaybackStatisticsStore(filename, { now: () => new Date(iso(60)) });
    stores.push(reopened);
    expect(await reopened.read(db => db.get('SELECT COUNT(*) AS count FROM attempts'))).toEqual({
      count: 10,
    });
  });

  it('rejects initialization failures without hanging close and expires a read callback handle', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gmib-playback-invalid-'));
    directories.push(directory);
    const bad = new PlaybackStatisticsStore(directory);
    stores.push(bad);
    await expect(bad.ready).rejects.toThrow();
    await expect(bad.read(db => db.get('SELECT 1'))).rejects.toThrow();
    await expect(bad.close()).resolves.toBeUndefined();
    const store = create();
    let escaped!: PlaybackSqlDatabase;
    await store.read(async db => {
      escaped = db;
    });
    await expect(escaped.get('SELECT 1')).rejects.toThrow('finished');
  });
});
