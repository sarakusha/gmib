import { type MergeableStream, mergeStreams } from '@sarakusha/ebml';

import { ipcRenderer } from 'electron';

import debugFactory from 'debug';

import type { PlaybackEvent } from '/@common/playback';
import type { MediaInfo } from '/@common/mediaInfo';
import type { Playlist, PlaylistItem } from '/@common/playlist';
import { getUrl } from '/@common/remote';
import type { CandidateMessage, OfferMessage, RtcMessage, WithWebSocketKey } from '/@common/rtc';
import type { Player } from '/@common/video';

import Deferred from '/@common/Deferred';
import {
  setCurrentPlaylistItem,
  setDuration,
  setPlaybackState,
  setPosition,
} from '/@player/store/currentSlice';

import ipcDispatch from '../common/ipcDispatch';
import VideoSource from './VideoSource';
import { resolvePlaybackEngine, shouldFallbackAfterDecoderError } from './playbackEngine';
import PlaybackWatchdog from './playbackWatchdog';
import PlaybackRecovery, { type PlaybackAttempt } from './playbackRecovery';

let playlist: Playlist | undefined;
let player: Player;
let playbackState: MediaSessionPlaybackState = 'none';
let activeEngine: Player['playbackEngine'] | undefined;
let currentItemId: string | undefined;
let sourceVideo: HTMLVideoElement | undefined;
let capturedStream: MediaStream | undefined;
// let captureGeneration = 0;
const consumers = new Set<HTMLVideoElement>();

const search = new URLSearchParams(window.location.search);
const sourceId = +(search.get('source_id') ?? 1);

const stream = new MediaStream();
const streamReady = new Deferred<void>();
const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:mediastream`);
const PLAYBACK_STALL_CHECK_INTERVAL = 5_000;
const playbackWatchdog = new PlaybackWatchdog();

const recovery = new PlaybackRecovery();
const sourceAttempts = new WeakMap<VideoSource, PlaybackAttempt>();
const endedSources = new WeakSet<VideoSource>();
let captureAttempt: PlaybackAttempt | undefined;
let revision = 0;
let updatePending = false;
let updating = false;

const reportAttempt = (
  attempt: PlaybackAttempt,
  event: PlaybackEvent['event'],
  error?: string,
): void => {
  try {
    ipcRenderer.send('playback:event', {
      event,
      playerId: sourceId,
      playlistId: player?.playlistId ?? undefined,
      itemId: attempt.itemId,
      mediaId: attempt.mediaId,
      filename: attempt.filename,
      attempt: attempt.attempt,
      playbackId: attempt.playbackId,
      timestamp: new Date().toISOString(),
      engine: activeEngine,
      error,
    } satisfies PlaybackEvent);
  } catch {
    /* Logging must not prevent playback recovery. */
  }
};

const markStarted = (attempt?: PlaybackAttempt): void => {
  if (!attempt || attempt.failed || attempt.started || playbackState !== 'playing') return;
  // eslint-disable-next-line no-param-reassign
  attempt.started = true;
  reportAttempt(attempt, 'started');
};

const recordFailure = (attempt: PlaybackAttempt, error: unknown): void => {
  if (!recovery.fail(attempt)) return;
  const message = error instanceof Error ? error.message : String(error);
  reportAttempt(attempt, 'error', message);
  if (recovery.blocked(attempt.mediaId)) reportAttempt(attempt, 'quarantined', message);
};

const withTimeout = async <T>(promise: Promise<T>, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), 15_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

let linuxPreferSoftwareDecoding = false;

const getMediaUri = (name?: string) =>
  name && new URL(getUrl(`/public/${name}`), window.location.href).href;

const getPlaybackEngine = (): NonNullable<Player['playbackEngine']> =>
  resolvePlaybackEngine(player.playbackEngine);

const updatePlaybackState = (next: MediaSessionPlaybackState): void => {
  if (playbackState === next) return;
  playbackState = next;
  playbackWatchdog.setActive(next === 'playing');
  ipcDispatch(setPlaybackState(next));
};

type CaptureStreamVideo = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

const getCaptureStream = (video: HTMLVideoElement): MediaStream => {
  const captureVideo = video as CaptureStreamVideo;
  const captureStream = captureVideo.captureStream ?? captureVideo.mozCaptureStream;
  if (!captureStream) throw new Error('HTMLVideoElement.captureStream is not available');
  return captureStream.call(video);
};

const createSourceVideo = (uri: string): HTMLVideoElement => {
  // debug(`create hidden source video: ${uri}`);
  const video = document.createElement('video');
  video.autoplay = false;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.style.cssText =
    'position:absolute;left:-1px;top:-1px;width:1px;height:1px;opacity:0;pointer-events:none;';
  video.addEventListener('loadedmetadata', () => {
    if (video !== sourceVideo) return;
    refreshStreamTracks();
    ipcDispatch(setDuration(Number.isFinite(video.duration) ? video.duration : undefined));
  });
  video.addEventListener('durationchange', () => {
    if (video !== sourceVideo) return;
    ipcDispatch(setDuration(Number.isFinite(video.duration) ? video.duration : undefined));
  });
  video.addEventListener('timeupdate', () => {
    if (video !== sourceVideo) return;
    // debug(`source time update: ${video.currentTime}s`);
    ipcDispatch(setPosition(video.currentTime));
  });
  video.addEventListener('playing', () => {
    if (video === sourceVideo) markStarted(captureAttempt);
  });
  video.addEventListener('ended', () => {
    if (video !== sourceVideo || playbackState !== 'playing') return;
    if (captureAttempt && !captureAttempt.started) {
      requestPlaybackRecovery('Capture ended without starting playback');
      return;
    }
    if (captureAttempt?.started && !captureAttempt.failed) {
      reportAttempt(captureAttempt, 'completed');
      recovery.reset(captureAttempt.mediaId);
    }
    clearSource();
    playNextItem();
  });
  video.addEventListener('error', () => {
    const message = video.error?.message || `media error code ${video.error?.code ?? 'unknown'}`;
    if (video === sourceVideo) requestPlaybackRecovery(`source video error: ${message}`);
  });

  (document.body ?? document.documentElement).append(video);
  sourceVideo = video;
  video.src = uri;
  video.load();

  capturedStream = getCaptureStream(video);
  // captureGeneration += 1;
  // const generation = captureGeneration;
  const captured = capturedStream;
  // debug(`create capture stream #${generation}: ${captured.id}`);
  captured.addEventListener('addtrack', _event => {
    // debug(`capture stream #${generation} add ${event.track.kind} track: ${event.track.id}`);
    if (capturedStream === captured) refreshStreamTracks();
  });
  captured.addEventListener('removetrack', _event => {
    // debug(`capture stream #${generation} remove ${event.track.kind} track: ${event.track.id}`);
    if (capturedStream === captured) refreshStreamTracks();
  });
  return video;
};

