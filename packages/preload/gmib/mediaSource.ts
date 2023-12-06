import { ipcRenderer } from 'electron';
import { delay } from '/@common/helpers';
import debounce from 'lodash/debounce';
import debugFactory from 'debug';

import { host, isRemoteSession, port } from '/@common/remote';
import type {
  AnswerMessage,
  CandidateMessage,
  OfferMessage,
  RequestMessage,
  RtcMessage,
  WithWebSocketKey,
} from '/@common/rtc';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:mediaSource`);

declare global {
  interface MediaTrackConstraints {
    mandatory: object;
  }
}

const getMediaSourceId = async (screenId: number, attempts = 3): Promise<string | undefined> => {
  const sourceId = await ipcRenderer.invoke('getMediaSourceId', screenId);
  if (!sourceId && attempts > 0) {
    await delay(1 / 10);
    return getMediaSourceId(screenId, attempts - 1);
  }
  return sourceId;
};

const createStream = async (sourceId?: string): Promise<MediaStream | undefined> => {
  if (sourceId)
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: 1280,
            maxWidth: 1280,
            minHeight: 720,
            maxHeight: 720,
          },
        },
      });
    } catch (err) {
      console.error('error while create stream', err);
    }
  return undefined;
};

const getVideo = (screenId: number): HTMLVideoElement | null =>
  document.querySelector(`video#screen-${screenId}`);

const playLocal = debounce(async (screenId: number): Promise<void> => {
  const sourceId = await getMediaSourceId(screenId);
  const stream = await createStream(sourceId);
  const video = getVideo(screenId);
  if (stream && video) {
    video.srcObject = stream;
    video.onloadedmetadata = () => video.play();
  }
}, 250);

export const close = (screenId: number) => {
  const video = getVideo(screenId);
  if (video && video.srcObject instanceof MediaStream) {
    const stream = video.srcObject;
    video.srcObject = null;
    stream.getTracks().forEach(track => {
      stream.removeTrack(track);
      track.stop();
    });
  }
};

let ws: WebSocket;

const openSocket = async (): Promise<void> => {
  if (!ws || ws.readyState === ws.CLOSED || ws.readyState === ws.CLOSING) {
    ws = new WebSocket(`ws://${host}:${port + 1}`);
    return openSocket();
  }
  if (ws.readyState === ws.OPEN) return undefined;
  return new Promise<void>((resolve, reject) => {
    const release = () => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      ws.removeEventListener('open', openHandler);
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      ws.removeEventListener('error', errorHandler);
    };
    const openHandler = () => {
      release();
      resolve();
    };
    const errorHandler = () => {
      release();
      reject();
    };
    ws.addEventListener('open', openHandler);
    ws.addEventListener('error', errorHandler);
  });
};

const playRemote = debounce(async (screenId: number) => {
  // console.log('PLAY REMOTE');
  if (!ws || ws.readyState === ws.CLOSED) ws = new WebSocket(`ws://${host}:${port + 1}`);
  let pc = new RTCPeerConnection();
  const request: RequestMessage = {
    event: 'request',
    sourceId: screenId,
    sourceType: 'screen',
  };

  const connect = async () => {
    // console.log('CONNECT');
    pc.onicecandidate = async e => {
      const { candidate } = e;
      if (!candidate) return;
      if (ws.readyState === ws.OPEN) {
        const msg: CandidateMessage = {
          event: 'candidate',
          candidate: candidate.toJSON(),
          sourceId: screenId,
          sourceType: 'screen',
        };
        ws.send(JSON.stringify(msg));
      }
    };

    pc.ontrack = e => {
      const video = getVideo(screenId);
      // console.log('VIDEO', video);
      if (video) {
        [video.srcObject] = e.streams;
        video.onloadedmetadata = () => video.play();
      }
      // deferred.resolve(e.streams[0]);
    };
    pc.onconnectionstatechange = () => {
      debug(`RTC connection: ${pc.connectionState}`);
      if (['disconnected', 'failed'].includes(pc.connectionState)) {
        debug('try reconnect');

        pc.close();
        pc = new RTCPeerConnection();
        setTimeout(connect, 3000);
      }
    };
    // console.log('WAIT CONNECT');
    await openSocket();
    // console.log('SEND REQUEST');
    ws.send(JSON.stringify(request));
  };

  ws.onmessage = async ev => {
    try {
      const msg = JSON.parse(ev.data.toString()) as RtcMessage;
      // console.log({ msg, screenId });
      switch (msg.event) {
        case 'candidate':
          if (msg.sourceId === screenId && 'candidate' in msg) {
            await pc.addIceCandidate(msg.candidate ?? undefined);
          }
          break;
        case 'offer':
          if (msg.sourceId === screenId) {
            await pc.setRemoteDescription(msg.desc);
            const answer: AnswerMessage = {
              event: 'answer',
              desc: await pc.createAnswer(),
              sourceId: screenId,
              sourceType: 'screen',
            };
            await pc.setLocalDescription(answer.desc);
            // console.log('ANSWER');
            ws.send(JSON.stringify(answer));
          }
          break;
        default:
          // console.warn(`Unknown msg: ${msg}`);
          break;
      }
    } catch (e) {
      debug(`error while parse websocket message: ${(e as Error).message}`);
    }
  };
  connect();
}, 500);

if (!isRemoteSession) {
  const peers = new Map<string, RTCPeerConnection>();
  // console.log('LISTEN SOCKET');
  ipcRenderer.on('socket', async (_, { id, ...msg }: WithWebSocketKey<RtcMessage>) => {
    // console.log({ socket: msg });
    // if (msg.sourceId !== sourceId) return;
    const stream = await createStream(await getMediaSourceId(msg.sourceId));
    if (!stream) return;
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
              sourceId: msg.sourceId,
              sourceType: 'screen',
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
            sourceId: msg.sourceId,
            sourceType: 'screen',
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
}

export const play = isRemoteSession ? playRemote : playLocal;
