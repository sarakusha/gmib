import { randomUUID } from 'node:crypto';
import type { PlaybackEvent } from '/@common/playback';
import type {
  PlaybackOutputResult,
  PlaybackOutputResultStatus,
  PlaybackOutputSnapshot,
  PlaybackOutputState,
} from '/@common/playbackOutput';

type Seen = { output: PlaybackOutputSnapshot; good: boolean; reasons: Set<PlaybackOutputState> };
type Attempt = {
  event: PlaybackEvent;
  lastObservedAt: number;
  outputs: Map<number, Seen>;
  good: boolean;
  bad: boolean;
  reasons: Set<PlaybackOutputState>;
  paused: boolean;
  clockUncertain: boolean;
};
const resultStatus = (good: boolean, bad: boolean): PlaybackOutputResultStatus =>
  good ? (bad ? 'partial' : 'confirmed') : 'unconfirmed';
const terminal = new Set(['completed', 'interrupted', 'skipped', 'error']);

/** Main-owned output transitions and terminal quality, independent of frame progress. */
export class PlaybackOutputEvidenceTracker {
  private attempts = new Map<string, Attempt>();
  private seenEvents = new Set<string>();

  constructor(private readonly current: (playerId: number) => PlaybackOutputSnapshot[]) {}

  private observeTime(target: Attempt, at: number): void {
    const attempt = target;
    if (at < attempt.lastObservedAt) {
      attempt.clockUncertain = true;
      attempt.bad = true;
      attempt.reasons.add('unknown');
      attempt.outputs.forEach(seen => seen.reasons.add('unknown'));
    }
    attempt.lastObservedAt = Math.max(attempt.lastObservedAt, at);
  }

  private observe(target: Attempt, outputs: PlaybackOutputSnapshot[]): void {
    const attempt = target;
    if (attempt.paused) return;
    const ids = new Set(outputs.map(output => output.id));
    attempt.outputs.forEach(seen => {
      if (!ids.has(seen.output.id)) {
        seen.reasons.add('missing');
        attempt.reasons.add('missing');
        attempt.bad = true;
      }
    });
    const allShowing = outputs.length > 0 && outputs.every(output => output.state === 'showing');
    attempt.good ||= allShowing;
    attempt.bad ||= !allShowing;
    if (!outputs.length) attempt.reasons.add('missing');
    outputs.forEach(output => {
      const seen = attempt.outputs.get(output.id) ?? {
        output,
        good: false,
        reasons: new Set<PlaybackOutputState>(),
      };
      if (
        seen.output.display !== output.display ||
        seen.output.resolvedDisplayId !== output.resolvedDisplayId
      ) {
        seen.reasons.add('unknown');
        attempt.reasons.add('unknown');
        attempt.bad = true;
      }
      if (attempt.clockUncertain) seen.reasons.add('unknown');
      seen.output = output;
      seen.good ||= output.state === 'showing';
      if (output.state !== 'showing') {
        seen.reasons.add(output.state);
        attempt.reasons.add(output.state);
      }
      attempt.outputs.set(output.id, seen);
    });
  }

  changed(playerId: number, outputs: PlaybackOutputSnapshot[], at: number): PlaybackEvent[] {
    const events: PlaybackEvent[] = [];
    this.attempts.forEach(target => {
      const attempt = target;
      if (attempt.event.playerId !== playerId) return;
      this.observeTime(attempt, at);
      this.observe(attempt, outputs);
      events.push({
        ...attempt.event,
        event: 'output-changed',
        eventId: randomUUID(),
        timestamp: new Date(at).toISOString(),
        output: { outputs },
      });
    });
    return events;
  }

  clearPlayer(playerId: number): void {
    this.attempts.forEach((attempt, id) => {
      if (attempt.event.playerId === playerId) this.attempts.delete(id);
    });
  }

  process(input: PlaybackEvent): PlaybackEvent[] {
    // Never accept renderer assertions about native output state.
    const { output: _output, outputResult: _result, ...event } = input;
    if (event.event === 'output-changed' || event.event === 'progress') return [];
    if (event.version !== 3) return [event];
    if (event.eventId) {
      if (this.seenEvents.has(event.eventId)) return [];
      this.seenEvents.add(event.eventId);
      while (this.seenEvents.size > 4096)
        this.seenEvents.delete(this.seenEvents.values().next().value!);
    }
    let attempt = this.attempts.get(event.playbackId);
    if (event.event === 'started') {
      const outputs = this.current(event.playerId);
      attempt = {
        event,
        lastObservedAt: Date.parse(event.timestamp),
        outputs: new Map(),
        good: false,
        bad: false,
        reasons: new Set(),
        paused: false,
        clockUncertain: false,
      };
      this.observe(attempt, outputs);
      this.attempts.set(event.playbackId, attempt);
      while (this.attempts.size > 1024) this.attempts.delete(this.attempts.keys().next().value!);
      return [{ ...event, output: { outputs } }];
    }
    if (!attempt)
      return [
        {
          ...event,
          output: { outputs: [] },
          ...(terminal.has(event.event)
            ? {
                outputResult: {
                  status: 'unconfirmed' as const,
                  outputs: [],
                  reasons: ['unknown' as const],
                },
              }
            : {}),
        },
      ];
    this.observeTime(attempt, Date.parse(event.timestamp));
    if (event.event === 'paused') attempt.paused = true;
    if (event.event === 'resumed') {
      attempt.paused = false;
      this.observe(attempt, this.current(event.playerId));
    }
    if (terminal.has(event.event)) {
      const result: PlaybackOutputResult = {
        status: resultStatus(attempt.good, attempt.bad),
        outputs: [...attempt.outputs.values()].map(seen => ({
          ...seen.output,
          status: resultStatus(seen.good, seen.reasons.size > 0),
          reasons: [...seen.reasons],
        })),
        reasons: [...attempt.reasons],
      };
      this.attempts.delete(event.playbackId);
      return [
        { ...event, output: { outputs: this.current(event.playerId) }, outputResult: result },
      ];
    }
    return [event];
  }
}