const shouldEnableTrack = (track: MediaStreamTrack): boolean => {
  if (!playlist?.items.length) return false;
  if (track.kind === 'audio') return playbackState === 'playing';
  return playbackState !== 'none';
};

const syncConsumerPlayback = (): void => {
  // debug(`sync consumer playback: ${(new Error().stack ?? '').split('\n')[1]?.trim()}`);
  consumers.forEach(video => {
    if (!video.isConnected) {
      consumers.delete(video);
      return;
    }
    if (video.srcObject !== stream) {
      // eslint-disable-next-line no-param-reassign
      video.srcObject = stream;
    }
    if (playbackState === 'playing') {
      void video.play().catch(err => {
        debug(
          `error while starting stream consumer: ${(err as Error).message} ${JSON.stringify((err as Error).stack)}`,
        );
      });
    } else {
      // debug(`pause stream consumer: ${video.id ?? '<unknown>'}`);
      video.pause();
    }
  });
};

const blankConsumers = (): void => {
  consumers.forEach(video => {
    if (!video.isConnected) {
      consumers.delete(video);
      return;
    }
    video.pause();
    // eslint-disable-next-line no-param-reassign
    video.srcObject = null;
  });
};

const replaceStreamTracks = (captured: MediaStream): void => {
  const nextTracks = captured.getTracks();
  let changed = false;
  stream.getTracks().forEach(track => {
    if (!nextTracks.includes(track)) {
      // debug(`remove ${track.kind} track from shared stream: ${track.id}`);
      stream.removeTrack(track);
      changed = true;
    }
  });
  nextTracks.forEach(track => {
    // eslint-disable-next-line no-param-reassign
    track.enabled = shouldEnableTrack(track);
    if (!stream.getTracks().includes(track)) {
      // debug(`add ${track.kind} track to shared stream: ${track.id}`);
      stream.addTrack(track);
      changed = true;
    }
  });
  if (changed) {
    // debug(
    //   `shared stream tracks: ${stream
    //     .getTracks()
    //     .map(track => `${track.kind}:${track.id}:${track.enabled ? 'enabled' : 'disabled'}`)
    //     .join(', ')}`,
    // );
    replacePeerTracks();
  }
};

