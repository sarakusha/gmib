import {
  isPlaybackOutputEvidence,
  isPlaybackOutputResult,
  type PlaybackOutputEvidence,
  type PlaybackOutputResult,
} from './playbackOutput';

export const playbackEventNames = [
  'started',
  'completed',
  'error',
  'quarantined',
  'recovered',
  'progress',
  'paused',
  'resumed',
  'seeked',
  'interrupted',
  'skipped',
  'output-changed',
] as const;

export type PlaybackEventName = (typeof playbackEventNames)[number];

export type PlaybackEvent = {
  version?: 3;
  output?: PlaybackOutputEvidence;
  outputResult?: PlaybackOutputResult;
  eventId?: string;
  segmentStartedAt?: string;
  playedMs?: number;
  reason?: string;
  position?: number;
  previousPosition?: number;
  event: PlaybackEventName;
  playerId: number;
  playlistId?: number;
  itemId?: string;
  mediaId: string;
  filename?: string;
  attempt: number;
  playbackId: string;
  timestamp: string;
  startedAt?: string;
  error?: string;
  quarantined?: boolean;
  engine?: 'decoder' | 'capture';
};

export type PlaybackStatisticsEvent = PlaybackEvent & { version: 3; eventId: string };

export type PlaybackIssue = PlaybackEvent & {
  event: 'error' | 'quarantined';
};

export type PlaybackStatusSnapshot = {
  issues: PlaybackIssue[];
};

export type PlaybackSettings = {
  logRetentionDays: number;
  currentLogPath?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= maxLength;

const isOptionalString = (value: unknown, maxLength: number): value is string | undefined =>
  value === undefined || (typeof value === 'string' && value.length <= maxLength);

const isInteger = (value: unknown, minimum = 0): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;

const isTimestamp = (value: unknown): value is string =>
  isNonEmptyString(value, 64) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value;

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const isPlaybackEvent = (value: unknown): value is PlaybackEvent => {
  if (!isRecord(value)) return false;
  const timestamp = value['timestamp'];
  const event = value['event'];
  const error = value['error'];
  return (
    (value['version'] === undefined
      ? value['eventId'] === undefined &&
        ['started', 'completed', 'error', 'quarantined', 'recovered'].includes(String(event))
      : value['version'] === 3 && isUuid(value['eventId']) && isUuid(value['playbackId'])) &&
    (value['output'] === undefined || isPlaybackOutputEvidence(value['output'])) &&
    (value['outputResult'] === undefined || isPlaybackOutputResult(value['outputResult'])) &&
    isOptionalString(value['reason'], 512) &&
    (event !== 'seeked'
      ? value['position'] === undefined && value['previousPosition'] === undefined
      : typeof value['position'] === 'number' &&
        Number.isFinite(value['position']) &&
        value['position'] >= 0 &&
        typeof value['previousPosition'] === 'number' &&
        Number.isFinite(value['previousPosition']) &&
        value['previousPosition'] >= 0) &&
    (event !== 'progress'
      ? value['segmentStartedAt'] === undefined && value['playedMs'] === undefined
      : isTimestamp(value['segmentStartedAt']) &&
        isTimestamp(timestamp) &&
        typeof value['playedMs'] === 'number' &&
        Number.isFinite(value['playedMs']) &&
        value['playedMs'] >= 0 &&
        value['playedMs'] <= Date.parse(timestamp) - Date.parse(value['segmentStartedAt'])) &&
    typeof event === 'string' &&
    playbackEventNames.includes(event as PlaybackEventName) &&
    isInteger(value['playerId']) &&
    (value['playlistId'] === undefined || isInteger(value['playlistId'])) &&
    isOptionalString(value['itemId'], 512) &&
    isNonEmptyString(value['mediaId'], 512) &&
    isOptionalString(value['filename'], 4096) &&
    isInteger(value['attempt']) &&
    isNonEmptyString(value['playbackId'], 512) &&
    isNonEmptyString(timestamp, 64) &&
    !Number.isNaN(Date.parse(timestamp)) &&
    new Date(timestamp).toISOString() === timestamp &&
    isOptionalString(value['startedAt'], 64) &&
    (value['startedAt'] === undefined ||
      (!Number.isNaN(Date.parse(value['startedAt'])) &&
        new Date(value['startedAt']).toISOString() === value['startedAt'])) &&
    isOptionalString(error, 16_384) &&
    (!['error', 'quarantined'].includes(event) || isNonEmptyString(error, 16_384)) &&
    (value['quarantined'] === undefined || typeof value['quarantined'] === 'boolean') &&
    (value['engine'] === undefined ||
      value['engine'] === 'decoder' ||
      value['engine'] === 'capture')
  );
};

export const isPlaybackRetryMediaId = (value: unknown): value is string =>
  isNonEmptyString(value, 512);

export const isPlaybackEventForPlayer = (
  value: unknown,
  playerId: number | undefined,
): value is PlaybackEvent => isPlaybackEvent(value) && value.playerId === playerId;

export const isPlaybackStatisticsEvent = (value: unknown): value is PlaybackStatisticsEvent =>
  isPlaybackEvent(value) && value.version === 3;
