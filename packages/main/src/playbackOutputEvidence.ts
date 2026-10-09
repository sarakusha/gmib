import { randomUUID } from 'node:crypto';
import type { PlaybackEvent } from '/@common/playback';
import type {
  PlaybackOutputResult,
  PlaybackOutputResultStatus,
  PlaybackOutputSnapshot,
  PlaybackOutputState,
} from '/@common/playbackOutput';

type Observation = { at: number; outputs: PlaybackOutputSnapshot[] };
type Seen = { output: PlaybackOutputSnapshot; good: boolean; reasons: Set<PlaybackOutputState> };
type Attempt = {
  event: PlaybackEvent;
  timeline: Observation[];
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

/** Main-owned evidence; each progress piece and terminal result survives log rotation independently. */
export class PlaybackOutputEvidenceTracker {
  private attempts = new Map<string, Attempt>();
  private seenEvents = new Set<string>();

  constructor(private readonly current: (playerId: number) => PlaybackOutputSnapshot[]) {}

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
      if (at < (attempt.timeline.at(-1)?.at ?? at)) {
        attempt.clockUncertain = true;
        attempt.bad = true;
        attempt.reasons.add('unknown');
        attempt.outputs.forEach(seen => seen.reasons.add('unknown'));
      }
      attempt.timeline.push({ at, outputs });
      // A broken or exceptionally long attempt must not retain unlimited transitions.
      if (attempt.timeline.length > 2048) {
        attempt.timeline.splice(0, attempt.timeline.length - 2048);
        attempt.bad = true;
        attempt.reasons.add('unknown');
      }
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
    if (event.event === 'output-changed') return [];
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
        timeline: [{ at: Date.parse(event.timestamp), outputs }],
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
    if (event.event === 'paused') attempt.paused = true;
    if (event.event === 'resumed') {
      attempt.paused = false;
      this.observe(attempt, this.current(event.playerId));
    }
    if (event.event === 'progress') {
      const start = Date.parse(event.segmentStartedAt!);
      const end = Date.parse(event.timestamp);
      const transitions = attempt.timeline.filter(item => item.at > start && item.at < end);
      const boundaries = [...new Set([start, ...transitions.map(item => item.at), end])].sort(
        (a, b) => a - b,
      );
      const pieces = boundaries.slice(1).map((to, index) => {
        const from = boundaries[index];
        const snapshot = attempt.timeline.findLast(item => item.at <= from)?.outputs ?? [];
        const outputs = attempt.clockUncertain
          ? snapshot.map(output => ({ ...output, state: 'unknown' as const }))
          : snapshot;
        return {
          ...event,
          eventId: index === 0 ? event.eventId : randomUUID(),
          segmentStartedAt: new Date(from).toISOString(),
          timestamp: new Date(to).toISOString(),
          playedMs:
            end > start ? Math.min(to - from, (event.playedMs! * (to - from)) / (end - start)) : 0,
          output: { outputs },
        };
      });
      const lastIndex = attempt.timeline.findLastIndex(item => item.at <= end);
      if (lastIndex > 0) attempt.timeline.splice(0, lastIndex);
      return pieces;
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