const refreshStreamTracks = (): void => {
  if (!capturedStream) return;
  replaceStreamTracks(capturedStream);
};

const syncTrackEnabled = (): void => {
  stream.getTracks().forEach(track => {
    // eslint-disable-next-line no-param-reassign
    track.enabled = shouldEnableTrack(track);
  });
  syncConsumerPlayback();
};

const pauseSource = (): void => {
  sourceVideo?.pause();
  syncConsumerPlayback();
};

const disposeSource = (_reason: string): void => {
  const video = sourceVideo;
  const captured = capturedStream;
  if (!video && !captured) return;
  // debug(`dispose source: ${reason}`);
  video?.pause();
  sourceVideo = undefined;
  capturedStream = undefined;
  replaceStreamTracks(new MediaStream());
  captured?.getTracks().forEach(track => {
    // debug(`stop captured ${track.kind} track: ${track.id}`);
    track.stop();
  });
  if (video) {
    video.removeAttribute('src');
    video.load();
    video.remove();
  }
};

const clearSource = (): void => {
  // debug('clear source');
  currentItemId = undefined;
  captureAttempt = undefined;
  disposeSource('clear source');
  ipcDispatch(setDuration(0));
  ipcDispatch(setPosition(0));
};

const playSource = async (): Promise<void> => {
  const video = sourceVideo;
  const version = revision;
  if (!video) return;
  try {
    await withTimeout(video.play(), 'Capture playback did not start');
    if (video === sourceVideo && playbackState === 'playing') syncConsumerPlayback();
  } catch (err) {
    if (video === sourceVideo && version === revision && playbackState === 'playing')
      requestPlaybackRecovery(String(err));
  }
};

const selectItem = (advance = false): PlaylistItem | undefined =>
  recovery.select(playlist?.items ?? [], player?.current, advance);

const selectCurrent = (item: PlaylistItem): void => {
  if (player.current === item.id) return;
  player = { ...player, current: item.id };
  ipcDispatch(setCurrentPlaylistItem({ itemId: item.id, mediaId: item.md5 }));
};

const playNextItem = (): void => {
  const next = selectItem(true);
  if (next) selectCurrent(next);
  scheduleUpdate();
};

let currentSource: VideoSource | undefined;
let nextSource: VideoSource | undefined;
let videoStream: MergeableStream<VideoFrame> | undefined;
let decoderPosition = 0;
let decoderDuration = 0;
let preloadedAt = 0;

const clampSeekPosition = (position: number, duration?: number): number => {
  const nextPosition = Math.max(0, position);
  if (!duration || !Number.isFinite(duration)) return nextPosition;
  return Math.min(nextPosition, Math.max(0, duration - 0.1));
};

const getActiveDuration = (): number =>
  activeEngine === 'decoder'
    ? decoderDuration || currentSource?.duration || 0
    : Number.isFinite(sourceVideo?.duration)
      ? (sourceVideo?.duration ?? 0)
      : 0;

const disposeDecoder = (): void => {
  const current = currentSource;
  const next = nextSource;
  currentSource = undefined;
  nextSource = undefined;
  current?.close();
  next?.close();
  // A merged stream stays writable across file failures; retire it only when the engine stops.
  videoStream = undefined;
  decoderPosition = 0;
  decoderDuration = 0;
  blankConsumers();
  const tracks = stream.getTracks();
  replaceStreamTracks(new MediaStream());
  tracks.forEach(track => track.stop());
};

const failDecoder = (source: VideoSource, error: unknown): void => {
  if (source !== currentSource && source !== nextSource) return;
  const attempt = sourceAttempts.get(source);
  if (!attempt || attempt.failed) return;
  recordFailure(attempt, error);
  if (shouldFallbackAfterDecoderError() && !linuxPreferSoftwareDecoding) {
    linuxPreferSoftwareDecoding = true;
    void ipcRenderer.invoke('setLocalConfig', 'linuxPreferSoftwareDecoding', true).catch(() => {});
  }
  if (source === currentSource) currentSource = undefined;
  if (source === nextSource) nextSource = undefined;
  source.close();
  scheduleUpdate();
};

