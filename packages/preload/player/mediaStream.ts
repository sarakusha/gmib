import { type MergeableStream, mergeStreams } from '@sarakusha/ebml';

import { ipcRenderer } from 'electron';

// import debugFactory from 'debug';

import VideoSource from './VideoSource';

import type { MediaInfo } from '/@common/mediaInfo';
import type { Playlist } from '/@common/playlist';

import ipcDispatch from '../common/ipcDispatch';

import { setCurrentPlaylistItem, setDuration } from '/@player/store/currentSlice';
import type { Player } from '/@common/video';
import type { CandidateMessage, RtcMessage, WithWebSocketKey } from '/@common/rtc';

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
// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:mediastream`);

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

/* let pc1: RTCPeerConnection;
let pc2: RTCPeerConnection;

const supportsInsertableStreams = window.RTCRtpSender && 'transform' in RTCRtpSender.prototype;
console.log({ supportsInsertableStreams });

const test = async (selector: string) => {
  console.log(new Date().toLocaleTimeString(), 'START');
  pc1 = new RTCPeerConnection();
  pc2 = new RTCPeerConnection();
  pc1.onicecandidate = e => {
    // setTimeout(() => {
    console.log(new Date().toLocaleTimeString(), 'onicecandidate1', JSON.stringify(e.candidate));
    pc2.addIceCandidate(e.candidate ?? undefined).then(
      () => console.log(2, 'Ok'),
      err => console.error(2, err),
    );
    // }, 5000);
  };
  pc2.onicecandidate = e => {
    console.log(new Date().toLocaleTimeString(), 'onicecandidate2', JSON.stringify(e.candidate));
    pc1.addIceCandidate(e.candidate ?? undefined).then(
      () => console.log(1, 'Ok'),
      err => console.error(1, err),
    );
    // else test(selector);
  };
  stream.getTracks().forEach(track => {
    // track.applyConstraints({ frameRate: { max: 1 }});
    const sender = pc1.addTrack(track, stream);
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
  pc2.ontrack = e => {
    console.log('ON TRACK');
    const video = document.querySelector(selector) as HTMLVideoElement;
    if (video) {
      // eslint-disable-next-line prefer-destructuring
      video.srcObject = e.streams[0];
      console.log('STREAM', e.streams);
      console.log('transivers1', pc1.getTransceivers());
      const [sender] = pc1.getSenders();
      // console.log('senders', sender, sender.getParameters(), sender.getStats());
      console.log('receivers', pc2.getReceivers()[0]);
      console.log('config1', pc1.getConfiguration());
    }
  };
  console.log(new Date().toLocaleTimeString(), 'Creating offer...');
  const offer = await pc1.createOffer({ offerToReceiveVideo: true });
  console.log(new Date().toLocaleTimeString(), 'Created!');
  pc1.setLocalDescription(offer);
  pc2.setRemoteDescription(offer);
  console.log(new Date().toLocaleTimeString(), 'Creating answer...');
  const answer = await pc2.createAnswer();
  console.log(new Date().toLocaleTimeString(), 'Created');
  pc2.setLocalDescription(answer);
  pc1.setRemoteDescription(answer);
};
let timer = 0;
 */
// eslint-disable-next-line import/prefer-default-export
export const updateSrcObject = (selector: string) => {
  const video = document.querySelector(selector) as HTMLVideoElement;
  if (video) video.srcObject = stream;
  // window.clearTimeout(timer);
  // timer = window.setTimeout(() => test(selector), 500);
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

// ipcRenderer.on('playlist', (_, id: number) => {});

const peers = new Map<string, RTCPeerConnection>();

ipcRenderer.on('socket', (_, { id, ...msg }: WithWebSocketKey<RtcMessage>) => {
  if (msg.sourceId !== sourceId) return;
  switch (msg.event) {
    case 'candidate':
      {
        const pc = peers.get(id);
        if (!pc) console.warn(`Unknown id: ${id}`);
        else {
          pc.addIceCandidate(msg.candidate ?? undefined);
        }
      }
      break;
    case 'offer':
      {
        const pc = new RTCPeerConnection();
        pc.onicecandidate = e => {
          const candidate: WithWebSocketKey<CandidateMessage> = {
            id,
            event: 'candidate',
            candidate: e.candidate,
            sourceId,
          };
          ipcRenderer.invoke('socket', candidate);
        };
        peers.set(id, pc);
        stream.getTracks().forEach(track => {
          // track.applyConstraints({ frameRate: { max: 1 }});
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
        pc.onnegotiationneeded = () => {
          peers.delete(id);
        };
      }
      break;
    default:
      console.warn(`Unknown event: ${msg.event}`);
  }
});

export default stream;
