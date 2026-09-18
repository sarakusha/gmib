import { describe, expect, it } from 'vitest';

import type { PlaybackIssue } from '/@common/playback';

import {
  isPlaybackStatusSnapshot,
  playbackIssueText,
  playbackStatusFromSocketMessage,
  selectPlaybackIssue,
} from './playbackStore';

const issue = (changes: Partial<PlaybackIssue>): PlaybackIssue => ({
  event: 'error',
  playerId: 1,
  mediaId: 'media-1',
  attempt: 1,
  playbackId: 'playback-1',
  timestamp: '2026-09-18T10:00:00.000Z',
  error: 'Decoder failed',
  ...changes,
});

describe('playback issue presentation', () => {
  it('keeps issues player-specific for the current playlist', () => {
    const issues = [
      issue({ playerId: 1, error: 'Player one' }),
      issue({ playerId: 2, error: 'Player two' }),
    ];

    expect(selectPlaybackIssue(issues, 'media-1', 2)?.error).toBe('Player two');
  });

  it('prefers quarantine over a newer ordinary error in the media library', () => {
    const issues = [
      issue({ event: 'quarantined', playerId: 1, attempt: 3 }),
      issue({ playerId: 2, timestamp: '2026-09-18T10:01:00.000Z' }),
    ];

    const selected = selectPlaybackIssue(issues, 'media-1');
    expect(selected?.event).toBe('quarantined');
    expect(selected && playbackIssueText(selected)).toBe(
      'Воспроизведение отключено после 3 ошибок',
    );
  });

  it('includes readable error details instead of relying on color', () => {
    expect(playbackIssueText(issue({ attempt: 2 }))).toBe(
      'Ошибка воспроизведения, попытка 2: Decoder failed',
    );
  });

  it('accepts the broadcast socket envelope used for playback status', () => {
    const status = { issues: [issue({ event: 'quarantined', attempt: 3 })] };

    expect(playbackStatusFromSocketMessage('playback:status', [0, status])).toEqual(status);
    expect(playbackStatusFromSocketMessage('playback:status', [1, status])).toBeUndefined();
  });

  it('rejects malformed playback snapshots from the network', () => {
    expect(isPlaybackStatusSnapshot({ issues: {} })).toBe(false);
    expect(isPlaybackStatusSnapshot({ issues: [{ mediaId: 'incomplete' }] })).toBe(false);
    expect(
      playbackStatusFromSocketMessage('playback:status', [0, { issues: null }]),
    ).toBeUndefined();
  });
});