type DecoderSourceMessage = {
  frame?: VideoFrame;
  done?: boolean;
  duration?: number;
  seekStartTime?: number;
  timer?: number;
  recoverableError?: { message?: string };
  err?: { message?: string };
};

const handleDecoderSourceMessage = (source: VideoSource, data: DecoderSourceMessage): void => {
  if (source !== currentSource && source !== nextSource) return;
  if (data.err || data.recoverableError) {
    failDecoder(source, data.err?.message ?? data.recoverableError?.message ?? 'Decoder error');
    return;
  }
  if (source !== currentSource) return;
  if (data.frame && playbackState === 'playing') {
    markStarted(sourceAttempts.get(source));
    playbackWatchdog.defer();
    decoderPosition = data.frame.timestamp / 1_000_000;
    ipcDispatch(setPosition(decoderPosition));
  }
  if (typeof data.duration === 'number') {
    decoderDuration = data.duration;
    ipcDispatch(setDuration(data.duration));
  }
  // eslint-disable-next-line no-param-reassign
  if (typeof data.seekStartTime === 'number') source.options.startTime = data.seekStartTime;
  if (typeof data.timer === 'number') {
    decoderPosition = (source.options.startTime ?? 0) + data.timer;
    ipcDispatch(setPosition(decoderPosition));
  }
  if (data.done) endedSources.add(source);
  if (data.done && !sourceAttempts.get(source)?.started) {
    failDecoder(source, 'Decoder ended without a playable frame');
  }
};

const initializeDecoderStream = (): void => {
  if (videoStream) return;
  const merged = mergeStreams<VideoFrame>();
  videoStream = merged;
  const trackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
  void merged.pipeTo(trackGenerator.writable).catch(err => {
    if (videoStream !== merged) return;
    videoStream = undefined;
    if (currentSource) failDecoder(currentSource, err);
  });
  replaceStreamTracks(new MediaStream([trackGenerator]));
};

const activateDecoder = (source: VideoSource): void => {
  const merged = videoStream;
  if (!merged) return;
  currentSource = source;
  if (nextSource === source) nextSource = undefined;
  const item = playlist?.items.find(candidate => candidate.id === source.options.itemId);
  if (item) selectCurrent(item);
  decoderPosition = source.options.startTime ?? 0;
  decoderDuration = source.duration;
  ipcDispatch(setPosition(decoderPosition));
  ipcDispatch(setDuration(decoderDuration));
  playbackWatchdog.defer();
  if (playbackState === 'playing') source.play();
  void merged
    .add(source.readable)
    .then(() => {
      if (source !== currentSource || videoStream !== merged) return;
      const attempt = sourceAttempts.get(source);
      if (attempt?.started && !attempt.failed && endedSources.has(source)) {
        reportAttempt(attempt, 'completed');
        recovery.reset(attempt.mediaId);
      }
      currentSource = undefined;
      playNextItem();
    })
    .catch(err => failDecoder(source, err));
};

const loadMedia = async (
  item: PlaylistItem,
  version: number,
): Promise<{ uri: string; attempt: PlaybackAttempt } | undefined> => {
  const attempt = recovery.begin(item);
  try {
    const media: MediaInfo | undefined = await withTimeout(
      ipcRenderer.invoke('getMedia', item.md5),
      'Media lookup timed out',
    );
    if (version !== revision) return undefined;
    attempt.filename = media?.filename;
    const uri = getMediaUri(media?.filename);
    if (!uri) throw new Error('Media file is missing');
    return { uri, attempt };
  } catch (error) {
    if (version !== revision) return undefined;
    recordFailure(attempt, error);
    scheduleUpdate();
    return undefined;
  }
};

