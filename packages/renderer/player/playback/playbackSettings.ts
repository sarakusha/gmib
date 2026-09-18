export const DEFAULT_PLAYBACK_LOG_RETENTION_DAYS = 7;

export const isValidPlaybackLogRetentionDays = (value: number): boolean =>
  Number.isInteger(value) && value >= 1 && value <= 365;

export const shouldSavePlaybackLogRetentionDays = (
  value: number,
  savedValue: number | undefined,
  saving: boolean,
): boolean =>
  isValidPlaybackLogRetentionDays(value) &&
  savedValue !== undefined &&
  value !== savedValue &&
  !saving;
