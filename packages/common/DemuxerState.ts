export type DemuxerState =
  | 'prefetch'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'finished'
  | 'cancelled'
  | 'error';
