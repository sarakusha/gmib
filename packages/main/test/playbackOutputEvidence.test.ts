import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { PlaybackEvent } from '../../common/playback';
import type { PlaybackOutputSnapshot } from '../../common/playbackOutput';
import { PlaybackOutputEvidenceTracker } from '../src/playbackOutputEvidence';

const showing: PlaybackOutputSnapshot = {
  id: 1,
  name: 'Main',
  display: -1,
  resolvedDisplayId: 8,
  state: 'showing',
};
const make = (
  event: PlaybackEvent['event'],
  at: number,
  playbackId: string,
  extra: Partial<PlaybackEvent> = {},
): PlaybackEvent => ({
  version: 3,
  eventId: randomUUID(),
  event,
  playerId: 1,
  mediaId: 'clip',
  attempt: 1,
  playbackId,
  timestamp: new Date(at).toISOString(),
  ...extra,
});
const setup = () => {
  let outputs = [showing];
  const tracker = new PlaybackOutputEvidenceTracker(() => outputs);
  return {
    tracker,
    change: (next: PlaybackOutputSnapshot[], at: number) => {
      outputs = next;
      return tracker.changed(1, next, at);
    },
  };
};
describe('main output evidence', () => {
  it('reuses health for short clips and writes self-contained completed results', () => {
    const { tracker } = setup();
    const id = randomUUID();
    expect(tracker.process(make('started', 0, id))[0]?.output?.outputs).toEqual([showing]);
    expect(tracker.process(make('completed', 500, id))[0]?.outputResult?.status).toBe('confirmed');
  });
  it('preserves hide and restoration quality without requiring progress', () => {
    const { tracker, change } = setup();
    const id = randomUUID();
    tracker.process(make('started', 0, id));
    expect(change([{ ...showing, state: 'hidden' }], 2000)[0]?.event).toBe('output-changed');
    change([showing], 4000);
    expect(tracker.process(make('completed', 6000, id))[0]?.outputResult).toMatchObject({
      status: 'partial',
      reasons: ['hidden'],
      outputs: [{ status: 'partial' }],
    });
  });
  it('requires all configured outputs and reports each separately', () => {
    const { tracker, change } = setup();
    const id = randomUUID();
    change([showing, { ...showing, id: 2, state: 'unavailable' }], 0);
    tracker.process(make('started', 0, id));
    expect(tracker.process(make('completed', 1000, id))[0]?.outputResult).toMatchObject({
      status: 'unconfirmed',
      outputs: [{ status: 'confirmed' }, { status: 'unconfirmed' }],
    });
  });
  it('preserves loss and recovery in terminal result across midnight', () => {
    const { tracker, change } = setup();
    const id = randomUUID();
    const midnight = Date.parse('2026-10-10T00:00:00Z');
    tracker.process(make('started', midnight - 10000, id));
    change([{ ...showing, state: 'unavailable', resolvedDisplayId: undefined }], midnight - 5000);
    change([showing], midnight + 5000);
    expect(tracker.process(make('completed', midnight + 10000, id))[0]?.outputResult?.status).toBe(
      'partial',
    );
  });
  it('does not claim an unobserved start, no outputs or renderer-supplied success', () => {
    const { tracker, change } = setup();
    const id = randomUUID();
    expect(
      tracker.process(
        make('completed', 1, id, {
          outputResult: { status: 'confirmed', outputs: [], reasons: [] },
        }),
      )[0]?.outputResult?.status,
    ).toBe('unconfirmed');
    change([], 0);
    tracker.process(make('started', 0, id));
    expect(tracker.process(make('completed', 1, id))[0]?.outputResult).toMatchObject({
      status: 'unconfirmed',
      reasons: ['missing'],
    });
    expect(tracker.process(make('output-changed', 2, id))).toEqual([]);
  });
  it('does not penalize output hidden and restored while playback is paused', () => {
    const { tracker, change } = setup();
    const id = randomUUID();
    tracker.process(make('started', 0, id));
    tracker.process(make('paused', 100, id));
    change([{ ...showing, state: 'hidden' }], 200);
    change([showing], 300);
    tracker.process(make('resumed', 400, id));
    expect(tracker.process(make('completed', 500, id))[0]?.outputResult?.status).toBe('confirmed');
  });
  it('does not retain evidence after a renderer restart', () => {
    const { tracker } = setup();
    const id = randomUUID();
    tracker.process(make('started', 0, id));
    tracker.clearPlayer(1);
    expect(tracker.process(make('completed', 500, id))[0]?.outputResult?.status).toBe(
      'unconfirmed',
    );
  });
});

it('clears failed attempts before retries, so later changes do not log ghost attempts', () => {
  const { tracker, change } = setup();
  const id = randomUUID();
  tracker.process(make('started', 0, id));
  tracker.process(make('error', 100, id, { error: 'decoder failed' }));
  expect(change([{ ...showing, state: 'hidden' }], 200)).toEqual([]);
});
it('marks a removed output as partial even when the remaining output keeps showing', () => {
  const { tracker, change } = setup();
  const id = randomUUID();
  change([showing, { ...showing, id: 2 }], 0);
  tracker.process(make('started', 0, id));
  change([showing], 100);
  expect(tracker.process(make('completed', 200, id))[0]?.outputResult).toMatchObject({
    status: 'partial',
    reasons: ['missing'],
  });
});

it('ignores legacy progress without changing terminal output quality', () => {
  const { tracker, change } = setup();
  const id = randomUUID();
  tracker.process(make('started', 0, id));
  change([{ ...showing, state: 'hidden' }], 100);
  const progress = make('progress', 200, id, {
    segmentStartedAt: new Date(0).toISOString(),
    playedMs: 200,
  });
  expect(tracker.process(progress)).toEqual([]);
  expect(tracker.process(progress)).toEqual([]);
  expect(tracker.process(make('completed', 300, id))[0]?.outputResult?.status).toBe('partial');
});

it('keeps output evidence conservative when the wall clock moves backward', () => {
  const { tracker, change } = setup();
  const id = randomUUID();
  tracker.process(make('started', 0, id));
  change([{ ...showing, state: 'hidden' }], 150);
  change([showing], 100);
  change([showing], 100);
  expect(tracker.process(make('completed', 250, id))[0]?.outputResult).toMatchObject({
    status: 'partial',
    reasons: expect.arrayContaining(['unknown']),
    outputs: [{ status: 'partial' }],
  });
});

it('keeps output confirmation through more than 2048 observations without progress', () => {
  const { tracker, change } = setup();
  const id = randomUUID();
  tracker.process(make('started', 0, id));
  for (let at = 1; at <= 2050; at += 1) change([showing], at);
  expect(tracker.process(make('completed', 2051, id))[0]?.outputResult).toMatchObject({
    status: 'confirmed',
    reasons: [],
  });
});

it('marks a terminal clock rollback uncertain even without output changes', () => {
  const { tracker } = setup();
  const id = randomUUID();
  tracker.process(make('started', 1000, id));
  expect(tracker.process(make('completed', 500, id))[0]?.outputResult).toMatchObject({
    status: 'partial',
    reasons: ['unknown'],
    outputs: [{ status: 'partial', reasons: ['unknown'] }],
  });
});
