import { type MergeableStream, mergeStreams } from '@sarakusha/ebml';

import { ipcRenderer } from 'electron';

import debugFactory from 'debug';

import VideoSource from './VideoSource';

import type { MediaInfo } from '/@common/mediaInfo';
import type { Playlist } from '/@common/playlist';

import ipcDispatch from '../common/ipcDispatch';

import { setCurrentPlaylistItem, setDuration } from '/@player/store/currentSlice';
import type { Player } from '/@common/video';
import type { CandidateMessage, OfferMessage, RtcMessage, WithWebSocketKey } from '/@common/rtc';

let currentSource: VideoSource | undefined;
let nextSource: VideoSource | undefined;
let videoStream: MergeableStream<VideoFrame>;
let playlist: Playlist | undefined;
let prevEnabled: boolean | undefined;
let player: Player;
let playbackState: MediaSessionPlaybackState = 'none';

const search = new URLSearchParams(window.location.search);
const sourceId = +(search.get('source_id') ?? 1);

const stream = new MediaStream();
const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:mediastream`);

const getMediaUri = (name?: string) =>
  name && new URL(`/public/${name}`, new URL(import.meta.url).origin).href;

const playNextSource = () => {
  const source = nextSource;
  if (source) {
    const { index = 0 } = source.options;
    source.play();
    currentSource = source;
    nextSource = undefined;
    ipcDispatch(setDuration(source.duration));
    videoStream.add(source.readable).then(playNextSource);
    if (player.current !== index) {
      ipcDispatch(setCurrentPlaylistItem(index));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      update();
    }
  }
};

const update = async () => {
  const enabled = Boolean(playlist && playlist.items.length > 0 && playbackState !== 'none');
  let delay = 0;
  let { current } = player;
  if (prevEnabled !== enabled) {
    prevEnabled = enabled;
    stream.getTracks().forEach(track => {
      // eslint-disable-next-line no-param-reassign
      track.enabled = enabled;
    });
    enabled ||
      setTimeout(() => {
        if (currentSource?.hasStarted) {
          nextSource?.close();
          nextSource = undefined;
          currentSource.close();
          currentSource = undefined;
        }
      }, 10); // Need a delay to render a black screen
  }
  if (!playlist || playlist.items.length === 0) {
    currentSource?.close();
    currentSource = undefined;
    nextSource?.close();
    nextSource = undefined;
    return;
  }
  if (!currentSource?.closed && current !== currentSource?.options.index) {
    if (nextSource && nextSource.options.index === current) {
      currentSource?.close();
    } else {
      nextSource?.close();
      nextSource = undefined;
      if (current >= playlist.items.length) current = 0;
      const currentItem = playlist.items[current];
      const media: MediaInfo = await ipcRenderer.invoke('getMedia', currentItem.md5);
      const uri = getMediaUri(media?.filename);
      if (uri) {
        const videoSource = new VideoSource(uri, {
          index: current,
          autoplay: playbackState === 'playing',
          fade: { disableIn: player.disableFadeIn, disableOut: player.disableFadeOut },
          onMessage: ({ data }) => {
            if (typeof data === 'object' && 'duration' in data) {
              ipcDispatch(setDuration(data.duration));
            }
          },
        });
        if (currentSource && !currentSource.closed) {
          nextSource = videoSource;
          currentSource.close();
        } else {
          currentSource = videoSource;
          videoStream.add(videoSource.readable).then(playNextSource);
          delay = 1000;
        }
      }
    }
  }
  if (!nextSource || nextSource.closed) {
    let nextIndex = current + 1;
    if (nextIndex >= playlist.items.length) nextIndex = 0;
    nextSource?.close();
    const nextItem = playlist.items[nextIndex];
    const media: MediaInfo = await ipcRenderer.invoke('getMedia', nextItem.md5);
    const uri = getMediaUri(media?.filename);
    if (uri) {
      nextSource = new VideoSource(uri, {
        index: nextIndex,
        delay,
        fade: { disableIn: player.disableFadeIn, disableOut: player.disableFadeOut },
        // onMessage: messageHandler,
      });
    }
  }
  if (currentSource && (playbackState !== 'playing') !== currentSource.paused) {
    if (playbackState === 'playing') currentSource.play();
    else currentSource.pause();
  }
};

export const updateSrcObject = (selector: string) => {
  const video = document.querySelector(selector) as HTMLVideoElement;
  if (video) video.srcObject = stream;
};

const initialize = async () => {
  if (currentSource) {
    currentSource.close();
    currentSource = undefined;
  }
  if (nextSource) {
    nextSource.close();
    nextSource = undefined;
  }
  stream.getTracks().forEach(track => {
    stream.removeTrack(track);
    track.stop();
  });
  videoStream = mergeStreams<VideoFrame>();
  const trackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
  videoStream.pipeTo(trackGenerator.writable);
  stream.addTrack(trackGenerator);
  player = await ipcRenderer.invoke('getPlayer', sourceId);
  if (player?.playlistId) {
    playlist = await ipcRenderer.invoke('getPlaylist', player.playlistId);
    if (player.autoPlay) playbackState = 'playing';
  }
  update();
};

initialize();

ipcRenderer.on('player', async (_, value: Player) => {
  player = value;
  playlist = player.playlistId
    ? await ipcRenderer.invoke('getPlaylist', player.playlistId)
    : undefined;
  const state: 'paused' | 'none' = playlist?.items.length ? 'paused' : 'none';
  if (player.autoPlay !== (playbackState === 'playing')) {
    playbackState = player.autoPlay ? 'playing' : state;
  }
  update();
});

ipcRenderer.on('stop', () => {
  if (playbackState !== 'none') {
    playbackState = 'none';
    update();
  }
  const { duration = 0 } = currentSource ?? {};
  ipcDispatch(setDuration(duration));
});

const peers = new Map<string, RTCPeerConnection>();

ipcRenderer.on('socket', async (_, { id, ...msg }: WithWebSocketKey<RtcMessage>) => {
  if (msg.sourceId !== sourceId) return;
  switch (msg.event) {
    case 'request':
      try {
        const pc = new RTCPeerConnection();
        peers.set(id, pc);

        pc.onconnectionstatechange = () => {
          if (['closed', 'failed'].includes(pc.connectionState)) peers.delete(id);
        };

        pc.onicecandidate = e => {
          const { candidate } = e;
          if (!candidate) return;
          const candidateMsg: WithWebSocketKey<CandidateMessage> = {
            id,
            event: 'candidate',
            candidate: candidate.toJSON(),
            sourceId,
          };
          ipcRenderer.invoke('socket', candidateMsg);
        };
        
        stream.getTracks().forEach(track => {
          const sender = pc.addTrack(track, stream);
          const updateParams = () => {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) setTimeout(updateParams, 10);
            else {
              // params.encodings[0].scaleResolutionDownBy = 10;
              params.encodings[0].maxBitrate = 128000;
              sender.setParameters(params);
            }
          };
          updateParams();
        });
        
        const offer = await pc.createOffer();
        const offerMsg: WithWebSocketKey<OfferMessage> = {
          id,
          event: 'offer',
          desc: JSON.parse(JSON.stringify(offer)),
          sourceId,
        };
        await pc.setLocalDescription(offer);
        await ipcRenderer.invoke('socket', offerMsg);
      } catch (e) {
        debug(`error while create offer: ${(e as Error).message}`);
      }
      break;
    case 'candidate':
      {
        const pc = peers.get(id);
        if (!pc) debug(`Unknown id: ${id} [${[...peers.keys()].join(',')}]`);
        else if (msg.candidate) await pc.addIceCandidate(msg.candidate);
      }
      break;
    case 'answer':
      {
        const pc = peers.get(id);
        if (!pc) debug(`Unknown id: ${id} [${[...peers.keys()].join(',')}]`);
        else await pc.setRemoteDescription(msg.desc);
      }
      break;
    default:
      debug(`Unknown event: ${msg.event}`);
  }
});

export default stream;
