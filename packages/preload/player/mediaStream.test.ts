/* Dynamic browser/worker doubles deliberately expose their observed state to integration assertions. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  listeners: new Map<string, (...args: any[]) => void>(),
  send: vi.fn(),
  invoke: vi.fn(),
  dispatch: vi.fn(),
  sources: [] as any[],
  videos: [] as any[],
  player: { id: 1, playlistId: 1, current: 'bad', autoPlay: true, playbackEngine: 'decoder' },
  playlist: {
    id: 1,
    items: [
      { id: 'bad', md5: 'bad-md5' },
      { id: 'good', md5: 'good-md5' },
    ],
  },
}));
vi.mock('electron', () => ({
  ipcRenderer: {
    on: (channel: string, callback: (...args: any[]) => void) =>
      mock.listeners.set(channel, callback),
    send: mock.send,
    invoke: mock.invoke,
  },
}));
vi.mock('../common/ipcDispatch', () => ({ default: mock.dispatch }));
vi.mock('/@common/remote', () => ({ getUrl: (path: string) => path }));
vi.mock('./playbackEngine', () => ({
  resolvePlaybackEngine: (value: string) => value,
  shouldFallbackAfterDecoderError: () => false,
}));
vi.mock('@sarakusha/ebml', () => ({
  mergeStreams: () => ({
    add: (readable: Promise<void>) => readable,
    pipeTo: () => new Promise(() => {}),
  }),
}));
vi.mock('./VideoSource', () => ({
  default: class FakeVideoSource {
    closed = false;
    paused = true;
    ready = true;
    duration = 10;
    hasStarted = false;
    resolve!: () => void;
    readable = new Promise<void>(resolve => {
      this.resolve = resolve;
    });
    constructor(
      public uri: string,
      public options: any,
    ) {
      mock.sources.push(this);
    }
    close() {
      this.closed = true;
      this.resolve();
    }
    play() {
      this.paused = false;
      this.hasStarted = true;
    }
    pause() {
      this.paused = true;
    }
    setDisableFadeOut() {}
    emit(data: unknown) {
      this.options.onMessage({ data });
    }
    end() {
      this.emit({ done: true });
      this.close();
    }
  },
}));

class FakeStream {
  tracks: any[];
  constructor(tracks: any[] = []) {
    this.tracks = [...tracks];
  }
  getTracks() {
    return [...this.tracks];
  }
  addTrack(track: any) {
    this.tracks.push(track);
  }
  removeTrack(track: any) {
    this.tracks = this.tracks.filter(value => value !== track);
  }
  addEventListener() {}
}
class FakeVideo {
  listeners = new Map<string, () => void>();
  paused = true;
  currentTime = 0;
  duration = 10;
  style = {};
  error = null;
  play = vi.fn(async () => {
    this.paused = false;
    this.emit('playing');
  });
  pause() {
    this.paused = true;
  }
  captureStream() {
    return new FakeStream();
  }
  addEventListener(name: string, listener: () => void) {
    this.listeners.set(name, listener);
  }
  emit(name: string) {
    this.listeners.get(name)?.();
  }
  load() {}
  remove() {}
  removeAttribute() {}
}
const flush = async () => {
  for (let index = 0; index < 30; index += 1) await Promise.resolve();
};
const event = (channel: string, ...args: unknown[]) => mock.listeners.get(channel)?.({}, ...args);
const records = (name: string) =>
  mock.send.mock.calls
    .filter(([channel, value]) => channel === 'playback:event' && value.event === name)
    .map(([, value]) => value);
const current = () => mock.sources.findLast(source => !source.closed && !source.paused);

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  mock.listeners.clear();
  mock.sources.length = 0;
  mock.videos.length = 0;
  mock.send.mockReset();
  mock.dispatch.mockReset();
  mock.invoke.mockReset();
  mock.player = { id: 1, playlistId: 1, current: 'bad', autoPlay: true, playbackEngine: 'decoder' };
  mock.playlist = {
    id: 1,
    items: [
      { id: 'bad', md5: 'bad-md5' },
      { id: 'good', md5: 'good-md5' },
    ],
  };
  mock.invoke.mockImplementation(async (channel: string, mediaId: string) => {
    if (channel === 'getPlayer') return mock.player;
    if (channel === 'getPlaylist') return mock.playlist;
    if (channel === 'getMedia') return { filename: `${mediaId}.webm` };
    return undefined;
  });
  vi.stubGlobal('MediaStream', FakeStream);
  vi.stubGlobal(
    'MediaStreamTrackGenerator',
    class {
      kind = 'video';
      writable = {};
      stop() {}
    },
  );
  vi.stubGlobal('window', {
    location: { search: '?source_id=1', href: 'http://localhost/' },
    setInterval,
    setTimeout,
    clearTimeout,
  });
  vi.stubGlobal('document', {
    body: { append() {} },
    createElement: () => {
      const video = new FakeVideo();
      mock.videos.push(video);
      return video;
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('mediaStream recovery orchestration', () => {
  it('retries a corrupt current decoder three times, ignores duplicate callbacks, then advances', async () => {
    await import('./mediaStream');
    await flush();
    for (let index = 0; index < 3; index += 1) {
      const source = current();
      expect(source.options.mediaId).toBe('bad-md5');
      source.emit({ err: { message: 'corrupt data' } });
      source.emit({ err: { message: 'duplicate' } });
      await flush();
    }
    expect(records('error')).toHaveLength(3);
    expect(records('quarantined')).toHaveLength(1);
    expect(current().options.mediaId).toBe('good-md5');
    expect(records('started')).toHaveLength(0);
    current().emit({ frame: { timestamp: 1000 } });
    expect(records('started')).toHaveLength(1);
  });

  it('quarantines a failed preload without interrupting the good current source', async () => {
    mock.player.current = 'good';
    await import('./mediaStream');
    await flush();
    const good = current();
    for (let index = 0; index < 3; index += 1) {
      mock.sources
        .findLast(source => !source.closed && source.options.mediaId === 'bad-md5')
        .emit({ err: { message: 'preload failed' } });
      await flush();
    }
    expect(current()).toBe(good);
    expect(good.closed).toBe(false);
    expect(records('started')).toHaveLength(0);
    expect(records('quarantined')[0].mediaId).toBe('bad-md5');
  });

  it('idles after all files fail, then resumes on manual retry without changing requested playback', async () => {
    mock.playlist.items = [mock.playlist.items[0]];
    await import('./mediaStream');
    await flush();
    for (let index = 0; index < 3; index += 1) {
      current().emit({ err: { message: 'bad' } });
      await flush();
    }
    expect(current()).toBeUndefined();
    const count = mock.sources.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(mock.sources).toHaveLength(count);
    expect(
      mock.dispatch.mock.calls.some(
        ([action]) => action.type.endsWith('/setPlaybackState') && action.payload === 'none',
      ),
    ).toBe(false);
    event('playback:retry', 'bad-md5');
    await flush();
    expect(current()).toBeDefined();
  });

  it('ignores asynchronous metadata resolving after explicit stop', async () => {
    let resolve!: (value: unknown) => void;
    const invoke = mock.invoke.getMockImplementation()!;
    mock.invoke.mockImplementation((channel: string, ...args: any[]) =>
      channel === 'getMedia'
        ? new Promise(done => {
            resolve = done;
          })
        : invoke(channel, ...args),
    );
    await import('./mediaStream');
    await flush();
    event('stop');
    resolve({ filename: 'late.webm' });
    await flush();
    expect(mock.sources).toHaveLength(0);
    expect(records('started')).toHaveLength(0);
  });

  it('handles rejected capture play promises and stale video events', async () => {
    mock.player.playbackEngine = 'capture';
    vi.stubGlobal('document', {
      body: { append() {} },
      createElement: () => {
        const video = new FakeVideo();
        if (mock.videos.length < 3) video.play.mockRejectedValue(new Error('unsupported codec'));
        mock.videos.push(video);
        return video;
      },
    });
    await import('./mediaStream');
    await flush();
    expect(records('quarantined')).toHaveLength(1);
    expect(records('error')).toHaveLength(3);
    expect(records('started')[0].mediaId).toBe('good-md5');
    mock.videos[0].emit('ended');
    mock.videos[0].emit('playing');
    await flush();
    expect(records('started')).toHaveLength(1);
    expect(mock.videos.at(-1).paused).toBe(false);
  });

  it('keeps duplicate media quarantined across playlist edits and resumes for a new healthy item', async () => {
    mock.playlist.items = [
      { id: 'bad', md5: 'bad-md5' },
      { id: 'duplicate', md5: 'bad-md5' },
    ];
    await import('./mediaStream');
    await flush();
    for (let index = 0; index < 3; index += 1) {
      current().emit({ err: { message: 'bad' } });
      await flush();
    }
    expect(current()).toBeUndefined();
    event('updatePlaylist', {
      ...mock.playlist,
      items: [...mock.playlist.items, { id: 'new', md5: 'new-md5' }],
    });
    await flush();
    expect(current().options.mediaId).toBe('new-md5');
    expect(records('error')).toHaveLength(3);
  });

  it('preserves pause, seek and single-file loop behavior without duplicate starts or false completions', async () => {
    mock.playlist.items = [mock.playlist.items[0]];
    const module = await import('./mediaStream');
    await flush();
    const initial = current();
    expect(initial.options.fade.disableIn).toBe(true);
    initial.emit({ frame: { timestamp: 1_000_000 } });
    event('player', { ...mock.player, autoPlay: false });
    await flush();
    expect(initial.paused).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(records('error')).toHaveLength(0);
    module.seek(2);
    await flush();
    const sought = mock.sources.at(-1);
    expect(sought.options.fade).toEqual({ disableIn: true, disableOut: true, duration: 0 });
    expect(sought.paused).toBe(true);
    expect(records('completed')).toHaveLength(0);
    event('player', mock.player);
    await flush();
    current().emit({ frame: { timestamp: 2_000_000 } });
    expect(records('started')).toHaveLength(1);
    current().end();
    await flush();
    expect(current().options.mediaId).toBe('bad-md5');
    current().emit({ frame: { timestamp: 1_000_000 } });
    expect(records('started')).toHaveLength(2);
    expect(records('completed')).toHaveLength(1);
  });

  it('preserves the original playlist context when an old source fails during an asynchronous switch', async () => {
    await import('./mediaStream');
    await flush();
    const source = current();
    let resolve!: (value: unknown) => void;
    const invoke = mock.invoke.getMockImplementation()!;
    mock.invoke.mockImplementation((channel: string, ...args: any[]) =>
      channel === 'getPlaylist'
        ? new Promise(done => {
            resolve = done;
          })
        : invoke(channel, ...args),
    );
    event('player', { ...mock.player, playlistId: 2, playbackEngine: 'capture' });
    source.emit({ err: { message: 'old file failed during playlist lookup' } });
    expect(records('error')[0]).toMatchObject({ playlistId: 1, engine: 'decoder' });
    resolve({ id: 2, items: [{ id: 'new', md5: 'new-md5' }] });
    await flush();
  });

  it('keeps absolute seek positions and updates the UI at timer cadence instead of every frame', async () => {
    await import('./mediaStream');
    await flush();
    const source = current();
    source.duration = 60;
    source.emit({ seekStartTime: 10 });
    mock.dispatch.mockClear();
    source.emit({ frame: { timestamp: 1_000_000 } });
    source.emit({ frame: { timestamp: 1_020_000 } });
    expect(
      mock.dispatch.mock.calls.filter(([action]) => action.type.endsWith('/setPosition')),
    ).toHaveLength(0);
    source.emit({ timer: 1 });
    expect(
      mock.dispatch.mock.calls
        .filter(([action]) => action.type.endsWith('/setPosition'))
        .at(-1)?.[0].payload,
    ).toBe(11);
  });

  it('normalizes empty and oversized errors to the shared event schema', async () => {
    const { isPlaybackEvent } = await import('/@common/playback');
    await import('./mediaStream');
    await flush();
    current().emit({ err: { message: '' } });
    await flush();
    current().emit({ err: { message: 'x'.repeat(20_000) } });
    await flush();
    expect(records('error')).toHaveLength(2);
    expect(records('error').every(isPlaybackEvent)).toBe(true);
    expect(records('error')[0].error).toBe('Unknown playback error');
    expect(records('error')[1].error).toHaveLength(16_384);
  });

  it('bounds silent decoder hangs using the watchdog and quarantines them', async () => {
    mock.playlist.items = [mock.playlist.items[0]];
    await import('./mediaStream');
    await flush();
    await vi.advanceTimersByTimeAsync(100_000);
    expect(records('error')).toHaveLength(3);
    expect(records('quarantined')).toHaveLength(1);
    expect(current()).toBeUndefined();
  });

  it('continues recovery even if the playback event IPC sender throws', async () => {
    mock.playlist.items = [mock.playlist.items[0]];
    mock.send.mockImplementation(() => {
      throw new Error('logging disconnected');
    });
    await import('./mediaStream');
    await flush();
    for (let index = 0; index < 3; index += 1) {
      current().emit({ err: { message: 'bad' } });
      await flush();
    }
    expect(current()).toBeUndefined();
  });

  it('reports completed only at EOF and counts zero-frame EOF as a failure', async () => {
    mock.playlist.items = [mock.playlist.items[0]];
    await import('./mediaStream');
    await flush();
    current().end();
    await flush();
    expect(records('error')).toHaveLength(1);
    current().emit({ frame: { timestamp: 1_000_000 } });
    const started = records('started')[0];
    current().end();
    await flush();
    expect(records('completed')[0].playbackId).toBe(started.playbackId);
    event('stop');
    await flush();
    expect(records('completed')).toHaveLength(1);
  });
});
