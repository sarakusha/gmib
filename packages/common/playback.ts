export const playbackEventNames = [
  'started',
  'completed',
  'error',
  'quarantined',
  'recovered',
] as const;

export type PlaybackEventName = (typeof playbackEventNames)[number];

export type PlaybackEvent = {
  event: PlaybackEventName;
  playerId: number;
  playlistId?: number;
  itemId?: string;
  mediaId: string;
  filename?: string;
  attempt: number;
  playbackId: string;
  timestamp: string;
  error?: string;
  engine?: 'decoder' | 'capture';
};

export type PlaybackIssue = PlaybackEvent & {
  event: 'error' | 'quarantined';
};

export type PlaybackStatusSnapshot = {
  issues: PlaybackIssue[];
};

export type PlaybackSettings = {
  logRetentionDays: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= maxLength;

const isOptionalString = (value: unknown, maxLength: number): value is string | undefined =>
  value === undefined || (typeof value === 'string' && value.length <= maxLength);

const isInteger = (value: unknown, minimum = 0): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;

export const isPlaybackEvent = (value: unknown): value is PlaybackEvent => {
  if (!isRecord(value)) return false;
  const timestamp = value['timestamp'];
  const event = value['event'];
  const error = value['error'];
  return (
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
    isOptionalString(error, 16_384) &&
    (!['error', 'quarantined'].includes(event) || isNonEmptyString(error, 16_384)) &&
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
