import type { PlaybackOutputSnapshot, PlaybackOutputState } from '/@common/playbackOutput';
import type { PlaybackHistoryEntry } from '/@common/playbackStatistics';

export type HistoryOutputChange = {
  timestamp: string;
  output: PlaybackOutputSnapshot | null;
  outputId: number | undefined;
  kind: 'initial' | 'changed' | 'removed' | 'empty';
  tone: 'normal' | 'problem' | 'recovery';
};

const isProblem = (state: PlaybackOutputState): boolean =>
  state === 'hidden' || state === 'unavailable' || state === 'missing' || state === 'stalled';

const sameOutput = (a: PlaybackOutputSnapshot, b: PlaybackOutputSnapshot): boolean =>
  a.name === b.name &&
  a.display === b.display &&
  a.resolvedDisplayId === b.resolvedDisplayId &&
  a.state === b.state;

/** Return only observed output changes; a cumulative result is never treated as a later snapshot. */
export const historyOutputChanges = (entry: PlaybackHistoryEntry): HistoryOutputChange[] => {
  const snapshots = entry.events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.output !== undefined)
    .sort((a, b) =>
      a.event.timestamp === b.event.timestamp
        ? a.index - b.index
        : a.event.timestamp.localeCompare(b.event.timestamp),
    );

  if (snapshots.length === 0) {
    // An empty result alone cannot establish that no outputs were configured.
    return (
      entry.outputResult?.outputs.map(output => ({
        timestamp: entry.timestamp,
        output,
        outputId: output.id,
        kind: 'initial' as const,
        tone: isProblem(output.state) ? ('problem' as const) : ('normal' as const),
      })) ?? []
    );
  }

  const changes: HistoryOutputChange[] = [];
  const active = new Map<number, PlaybackOutputSnapshot>();
  // Keep a problem unresolved through neutral states such as starting or unknown.
  const unresolvedProblems = new Set<number>();

  snapshots.forEach(({ event }, index) => {
    const outputs = event.output!.outputs;
    const current = new Map(outputs.map(output => [output.id, output]));

    if (index === 0 && outputs.length === 0) {
      changes.push({
        timestamp: event.timestamp,
        output: null,
        outputId: undefined,
        kind: 'empty',
        tone: 'problem',
      });
    }

    for (const output of outputs) {
      const previous = active.get(output.id);
      if (previous && sameOutput(previous, output)) continue;

      const tone = isProblem(output.state)
        ? 'problem'
        : output.state === 'showing' && unresolvedProblems.has(output.id)
          ? 'recovery'
          : 'normal';

      changes.push({
        timestamp: event.timestamp,
        output,
        outputId: output.id,
        kind: index === 0 ? 'initial' : 'changed',
        tone,
      });
      if (isProblem(output.state)) unresolvedProblems.add(output.id);
      if (output.state === 'showing') unresolvedProblems.delete(output.id);
    }

    for (const [id, previous] of active) {
      if (current.has(id)) continue;
      changes.push({
        timestamp: event.timestamp,
        output: previous,
        outputId: id,
        kind: 'removed',
        tone: 'problem',
      });
      unresolvedProblems.add(id);
    }

    active.clear();
    for (const [id, output] of current) active.set(id, output);
  });

  return changes;
};
