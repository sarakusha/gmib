/** Software observations from the existing output monitor, not physical screen telemetry. */
export type PlaybackOutputState =
  'showing' | 'hidden' | 'unavailable' | 'missing' | 'starting' | 'stalled' | 'unknown';
export type PlaybackOutputSnapshot = {
  id: number;
  name: string;
  display?: number;
  resolvedDisplayId?: number;
  state: PlaybackOutputState;
};
export type PlaybackOutputEvidence = { outputs: PlaybackOutputSnapshot[] };
export type PlaybackOutputResultStatus = 'confirmed' | 'partial' | 'unconfirmed';
export type PlaybackOutputResult = {
  status: PlaybackOutputResultStatus;
  outputs: Array<
    PlaybackOutputSnapshot & {
      status: PlaybackOutputResultStatus;
      reasons: PlaybackOutputState[];
    }
  >;
  reasons: PlaybackOutputState[];
};
const states: PlaybackOutputState[] = [
  'showing',
  'hidden',
  'unavailable',
  'missing',
  'starting',
  'stalled',
  'unknown',
];
const statuses: PlaybackOutputResultStatus[] = ['confirmed', 'partial', 'unconfirmed'];
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const snapshot = (value: unknown): value is PlaybackOutputSnapshot =>
  record(value) &&
  Number.isSafeInteger(value['id']) &&
  typeof value['name'] === 'string' &&
  value['name'].length <= 512 &&
  (value['display'] === undefined || Number.isSafeInteger(value['display'])) &&
  // Electron exposes native 64-bit display IDs as numbers. Keep this opaque value
  // as supplied, even above MAX_SAFE_INTEGER; it is not used for arithmetic.
  (value['resolvedDisplayId'] === undefined || Number.isInteger(value['resolvedDisplayId'])) &&
  states.includes(value['state'] as PlaybackOutputState);
const outputs = (value: unknown): value is PlaybackOutputSnapshot[] =>
  Array.isArray(value) &&
  value.length <= 4096 &&
  value.every(snapshot) &&
  new Set(value.map(item => item.id)).size === value.length;
const reasons = (value: unknown): value is PlaybackOutputState[] =>
  Array.isArray(value) &&
  value.length <= states.length &&
  value.every(item => states.includes(item));
export const isPlaybackOutputEvidence = (value: unknown): value is PlaybackOutputEvidence =>
  record(value) && outputs(value['outputs']);
export const isPlaybackOutputResult = (value: unknown): value is PlaybackOutputResult =>
  record(value) &&
  statuses.includes(value['status'] as PlaybackOutputResultStatus) &&
  reasons(value['reasons']) &&
  outputs(value['outputs']) &&
  value['outputs'].every(
    item =>
      record(item) &&
      statuses.includes(
        (item as unknown as Record<string, unknown>)['status'] as PlaybackOutputResultStatus,
      ) &&
      reasons((item as unknown as Record<string, unknown>)['reasons']),
  );