const createDecoder = (
  uri: string,
  attempt: PlaybackAttempt,
  startTime = 0,
  seeking = false,
): VideoSource => {
  const item = playlist?.items.find(candidate => candidate.id === attempt.itemId);
  const next = recovery.select(playlist?.items ?? [], attempt.itemId, true);
  const same = item?.md5 === next?.md5;
  const source = new VideoSource(uri, {
    itemId: attempt.itemId,
    mediaId: attempt.mediaId,
    startTime,
    preferSoftwareDecoding: linuxPreferSoftwareDecoding,
    fade: {
      disableIn: seeking || same || player.disableFadeIn,
      disableOut: seeking || same || player.disableFadeOut,
      duration: seeking ? 0 : 500,
    },
    onMessage: ({ data }: { data: DecoderSourceMessage }) =>
      handleDecoderSourceMessage(source, data),
  });
  sourceAttempts.set(source, attempt);
  return source;
};

const updateDecoder = async (version: number): Promise<void> => {
  const item = selectItem();
  if (playbackState === 'none' || !item) {
    disposeDecoder();
    return;
  }
  initializeDecoderStream();
  selectCurrent(item);
  if (currentSource?.options.itemId !== item.id) {
    const previous = currentSource;
    currentSource = undefined;
    previous?.close();
    if (nextSource?.options.itemId === item.id && !nextSource.closed) activateDecoder(nextSource);
    else {
      const loaded = await loadMedia(item, version);
      if (!loaded) return;
      try {
        activateDecoder(createDecoder(loaded.uri, loaded.attempt));
      } catch (err) {
        recordFailure(loaded.attempt, err);
        scheduleUpdate();
        return;
      }
    }
  }
  if (currentSource) {
    if (playbackState === 'playing') currentSource.play();
    else currentSource.pause();
    currentSource.setDisableFadeOut(player.disableFadeOut || selectItem(true)?.md5 === item.md5);
  }
  syncTrackEnabled();
  const nextItem = selectItem(true);
  // Never decode the same file concurrently: both failures belong to one retry budget.
  if (!nextItem || nextItem.md5 === item.md5 || nextSource?.options.itemId !== nextItem.id) {
    const stale = nextSource;
    nextSource = undefined;
    stale?.close();
  }
  if (nextItem && nextItem.md5 !== item.md5 && !nextSource && playbackState === 'playing') {
    const loaded = await loadMedia(nextItem, version);
    if (!loaded) return;
    try {
      nextSource = createDecoder(loaded.uri, loaded.attempt);
      preloadedAt = Date.now();
    } catch (err) {
      recordFailure(loaded.attempt, err);
      scheduleUpdate();
    }
  }
};

const updateCapture = async (version: number): Promise<void> => {
  const item = selectItem();
  if (playbackState === 'none' || !item) {
    clearSource();
    blankConsumers();
    return;
  }
  selectCurrent(item);
  if (currentItemId !== item.id || !sourceVideo) {
    const loaded = await loadMedia(item, version);
    if (!loaded) return;
    disposeSource('replace source');
    currentItemId = item.id;
    captureAttempt = loaded.attempt;
    try {
      createSourceVideo(loaded.uri);
      playbackWatchdog.defer();
      refreshStreamTracks();
    } catch (error) {
      recordFailure(loaded.attempt, error);
      clearSource();
      scheduleUpdate();
      return;
    }
  }
  syncTrackEnabled();
  if (playbackState === 'playing' && sourceVideo?.paused) await playSource();
  else if (playbackState !== 'playing') pauseSource();
};

const update = async (): Promise<void> => {
  updatePending = true;
  if (updating || !player) return;
  updating = true;
  try {
    while (updatePending) {
      updatePending = false;
      const version = revision;
      const engine = getPlaybackEngine();
      if (activeEngine !== engine) {
        clearSource();
        disposeDecoder();
        activeEngine = engine;
      }
      try {
        if (engine === 'capture') await updateCapture(version);
        else await updateDecoder(version);
      } catch (error) {
        const item = selectItem();
        if (item && version === revision) {
          recordFailure(recovery.begin(item), error);
          updatePending = true;
        }
      }
    }
  } finally {
    updating = false;
  }
};

function scheduleUpdate(): void {
  revision += 1;
  void update();
}

function requestPlaybackRecovery(reason: string): void {
  if (playbackState !== 'playing') return;
  playbackWatchdog.defer();
  if (activeEngine === 'decoder' && currentSource) failDecoder(currentSource, reason);
  else if (activeEngine === 'capture' && captureAttempt) {
    recordFailure(captureAttempt, reason);
    clearSource();
    scheduleUpdate();
  } else scheduleUpdate();
}

