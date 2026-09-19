/** Renderer observations describe browser presentation, not the physical LED screen. */
export type OutputHealthState =
  'starting' | 'showing' | 'stalled' | 'missing' | 'hidden' | 'unavailable';

export type OutputHealthProbe = {
  requestId: number;
  hidden: boolean;
  unavailableOutputIds: number[];
};

export type PlayerOutputHealth = {
  requestId: number;
  playbackState: MediaSessionPlaybackState;
  playable: boolean;
  outputs: Array<{ id: number; state: OutputHealthState; lastFrameAgeMs?: number }>;
  recovery?: string;
};

export const OUTPUT_HEALTH_CHECK_INTERVAL = 5_000;
export const OUTPUT_HEALTH_STALL_TIMEOUT = 30_000;
export const OUTPUT_HEALTH_RELOAD_COOLDOWN = 120_000;

export const isPlayerOutputHealth = (value: unknown): value is PlayerOutputHealth => {
  if (!value || typeof value !== 'object') return false;
  const report = value as PlayerOutputHealth;
  const states: OutputHealthState[] = [
    'starting',
    'showing',
    'stalled',
    'missing',
    'hidden',
    'unavailable',
  ];
  return (
    Number.isSafeInteger(report.requestId) &&
    report.requestId > 0 &&
    ['none', 'paused', 'playing'].includes(report.playbackState) &&
    typeof report.playable === 'boolean' &&
    (report.recovery === undefined ||
      (typeof report.recovery === 'string' && report.recovery.length <= 1024)) &&
    Array.isArray(report.outputs) &&
    report.outputs.length <= 4096 &&
    new Set(report.outputs.map(output => output?.id)).size === report.outputs.length &&
    report.outputs.every(
      output =>
        output &&
        Number.isSafeInteger(output.id) &&
        states.includes(output.state) &&
        (output.lastFrameAgeMs === undefined ||
          (Number.isFinite(output.lastFrameAgeMs) && output.lastFrameAgeMs >= 0)),
    )
  );
};
