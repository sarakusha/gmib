import { type MergeableStream, mergeStreams } from '@sarakusha/ebml';

import { ipcRenderer } from 'electron';

import debugFactory from 'debug';

import type { MediaInfo } from '/@common/mediaInfo';
import type { Playlist } from '/@common/playlist';
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

let playlist: Playlist | undefined;
let player: Player;
let playbackState: MediaSessionPlaybackState = 'none';
let activeEngine: Player['playbackEngine'] | undefined;
let currentItemId: string | undefined;
let currentUri: string | undefined;
let sourceVideo: HTMLVideoElement | undefined;
let capturedStream: MediaStream | undefined;
let captureGeneration = 0;
const consumers = new Set<HTMLVideoElement>();

const search = new URLSearchParams(window.location.search);
const sourceId = +(search.get('source_id') ?? 1);

const stream = new MediaStream();
const streamReady = new Deferred<void>();
const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:mediastream`);

const getMediaUri = (name?: string) =>
  name && new URL(getUrl(`/public/${name}`), window.location.href).href;

const getPlaybackEngine = (): NonNullable<Player['playbackEngine']> =>
  player.playbackEngine ?? 'decoder';

const updatePlaybackState = (next: MediaSessionPlaybackState): void => {
  if (playbackState === next) return;
  playbackState = next;
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
  debug(`create hidden source video: ${uri}`);
  const video = document.createElement('video');
  video.autoplay = false;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.style.cssText =
    'position:absolute;left:-1px;top:-1px;width:1px;height:1px;opacity:0;pointer-events:none;';
  video.addEventListener('loadedmetadata', () => {
    debug(
      `source metadata loaded: duration=${Number.isFinite(video.duration) ? video.duration : '<unknown>'}`,
    );
    refreshStreamTracks();
    ipcDispatch(setDuration(Number.isFinite(video.duration) ? video.duration : undefined));
  });
  video.addEventListener('durationchange', () => {
    ipcDispatch(setDuration(Number.isFinite(video.duration) ? video.duration : undefined));
  });
  video.addEventListener('timeupdate', () => {
    // debug(`source time update: ${video.currentTime}s`);
    ipcDispatch(setPosition(video.currentTime));
  });
  video.addEventListener('ended', () => {
    playNextItem();
  });
  video.addEventListener('error', () => {
    const message = video.error?.message || `media error code ${video.error?.code ?? 'unknown'}`;
    debug(`source video error: ${message}`);
  });

  (document.body ?? document.documentElement).append(video);
  sourceVideo = video;
  video.src = uri;
  video.load();

  capturedStream = getCaptureStream(video);
  captureGeneration += 1;
  const generation = captureGeneration;
  const captured = capturedStream;
  debug(`create capture stream #${generation}: ${captured.id}`);
  captured.addEventListener('addtrack', event => {
    debug(`capture stream #${generation} add ${event.track.kind} track: ${event.track.id}`);
    if (capturedStream === captured) refreshStreamTracks();
  });
  captured.addEventListener('removetrack', event => {
    debug(`capture stream #${generation} remove ${event.track.kind} track: ${event.track.id}`);
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
      debug(`pause stream consumer: ${video.id ?? '<unknown>'}`);
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
      debug(`remove ${track.kind} track from shared stream: ${track.id}`);
      stream.removeTrack(track);
      changed = true;
    }
  });
  nextTracks.forEach(track => {
    // eslint-disable-next-line no-param-reassign
    track.enabled = shouldEnableTrack(track);
    if (!stream.getTracks().includes(track)) {
      debug(`add ${track.kind} track to shared stream: ${track.id}`);
      stream.addTrack(track);
      changed = true;
    }
  });
  if (changed) {
    debug(
      `shared stream tracks: ${stream
        .getTracks()
        .map(track => `${track.kind}:${track.id}:${track.enabled ? 'enabled' : 'disabled'}`)
        .join(', ')}`,
    );
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

const disposeSource = (reason: string): void => {
  const video = sourceVideo;
  const captured = capturedStream;
  if (!video && !captured) return;
  debug(`dispose source: ${reason}`);
  video?.pause();
  sourceVideo = undefined;
  capturedStream = undefined;
  replaceStreamTracks(new MediaStream());
  captured?.getTracks().forEach(track => {
    debug(`stop captured ${track.kind} track: ${track.id}`);
    track.stop();
  });
  if (video) {
    video.removeAttribute('src');
    video.load();
    video.remove();
  }
};

const clearSource = (): void => {
  debug('clear source');
  currentItemId = undefined;
  currentUri = undefined;
  disposeSource('clear source');
  ipcDispatch(setDuration(0));
  ipcDispatch(setPosition(0));
};

const playSource = async (): Promise<void> => {
  const video = sourceVideo;
  if (!video) return;
  try {
    debug(`play source: ${currentUri ?? '<empty>'}`);
    await video.play();
    syncConsumerPlayback();
  } catch (err) {
    debug(`error while starting source video: ${(err as Error).message}`);
  }
};

const loadSource = async (uri: string, itemId?: string, mediaId?: string): Promise<void> => {
  debug(`load source: ${uri}`);
  disposeSource('replace source');
  currentUri = uri;
  currentItemId = itemId;
  createSourceVideo(uri);

  refreshStreamTracks();
  ipcDispatch(setCurrentPlaylistItem(itemId ? { itemId, mediaId } : undefined));

  if (playbackState === 'playing') await playSource();
};

const playNextItem = (): void => {
  if (!playlist?.items.length) return;
  const currentIndex = playlist.items.findIndex(item => item.id === currentItemId);
  const nextIndex = ((currentIndex === -1 ? 0 : currentIndex) + 1) % playlist.items.length;
  const nextItem = playlist.items[nextIndex];
  ipcDispatch(setCurrentPlaylistItem({ itemId: nextItem.id, mediaId: nextItem.md5 }));
};

let currentSource: VideoSource | undefined;
let nextSource: VideoSource | undefined;
let videoStream: MergeableStream<VideoFrame> | undefined;
let prevDecoderEnabled: boolean | undefined;
let decoderPosition = 0;
let decoderDuration = 0;

const DECODER_RECOVERY_SEEK_STEP = 2;
const DECODER_MAX_RECOVERY_ATTEMPTS = 5;
const SEEK_END_GUARD = 0.1;
const decoderRecoveryAttempts = new Map<string, number>();

type DecoderSourceMessage = {
  duration?: number;
  seekStartTime?: number;
  timer?: number;
  recoverableError?: {
    message?: string;
  };
};

const getDecoderRecoveryKey = (source: VideoSource): string =>
  source.options.itemId ?? source.options.mediaId ?? source.uri;

const getDecoderSourcePosition = (source: VideoSource, timer = 0): number =>
  (source.options.startTime ?? 0) + timer;

const clampSeekPosition = (position: number, duration?: number): number => {
  const nextPosition = Math.max(0, position);
  if (!duration || !Number.isFinite(duration)) return nextPosition;
  return Math.min(nextPosition, Math.max(0, duration - SEEK_END_GUARD));
};

const getActiveDuration = (): number =>
  activeEngine === 'decoder'
    ? decoderDuration || currentSource?.duration || nextSource?.duration || 0
    : Number.isFinite(sourceVideo?.duration)
      ? (sourceVideo?.duration ?? 0)
      : 0;

const disposeDecoder = (): void => {
  debug('dispose decoder engine');
  currentSource?.close();
  currentSource = undefined;
  nextSource?.close();
  nextSource = undefined;
  videoStream = undefined;
  prevDecoderEnabled = undefined;
  decoderPosition = 0;
  decoderDuration = 0;
  decoderRecoveryAttempts.clear();
  blankConsumers();
  replaceStreamTracks(new MediaStream());
};

const recoverDecoderSource = (source: VideoSource, reason?: string): void => {
  if (source !== currentSource || !videoStream || source.closed) return;
  const key = getDecoderRecoveryKey(source);
  const attempts = (decoderRecoveryAttempts.get(key) ?? 0) + 1;
  decoderRecoveryAttempts.set(key, attempts);
  if (attempts > DECODER_MAX_RECOVERY_ATTEMPTS) {
    debug(
      `decoder recovery limit reached, ending source: item=${source.options.itemId ?? '<none>'} media=${source.options.mediaId ?? '<none>'} reason=${reason ?? 'unknown error'}`,
    );
    return;
  }

  const duration = source.duration || undefined;
  const recoveryPosition = Math.min(
    duration ? Math.max(0, duration - 0.1) : Number.POSITIVE_INFINITY,
    Math.max(decoderPosition, source.options.startTime ?? 0) + DECODER_RECOVERY_SEEK_STEP,
  );
  if (!Number.isFinite(recoveryPosition)) return;
  debug(
    `recover decoder source after error, seeking to ${recoveryPosition}s (attempt ${attempts}/${DECODER_MAX_RECOVERY_ATTEMPTS}): item=${source.options.itemId ?? '<none>'} media=${source.options.mediaId ?? '<none>'} reason=${reason ?? 'unknown error'}`,
  );
  seekDecoderSource(recoveryPosition, 'recover');
};

const handleDecoderSourceMessage = (source: VideoSource, data: DecoderSourceMessage): void => {
  if (typeof data.duration === 'number' && source === currentSource) {
    decoderDuration = data.duration;
    ipcDispatch(setDuration(data.duration));
  }
  if (typeof data.seekStartTime === 'number') {
    // eslint-disable-next-line no-param-reassign
    source.options.startTime = data.seekStartTime;
    debug(
      `decoder source seek start time: ${data.seekStartTime}s: media=${source.options.mediaId ?? '<none>'}, current: ${source === currentSource ? 'yes' : 'no'}`,
    );
    if (source === currentSource) {
      decoderPosition = data.seekStartTime;
      ipcDispatch(setPosition(decoderPosition));
    }
  }
  if (typeof data.timer === 'number' && source === currentSource) {
    decoderPosition = getDecoderSourcePosition(source, data.timer);
    debug(
      `decoder source timer: ${data.timer}s, position: ${decoderPosition}s: media=${source.options.mediaId ?? '<none>'}`,
    );
    ipcDispatch(
      setPosition(source.duration ? Math.min(source.duration, decoderPosition) : decoderPosition),
    );
  }
  if (data.recoverableError && source === currentSource) {
    recoverDecoderSource(source, data.recoverableError.message);
  }
};

const playNextDecoderSource = () => {
  const source = nextSource;
  if (source && videoStream) {
    const same = currentSource?.options.mediaId === source.options.mediaId;
    if (same && !source.options.fade?.disableIn) {
      source.setDisableFadeIn();
    }

    const { itemId, mediaId } = source.options;
    if (playbackState === 'playing') source.play();
    currentSource = source;
    nextSource = undefined;
    decoderPosition = source.options.startTime ?? 0;
    decoderDuration = source.duration || decoderDuration;
    ipcDispatch(setPosition(decoderPosition));
    ipcDispatch(setDuration(decoderDuration));
    void videoStream
      .add(source.readable)
      .then(playNextDecoderSource)
      .catch(err => {
        debug(`error while adding next decoder source: ${(err as Error).message}`);
      });
    if (player.current !== itemId) {
      ipcDispatch(setCurrentPlaylistItem(itemId ? { itemId, mediaId } : undefined));
    } else {
      void update();
    }
  }
};

const seekDecoderSource = (position: number, reason: 'user' | 'recover' = 'user'): void => {
  const source = currentSource;
  if (!source || !videoStream || source.closed) return;
  const { itemId, mediaId } = source.options;
  const nextPosition = clampSeekPosition(position, source.duration || decoderDuration);
  if (reason === 'user') decoderRecoveryAttempts.delete(getDecoderRecoveryKey(source));
  debug(
    `seek decoder source to ${nextPosition}s (${reason}): item=${itemId ?? '<none>'} media=${mediaId ?? '<none>'}`,
  );
  nextSource?.close();
  const recoverySource = new VideoSource(source.uri, {
    itemId,
    autoplay: playbackState === 'playing',
    startTime: nextPosition,
    fade: {
      disableIn: true,
      disableOut: true,
      duration: 0,
    },
    mediaId,
    onMessage: ({ data }: { data: unknown }) => {
      if (data && typeof data === 'object') {
        handleDecoderSourceMessage(recoverySource, data);
      }
    },
  });
  nextSource = recoverySource;
  source.close();
  debug(
    `seek decoder source: closed previous source, added recovery source: position=${nextPosition}s item=${itemId ?? '<none>'} media=${mediaId ?? '<none>'}`,
  );
  decoderPosition = nextPosition;
  ipcDispatch(setPosition(nextPosition));
};

const initializeDecoderStream = (): void => {
  if (videoStream) return;
  debug('initialize decoder engine');
  replaceStreamTracks(new MediaStream());
  videoStream = mergeStreams<VideoFrame>();
  const trackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
  void videoStream.pipeTo(trackGenerator.writable).catch(err => {
    debug(`error while piping decoder video stream to track: ${(err as Error).message}`);
  });
  stream.addTrack(trackGenerator);
  replacePeerTracks();
};

const updateDecoder = async (): Promise<void> => {
  initializeDecoderStream();
  const enabled = Boolean(playlist && playlist.items.length > 0 && playbackState !== 'none');
  const delay = 0;
  const { current } = player;
  if (!enabled && playbackState === 'none') {
    disposeDecoder();
    return;
  }
  if (prevDecoderEnabled !== enabled) {
    prevDecoderEnabled = enabled;
    stream.getTracks().forEach(track => {
      // eslint-disable-next-line no-param-reassign
      track.enabled = enabled;
    });
    syncConsumerPlayback();
    enabled ||
      setTimeout(() => {
        if (currentSource?.hasStarted) {
          nextSource?.close();
          nextSource = undefined;
          currentSource.close();
          currentSource = undefined;
        }
      }, 100);
  }
  if (!playlist || playlist.items.length === 0) {
    currentSource?.close();
    currentSource = undefined;
    nextSource?.close();
    nextSource = undefined;
    return;
  }

  const currentItem = playlist.items.find(item => item.id === current) ?? playlist.items[0];
  const media: MediaInfo = await ipcRenderer.invoke('getMedia', currentItem.md5);

  const nextIndex =
    (playlist.items.findIndex(item => item.id === current) + 1) % playlist.items.length;
  const nextItem = playlist.items[nextIndex];
  const nextMedia: MediaInfo = await ipcRenderer.invoke('getMedia', nextItem.md5);

  const same = currentItem.md5 === nextItem.md5;

  if (!nextSource || nextSource.closed || nextSource.options.itemId !== nextItem.id) {
    if (nextSource && !nextSource.hasStarted) nextSource.close();
    const uri = getMediaUri(nextMedia?.filename);
    if (uri) {
      const preloadedSource = new VideoSource(uri, {
        itemId: nextItem.id,
        delay,
        fade: {
          disableIn: same || player.disableFadeIn,
          disableOut: player.disableFadeOut,
          duration: 500,
        },
        mediaId: nextItem.md5,
        onMessage: ({ data }: { data: unknown }) => {
          if (data && typeof data === 'object') {
            handleDecoderSourceMessage(preloadedSource, data);
          }
        },
      });
      nextSource = preloadedSource;
    }
  }
  if (!currentSource?.closed && current !== currentSource?.options.itemId) {
    if (nextSource && nextSource.options.itemId === current && playlist.items.length > 1) {
      currentSource?.close();
      return;
    }

    const uri = getMediaUri(media?.filename);
    if (uri && videoStream) {
      const videoSource = new VideoSource(uri, {
        itemId: current,
        autoplay: playbackState === 'playing',
        fade: {
          disableIn: player.disableFadeIn,
          disableOut: same || player.disableFadeOut,
          duration: 500,
        },
        mediaId: currentItem.md5,
        onMessage: ({ data }: { data: unknown }) => {
          if (data && typeof data === 'object') {
            handleDecoderSourceMessage(videoSource, data);
          }
        },
      });
      if (currentSource && !currentSource.closed) {
        nextSource = videoSource;
        currentSource.close();
      } else {
        currentSource = videoSource;
        void videoStream
          .add(videoSource.readable)
          .then(playNextDecoderSource)
          .catch(err => {
            debug(`error while adding decoder source: ${(err as Error).message}`);
          });
      }
    }
  }
  if (currentSource && (playbackState !== 'playing') !== currentSource.paused) {
    if (playbackState === 'playing') currentSource.play();
    else currentSource.pause();
  }
  syncConsumerPlayback();
  currentSource?.setDisableFadeOut(player.disableFadeOut || same);
};

const updateCapture = async (): Promise<void> => {
  const enabled = Boolean(playlist && playlist.items.length > 0 && playbackState !== 'none');
  syncTrackEnabled();

  if (!enabled) {
    pauseSource();
    blankConsumers();
    if (!playlist || playlist.items.length === 0) clearSource();
    return;
  }

  const currentPlaylist = playlist;
  if (!currentPlaylist) return;

  const currentItem =
    currentPlaylist.items.find(item => item.id === player.current) ?? currentPlaylist.items[0];
  const media: MediaInfo = await ipcRenderer.invoke('getMedia', currentItem.md5);
  const uri = getMediaUri(media?.filename);

  if (!uri) {
    clearSource();
    return;
  }

  if (uri !== currentUri || currentItem.id !== currentItemId) {
    await loadSource(uri, currentItem.id, currentItem.md5);
  } else if (playbackState === 'playing' && sourceVideo?.paused) {
    await playSource();
  } else if (playbackState !== 'playing') {
    pauseSource();
  }
};

const switchEngine = (engine: NonNullable<Player['playbackEngine']>): void => {
  if (activeEngine === engine) return;
  debug(`switch playback engine: ${activeEngine ?? '<none>'} -> ${engine}`);
  if (activeEngine === 'capture') disposeSource('switch engine');
  if (activeEngine === 'decoder') disposeDecoder();
  replaceStreamTracks(new MediaStream());
  activeEngine = engine;
  if (engine === 'decoder') initializeDecoderStream();
};

const update = async (): Promise<void> => {
  const engine = getPlaybackEngine();
  switchEngine(engine);
  if (engine === 'capture') await updateCapture();
  else await updateDecoder();
};

export const attachStreamToVideo = (video: HTMLVideoElement): void => {
  if (video) {
    debug(`attach shared stream to ${video.tagName.toLowerCase()}#${video.id || '<no-id>'}`);
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
  const nextPosition = Math.max(0, position);
  if (activeEngine === 'capture') {
    if (!sourceVideo) return;
    const capturePosition = clampSeekPosition(nextPosition, sourceVideo.duration);
    debug(`seek capture source to ${capturePosition}s: ${currentUri ?? '<empty>'}`);
    sourceVideo.currentTime = capturePosition;
    ipcDispatch(setPosition(sourceVideo.currentTime));
    return;
  }
  if (activeEngine === 'decoder') seekDecoderSource(nextPosition);
};

const initialize = async () => {
  streamReady.resolve();
  player = await ipcRenderer.invoke('getPlayer', sourceId);
  if (player?.playlistId) {
    playlist = await ipcRenderer.invoke('getPlaylist', player.playlistId);
    if (player.autoPlay) updatePlaybackState('playing');
  }
  void update();
};

ipcRenderer.on('player', (_, value: Player) => {
  void (async () => {
    player = value;
    playlist = player.playlistId
      ? await ipcRenderer.invoke('getPlaylist', player.playlistId)
      : undefined;
    const state: 'paused' | 'none' = playlist?.items.length ? 'paused' : 'none';
    if (player.autoPlay !== (playbackState === 'playing')) {
      updatePlaybackState(player.autoPlay ? 'playing' : state);
    }
    void update();
  })();
});

ipcRenderer.on('updatePlaylist', (_, updatedPlaylist) => {
  playlist = updatedPlaylist;
  void update();
});

ipcRenderer.on('stop', () => {
  const duration = getActiveDuration();
  if (sourceVideo) {
    sourceVideo.pause();
    sourceVideo.currentTime = 0;
  }
  decoderPosition = 0;
  updatePlaybackState('none');
  void update();
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

const replacePeerTracks = (): void => {
  peers.forEach(({ senders }) => {
    senders.forEach((sender, kind) => {
      const track = stream.getTracks().find(candidate => candidate.kind === kind) ?? null;
      debug(`replace ${kind} peer track: ${track?.id ?? '<none>'}`);
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
      // params.encodings[0].maxBitrate = 128000;
      // params.encodings[0].maxFramerate = 1;
      void sender.setParameters(params);
    }
  };
  updateParams();
  return sender;
};

ipcRenderer.on('socket', (_, { id, ...msg }: WithWebSocketKey<RtcMessage>) => {
  void (async () => {
    if (msg.event === 'outputVisibility') return;
    if (msg.sourceId !== sourceId) return;
    switch (msg.event) {
      case 'request':
        try {
          const pc = new RTCPeerConnection();
          const entry: PeerEntry = { pc, senders: new Map() };
          peers.set(id, entry);
          debug(`create peer: ${id}`);

          pc.onconnectionstatechange = () => {
            debug(`peer ${id} connection state: ${pc.connectionState}`);
            if (['closed', 'failed'].includes(pc.connectionState)) {
              peers.delete(id);
              debug(`delete peer: ${id}`);
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