window.setInterval(() => {
  const active = Boolean(playbackState === 'playing' && selectItem());
  if (
    playbackWatchdog.observe(
      active,
      activeEngine === 'capture' ? sourceVideo?.currentTime : undefined,
    )
  ) {
    requestPlaybackRecovery('Playback did not advance for 30 seconds');
  }
  if (active && nextSource && !nextSource.ready && Date.now() - preloadedAt >= 30_000) {
    failDecoder(nextSource, 'Preloaded decoder did not become ready for 30 seconds');
  }
}, PLAYBACK_STALL_CHECK_INTERVAL);

export const attachStreamToVideo = (video: HTMLVideoElement): void => {
  if (video) {
    // debug(`attach shared stream to ${video.tagName.toLowerCase()}#${video.id || '<no-id>'}`);
    // eslint-disable-next-line no-param-reassign
    video.srcObject = stream;
    consumers.add(video);
    syncConsumerPlayback();
  }
};

export const updateSrcObject = (selector: string) => {
  const video = document.querySelector(selector) as HTMLVideoElement;
  if (video) attachStreamToVideo(video);
};

export const seek = (position: number): void => {
  if (!Number.isFinite(position)) return;
  const nextPosition = clampSeekPosition(position, getActiveDuration());
  if (activeEngine === 'capture' && sourceVideo) {
    try {
      sourceVideo.currentTime = nextPosition;
    } catch (error) {
      requestPlaybackRecovery(String(error));
    }
  } else if (activeEngine === 'decoder' && currentSource) {
    const previous = currentSource;
    const attempt = sourceAttempts.get(previous);
    if (!attempt) return;
    try {
      const source = createDecoder(previous.uri, attempt, nextPosition, true);
      currentSource = undefined;
      previous.close();
      activateDecoder(source);
    } catch (error) {
      failDecoder(previous, error);
    }
  }
};

let playerRequest = 0;
const applyPlayer = async (value: Player, restart = false): Promise<void> => {
  const request = ++playerRequest;
  revision += 1;
  player = value;
  // Pause immediately, before awaiting playlist IPC, so late play/decoder events cannot resume it.
  if (!value.autoPlay) {
    updatePlaybackState('paused');
    sourceVideo?.pause();
    currentSource?.pause();
  }
  try {
    const loaded: Playlist | undefined = value.playlistId
      ? await withTimeout(
          ipcRenderer.invoke('getPlaylist', value.playlistId),
          'Playlist lookup timed out',
        )
      : undefined;
    if (request !== playerRequest) return;
    playlist = loaded;
    updatePlaybackState(value.autoPlay ? 'playing' : loaded?.items.length ? 'paused' : 'none');
    await update();
    if (restart && request === playerRequest) seek(0);
  } catch (error) {
    // Keep the requested state. A later player/playlist update can restore unavailable metadata.
    debug(`playlist lookup failed: ${String(error)}`);
  }
};

const initialize = async (): Promise<void> => {
  streamReady.resolve();
  try {
    if (shouldFallbackAfterDecoderError()) {
      linuxPreferSoftwareDecoding = Boolean(
        await ipcRenderer.invoke('getLocalConfig', 'linuxPreferSoftwareDecoding'),
      );
    }
    const value: Player = await ipcRenderer.invoke('getPlayer', sourceId);
    if (!player) await applyPlayer(value);
  } catch (error) {
    debug(`player initialization failed: ${String(error)}`);
  }
};

ipcRenderer.on('player', (_, value: Player, options?: { restart?: boolean }) => {
  void applyPlayer(value, options?.restart);
});

ipcRenderer.on('updatePlaylist', (_, updatedPlaylist: Playlist) => {
  if (updatedPlaylist.id !== player?.playlistId) return;
  playlist = updatedPlaylist;
  scheduleUpdate();
});

ipcRenderer.on('playback:retry', (_, mediaId: string) => {
  recovery.reset(mediaId);
  scheduleUpdate();
});

ipcRenderer.on('stop', () => {
  playerRequest += 1;
  revision += 1;
  const duration = getActiveDuration();
  updatePlaybackState('none');
  clearSource();
  disposeDecoder();
  blankConsumers();
  ipcDispatch(setDuration(duration));
  ipcDispatch(setPosition(0));
});

