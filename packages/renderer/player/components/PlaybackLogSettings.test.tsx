import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PlaybackLogSettings from './PlaybackLogSettings';

const { remote, watchDay, refetch } = vi.hoisted(() => ({
  remote: { version: '5.6.5', isRemoteSession: true },
  watchDay: vi.fn(() => vi.fn()),
  refetch: vi.fn(),
}));
vi.mock('/@common/remote', () => remote);
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock('../api/playback', () => ({
  useGetPlaybackSettingsQuery: () => ({
    data: { logRetentionDays: 7, currentLogPath: '/host/playback.sqlite' },
    isError: false,
    refetch,
  }),
  useUpdatePlaybackSettingsMutation: () => [vi.fn(), { isLoading: false }],
}));
vi.mock('../playback/watchPlaybackLogDay', () => ({ watchPlaybackLogDay: watchDay }));

describe('playback statistics storage path', () => {
  beforeEach(() => {
    remote.version = '5.6.5';
    remote.isRemoteSession = true;
    watchDay.mockClear();
  });

  it.each([
    ['5.6.0', true, undefined, false],
    ['5.6.4', true, 'Текущий файл', true],
    ['5.6.5', true, 'База статистики', false],
    ['5.7.0', true, 'База статистики', false],
    [undefined, true, 'База статистики', false],
    ['5.6.4', false, 'База статистики', false],
  ])(
    'labels the path for version %s and remote %s',
    (version, isRemoteSession, label, watchesDay) => {
      remote.version = version ?? '';
      remote.isRemoteSession = isRemoteSession;
      const container = document.createElement('div');
      const root = createRoot(container);
      act(() => root.render(<PlaybackLogSettings />));
      if (label) {
        expect(container.textContent).toContain(`${label}: /host/playback.sqlite`);
      } else {
        expect(container.textContent).not.toContain('/host/playback.sqlite');
      }
      expect(watchDay).toHaveBeenCalledTimes(watchesDay ? 1 : 0);
      act(() => root.unmount());
    },
  );
});
