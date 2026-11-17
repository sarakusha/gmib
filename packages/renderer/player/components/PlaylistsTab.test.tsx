import type { PropsWithChildren } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlaylistsTab from './PlaylistsTab';

const state = vi.hoisted(() => ({
  version: '5.7.7',
  remote: true,
  hasPlayer: true,
  hasPlaylists: true,
  query: vi.fn(),
  playlist: { id: 1, name: 'Программа', flags: 0, items: [{ id: 'a', md5: 'a' }] },
}));
vi.mock('/@common/remote', () => ({
  get version() {
    return state.version;
  },
  get isRemoteSession() {
    return state.remote;
  },
}));
vi.mock('../store', () => ({ useDispatch: () => vi.fn(), useSelector: () => 1 }));
vi.mock('../store/selectors', () => ({ selectCurrentPlaylist: vi.fn() }));
vi.mock('../api/player', () => ({
  usePlayer: () => ({ player: state.hasPlayer ? { id: 1 } : undefined }),
}));
vi.mock('../api/playback', () => ({
  useGetPlaylistTimingStatisticsQuery: (...args: unknown[]) => {
    state.query(...args);
    return {};
  },
}));
vi.mock('../api/media', () => ({
  useGetMediaQuery: () => ({ data: { entities: { a: { md5: 'a', duration: 60 } } } }),
  selectMediaById: () => undefined,
}));
vi.mock('../api/playlists', () => ({
  useGetPlaylists: () => ({ data: state.hasPlaylists ? [state.playlist] : [] }),
  useGetPlaylistById: () => ({ data: state.hasPlaylists ? state.playlist : undefined }),
  useRemoveMediaMutation: () => [vi.fn()],
  moveItem: vi.fn(),
  updatePlaylist: vi.fn(),
}));
vi.mock('../playback/usePlaybackIssues', () => ({
  usePlaybackIssues: () => ({ issues: [] }),
  useRetryPlayback: () => vi.fn(),
}));
vi.mock('react-resize-detector', () => ({
  useResizeDetector: () => ({ ref: { current: null }, width: 400 }),
}));
vi.mock('../../common/FixedHeadLayout', () => ({
  default: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));
vi.mock('../../common/SubmitListener', () => ({ default: () => null }));
vi.mock('./Player', () => ({ default: () => null }));
vi.mock('./CurrentPlaylist', () => ({ default: () => null }));
vi.mock('./PlaylistsToolbar', () => ({ default: () => null }));
vi.mock('./MediaItem', () => ({ default: () => null }));

describe('playlist timing UI compatibility', () => {
  beforeEach(() => {
    state.remote = true;
    state.hasPlayer = true;
    state.hasPlaylists = true;
    state.query.mockClear();
  });

  it.each([
    ['5.7.7', false],
    ['5.7.8', true],
    ['5.8.0', true],
    ['', true],
  ])('keeps nominal duration and skips unsupported timing queries on %s', (version, supported) => {
    state.version = version;
    const html = renderToStaticMarkup(<PlaylistsTab />);
    expect(html).toContain('0:01:00.0');
    expect(html).toContain('Название');
    expect(state.query).toHaveBeenCalledOnce();
    expect(state.query.mock.calls[0][1]).toMatchObject({
      skip: !supported,
      pollingInterval: 60_000,
    });
  });

  it('uses timing statistics locally regardless of published version', () => {
    state.version = '5.7.7';
    state.remote = false;
    renderToStaticMarkup(<PlaylistsTab />);
    expect(state.query.mock.calls[0][1]).toMatchObject({ skip: false });
  });

  it.each(['hasPlayer', 'hasPlaylists'] as const)('skips requests without %s', key => {
    state.version = '5.7.8';
    state[key] = false;
    renderToStaticMarkup(<PlaylistsTab />);
    expect(state.query.mock.calls[0][1]).toMatchObject({ skip: true });
  });
});
