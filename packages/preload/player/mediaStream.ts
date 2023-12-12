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
    const same = currentSource?.options.mediaId === source.options.mediaId;
    if (same && !source.options.fade?.disableIn) {
      source.options.fade = { disableIn: true, ...source.options.fade };
    }

    const { itemId } = source.options;
    source.play();
    currentSource = source;
    nextSource = undefined;
    ipcDispatch(setDuration(source.duration));
    videoStream.add(source.readable).then(playNextSource);
    if (player.current !== itemId) {
      ipcDispatch(setCurrentPlaylistItem(itemId));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      update();
    }
  }
};

const update = async () => {
  const enabled = Boolean(playlist && playlist.items.length > 0 && playbackState !== 'none');
  let delay = 0;
  const { current } = player;
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
      }, 100); // Need a delay to render a black screen
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
      nextSource = new VideoSource(uri, {
        itemId: nextItem.id,
        delay,
        fade: {
          disableIn: same || player.disableFadeIn,
          disableOut: player.disableFadeOut,
          duration: 500,
        },
        mediaId: nextItem.md5,
      });
    }
  }
  // if (same && nextSource && !nextSource.options.fade?.disableIn) {
  //   nextSource.options.fade = {...nextSource.options.fade,  disableIn: true };
  // }
  if (!currentSource?.closed && current !== currentSource?.options.itemId) {
    if (nextSource && nextSource.options.itemId === current) {
      currentSource?.close();
      return;
    }
    // if (nextSource && !nextSource.hasStarted) nextSource.close();
    // nextSource = undefined;

    const uri = getMediaUri(media?.filename);
    if (uri) {
      const videoSource = new VideoSource(uri, {
        itemId: current,
        autoplay: playbackState === 'playing',
        fade: {
          disableIn: player.disableFadeIn,
          disableOut: same || player.disableFadeOut,
          duration: 500,
        },
        mediaId: currentItem.md5,
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
        // videoSource.options.fade?.disableOut = true;
        videoStream.add(videoSource.readable).then(playNextSource);
        delay = 1000;
      }
    }
  }
  if (currentSource && (playbackState !== 'playing') !== currentSource.paused) {
    if (playbackState === 'playing') currentSource.play();
    else currentSource.pause();
  }
  currentSource?.setDisableFadeOut(player.disableFadeOut || same);
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

ipcRenderer.on('updatePlaylist', (_, updatedPlaylist) => {
  playlist = updatedPlaylist;
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
            sourceType: 'player',
          };
          ipcRenderer.invoke('socket', candidateMsg);
        };
        stream.getVideoTracks().forEach(track => {
          const sender = pc.addTrack(track, stream);
          const updateParams = () => {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) setTimeout(updateParams, 10);
            else {
              // params.encodings[0].maxBitrate = 128000;
              // params.encodings[0].maxFramerate = 1;
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