type PeerEntry = {
  pc: RTCPeerConnection;
  senders: Map<TrackKind, RTCRtpSender>;
};

const trackKinds = ['video', 'audio'] as const;
type TrackKind = (typeof trackKinds)[number];

const peers = new Map<string, PeerEntry>();
const PREVIEW_MAX_BITRATE = 1_500_000;
const PREVIEW_MAX_FRAMERATE = 15;

const replacePeerTracks = (): void => {
  peers.forEach(({ senders }) => {
    senders.forEach((sender, kind) => {
      const track = stream.getTracks().find(candidate => candidate.kind === kind) ?? null;
      // debug(`replace ${kind} peer track: ${track?.id ?? '<none>'}`);
      void sender.replaceTrack(track).catch(err => {
        debug(`error while replacing ${kind} track: ${(err as Error).message}`);
      });
    });
  });
};

const addTrackSender = (pc: RTCPeerConnection, kind: TrackKind): RTCRtpSender => {
  const track = stream.getTracks().find(candidate => candidate.kind === kind);
  const transceiver = track
    ? pc.addTransceiver(track, { direction: 'sendonly', streams: [stream] })
    : pc.addTransceiver(kind, { direction: 'sendonly', streams: [stream] });
  const { sender } = transceiver;
  const updateParams = () => {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) setTimeout(updateParams, 10);
    else {
      params.encodings[0].maxBitrate = PREVIEW_MAX_BITRATE;
      if (kind === 'video') params.encodings[0].maxFramerate = PREVIEW_MAX_FRAMERATE;
      void sender.setParameters(params).catch(err => {
        debug(`error while setting ${kind} preview encoding params: ${(err as Error).message}`);
      });
    }
  };
  updateParams();
  return sender;
};

ipcRenderer.on('socket', (_, { id, ...msg }: WithWebSocketKey<RtcMessage>) => {
  void (async () => {
    if (msg.event === 'outputVisibility' || msg.event === 'displayTopologyChanged') return;
    if (msg.sourceId !== sourceId) return;
    switch (msg.event) {
      case 'request':
        try {
          const prev = peers.get(id);
          if (prev && !['closed', 'disconnected', 'failed'].includes(prev.pc.connectionState)) {
            return;
          }
          prev?.pc.close();

          const pc = new RTCPeerConnection();
          const entry: PeerEntry = { pc, senders: new Map() };
          peers.set(id, entry);
          // debug(`create peer: ${id}`);

          pc.onconnectionstatechange = () => {
            // debug(`peer ${id} connection state: ${pc.connectionState}`);
            if (['closed', 'disconnected', 'failed'].includes(pc.connectionState)) {
              peers.delete(id);
              pc.close();
              // debug(`delete peer: ${id}`);
            }
          };

          pc.onicecandidate = e => {
            const { candidate } = e;
            if (!candidate) return;
            const candidateMsg: WithWebSocketKey<CandidateMessage> = {
              id,
              event: 'candidate',
              candidate: candidate.toJSON(),
              sourceId,
              sourceType: 'player',
            };
            void ipcRenderer.invoke('socket', candidateMsg);
          };
          await streamReady.promise;
          trackKinds.forEach(kind => {
            entry.senders.set(kind, addTrackSender(pc, kind));
          });

          const offer = await pc.createOffer();
          const offerMsg: WithWebSocketKey<OfferMessage> = {
            id,
            event: 'offer',
            desc: JSON.parse(JSON.stringify(offer)),
            sourceId,
            sourceType: 'player',
          };
          await pc.setLocalDescription(offer);
          await ipcRenderer.invoke('socket', offerMsg);
        } catch (e) {
          debug(`error while create offer: ${(e as Error).message}`);
        }
        break;
      case 'candidate':
        {
          const entry = peers.get(id);
          if (!entry) debug(`Unknown id: ${id} [${[...peers.keys()].join(',')}]`);
          else if (msg.candidate) await entry.pc.addIceCandidate(msg.candidate);
        }
        break;
      case 'answer':
        {
          const entry = peers.get(id);
          if (!entry) debug(`Unknown id: ${id} [${[...peers.keys()].join(',')}]`);
          else await entry.pc.setRemoteDescription(msg.desc);
        }
        break;
      default:
        debug(`Unknown event: ${msg.event}`);
    }
  })();
});

void initialize();

export default stream;
