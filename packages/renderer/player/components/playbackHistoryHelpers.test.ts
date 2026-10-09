import { describe, expect, it } from 'vitest';

import type { PlaybackOutputSnapshot } from '/@common/playbackOutput';
import type { PlaybackHistoryEntry } from '/@common/playbackStatistics';

import { historyOutputChanges } from './playbackHistoryHelpers';

const at = (minute: number) => `2026-10-09T10:${String(minute).padStart(2, '0')}:00Z`;
const output = (
  id: number,
  state: PlaybackOutputSnapshot['state'] = 'showing',
  name = `Output ${id}`,
): PlaybackOutputSnapshot => ({ id, name, display: id, state });
const entry = (
  events: PlaybackHistoryEntry['events'],
  outputResult?: PlaybackHistoryEntry['outputResult'],
): PlaybackHistoryEntry => ({
  playbackId: 'attempt',
  mediaId: 'media',
  filename: 'clip.mp4',
  timestamp: at(59),
  outcome: 'completed',
  playedMs: 1000,
  successfulMs: 1000,
  skipped: false,
  events,
  outputResult,
});
const event = (minute: number, outputs: PlaybackOutputSnapshot[], name = 'started') => ({
  event: name,
  timestamp: at(minute),
  output: { outputs },
});

describe('historyOutputChanges', () => {
  it('sorts observations and ignores unchanged states, event names, and array order', () => {
    const a = output(1);
    const b = output(2, 'starting');
    const changes = historyOutputChanges(
      entry([event(2, [b, a], 'completed'), event(0, [a, b]), event(1, [b, a], 'paused')]),
    );
    expect(changes).toEqual([
      { timestamp: at(0), output: a, outputId: 1, kind: 'initial', tone: 'normal' },
      { timestamp: at(0), output: b, outputId: 2, kind: 'initial', tone: 'normal' },
    ]);
  });

  it('emits sparse state changes, removal, and recovery after reintroduction', () => {
    const a = output(1);
    const hidden = output(1, 'hidden');
    const b = output(2);
    const changes = historyOutputChanges(
      entry([
        event(0, [a, b]),
        event(1, [hidden, b], 'paused'),
        event(2, [hidden, b], 'resumed'),
        event(3, [b]),
        event(4, [a, b]),
      ]),
    );
    expect(
      changes.map(({ outputId, kind, tone, timestamp }) => ({ outputId, kind, tone, timestamp })),
    ).toEqual([
      { outputId: 1, kind: 'initial', tone: 'normal', timestamp: at(0) },
      { outputId: 2, kind: 'initial', tone: 'normal', timestamp: at(0) },
      { outputId: 1, kind: 'changed', tone: 'problem', timestamp: at(1) },
      { outputId: 1, kind: 'removed', tone: 'problem', timestamp: at(3) },
      { outputId: 1, kind: 'changed', tone: 'recovery', timestamp: at(4) },
    ]);
    expect(changes[3].output).toEqual(hidden);
  });

  it('retains transitions A to B to A and identity changes with an unchanged state', () => {
    const a = output(1);
    const b = output(1, 'stalled');
    const renamed = { ...a, name: 'Renamed', resolvedDisplayId: 42 };
    const changes = historyOutputChanges(
      entry([event(0, [a]), event(1, [b]), event(2, [a]), event(3, [renamed])]),
    );
    expect(changes.map(change => [change.kind, change.tone, change.output?.name])).toEqual([
      ['initial', 'normal', 'Output 1'],
      ['changed', 'problem', 'Output 1'],
      ['changed', 'recovery', 'Output 1'],
      ['changed', 'normal', 'Renamed'],
    ]);
  });

  it('keeps a problem pending through starting or unknown until showing', () => {
    const hidden = output(1, 'hidden');
    const starting = output(1, 'starting');
    const showing = output(1);
    const changes = historyOutputChanges(
      entry([
        event(0, [hidden]),
        event(1, [starting]),
        event(2, [showing]),
        event(3, []),
        event(4, [output(1, 'unknown')]),
        event(5, [showing]),
      ]),
    );
    expect(changes.map(({ kind, tone }) => [kind, tone])).toEqual([
      ['initial', 'problem'],
      ['changed', 'normal'],
      ['changed', 'recovery'],
      ['removed', 'problem'],
      ['changed', 'normal'],
      ['changed', 'recovery'],
    ]);
  });

  it('distinguishes observed emptiness from absent evidence', () => {
    const a = output(1);
    const emptyResult: PlaybackHistoryEntry['outputResult'] = {
      status: 'unconfirmed',
      outputs: [],
      reasons: ['missing'],
    };
    expect(historyOutputChanges(entry([], emptyResult))).toEqual([]);
    expect(
      historyOutputChanges(entry([event(0, []), event(1, []), event(2, [a]), event(3, [])])),
    ).toEqual([
      { timestamp: at(0), output: null, outputId: undefined, kind: 'empty', tone: 'problem' },
      { timestamp: at(2), output: a, outputId: 1, kind: 'changed', tone: 'normal' },
      { timestamp: at(3), output: a, outputId: 1, kind: 'removed', tone: 'problem' },
    ]);
  });

  it('uses a nonempty result only when no event has an output snapshot', () => {
    const a = output(1, 'unavailable');
    const result: PlaybackHistoryEntry['outputResult'] = {
      status: 'unconfirmed',
      outputs: [{ ...a, status: 'unconfirmed', reasons: ['unavailable'] }],
      reasons: ['unavailable'],
    };
    expect(historyOutputChanges(entry([{ event: 'completed', timestamp: at(2) }], result))).toEqual(
      [
        {
          timestamp: at(59),
          output: result.outputs[0],
          outputId: 1,
          kind: 'initial',
          tone: 'problem',
        },
      ],
    );
    expect(historyOutputChanges(entry([event(0, [output(1)])], result))).toEqual([
      { timestamp: at(0), output: output(1), outputId: 1, kind: 'initial', tone: 'normal' },
    ]);
  });
});
