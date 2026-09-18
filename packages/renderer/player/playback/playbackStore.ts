import {
  isPlaybackEvent,
  type PlaybackIssue,
  type PlaybackStatusSnapshot,
} from '/@common/playback';

let snapshot: PlaybackStatusSnapshot = { issues: [] };
const listeners = new Set<() => void>();

const emit = (): void => listeners.forEach(listener => listener());

export const getPlaybackSnapshot = (): PlaybackStatusSnapshot => snapshot;

export const subscribePlaybackStatus = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setPlaybackStatus = (next: PlaybackStatusSnapshot): void => {
  snapshot = next;
  emit();
};

export const clearPlaybackIssues = (mediaId: string): void => {
  const issues = snapshot.issues.filter(issue => issue.mediaId !== mediaId);
  if (issues.length !== snapshot.issues.length) setPlaybackStatus({ issues });
};

export const isPlaybackStatusSnapshot = (value: unknown): value is PlaybackStatusSnapshot => {
  if (typeof value !== 'object' || value === null || !('issues' in value)) return false;
  const { issues } = value;
  return (
    Array.isArray(issues) &&
    issues.every(
      issue => isPlaybackEvent(issue) && (issue.event === 'error' || issue.event === 'quarantined'),
    )
  );
};

export const playbackStatusFromSocketMessage = (
  event: string,
  data: unknown[],
): PlaybackStatusSnapshot | undefined => {
  if (event !== 'playback:status' || data[0] !== 0) return undefined;
  const status = data[1];
  return isPlaybackStatusSnapshot(status) ? status : undefined;
};

export const selectPlaybackIssue = (
  issues: PlaybackIssue[],
  mediaId: string,
  playerId?: number,
): PlaybackIssue | undefined =>
  issues
    .filter(issue => issue.mediaId === mediaId && (playerId == null || issue.playerId === playerId))
    .sort((left, right) => {
      const severity = Number(right.event === 'quarantined') - Number(left.event === 'quarantined');
      return severity || Date.parse(right.timestamp) - Date.parse(left.timestamp);
    })[0];

export const playbackIssueText = (issue: PlaybackIssue): string => {
  if (issue.event === 'quarantined') {
    return `Воспроизведение отключено после ${issue.attempt} ошибок`;
  }
  const details = issue.error ? `: ${issue.error}` : '';
  return `Ошибка воспроизведения, попытка ${issue.attempt}${details}`;
};
