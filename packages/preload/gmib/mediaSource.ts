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
import { setOutputHidden } from '/@renderer/store/currentSlice';

import ipcDispatch from '../common/ipcDispatch';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:mediaSource`);

declare global {
  interface MediaTrackConstraints {
    mandatory: object;
  }
}

const getMediaSourceId = async (screenId: number, attempts = 3): Promise<string | undefined> => {
  const sourceId = (await ipcRenderer.invoke('getMediaSourceId', screenId)) as string | undefined;
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
          // Capture the whole window at its source aspect ratio. Fixed min/max dimensions
          // force Chromium to letterbox narrow outputs into an unrelated frame size.
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
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

const activeScreens = new Set<number>();

const playLocal = debounce(async (screenId: number): Promise<void> => {
  if (!activeScreens.has(screenId)) return;
  const sourceId = await getMediaSourceId(screenId);
  const stream = await createStream(sourceId);
  const video = getVideo(screenId);
  if (stream && video && activeScreens.has(screenId)) {
    video.srcObject = stream;
    video.onloadedmetadata = () => video.play();
  } else {
    stream?.getTracks().forEach(track => track.stop());
  }
}, 250);

const stopPreview = (screenId: number): void => {
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

export const close = (screenId: number): void => {
  activeScreens.delete(screenId);
  stopPreview(screenId);
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
      ws.removeEventListener('open', openHandler);

      ws.removeEventListener('error', errorHandler);
    };
    const openHandler = () => {
      release();
      resolve();
    };
    const errorHandler = () => {
      release();
      reject(new Error('WebSocket connection failed'));
    };
    ws.addEventListener('open', openHandler);
    ws.addEventListener('error', errorHandler);
  });
};

const playRemote = debounce((screenId: number) => {
  // console.log('PLAY REMOTE');
  if (!ws || ws.readyState === ws.CLOSED) ws = new WebSocket(`ws://${host}:${port + 1}`);
  let pc = new RTCPeerConnection();
  const request: RequestMessage = {
    event: 'request',
    sourceId: screenId,
    sourceType: 'screen',
  };
  let requestTimeout = 0;

  const requestOffer = () => {
    if (!activeScreens.has(screenId)) return;
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(request));
    requestTimeout = window.setTimeout(requestOffer, 3000);
  };

  const connect = async () => {
    if (!activeScreens.has(screenId)) return;
    // console.log('CONNECT');
    pc.onicecandidate = e => {
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

        window.clearTimeout(requestTimeout);
        pc.close();
        pc = new RTCPeerConnection();
        setTimeout(() => {
          void connect();
        }, 3000);
      }
    };
    // console.log('WAIT CONNECT');
    await openSocket();
    // console.log('SEND REQUEST');
    requestOffer();
  };

  ws.onmessage = async ev => {
    try {
      const data = typeof ev.data === 'string' ? ev.data : String(ev.data);
      const msg = JSON.parse(data) as RtcMessage;
      // console.log({ msg, screenId });
      switch (msg.event) {
        case 'candidate':
          if (msg.sourceId === screenId && 'candidate' in msg) {
            await pc.addIceCandidate(msg.candidate ?? undefined);
          }
          break;
        case 'offer':
          if (msg.sourceId === screenId && activeScreens.has(screenId)) {
            window.clearTimeout(requestTimeout);
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
        case 'displayTopologyChanged':
          if (!activeScreens.has(screenId)) break;
          window.clearTimeout(requestTimeout);
          pc.close();
          pc = new RTCPeerConnection();
          void connect();
          break;
        case 'outputVisibility':
          ipcDispatch(setOutputHidden(msg.hidden));
          break;
        default:
          // console.warn(`Unknown msg: ${msg}`);
          break;
      }
    } catch (e) {
      debug(`error while parse websocket message: ${(e as Error).message}`);
    }
  };
  void connect();
}, 500);

if (!isRemoteSession) {
  const peers = new Map<string, { pc: RTCPeerConnection; stream: MediaStream }>();
  const pendingPeers = new Set<string>();
  const releasePeer = (id: string, expected?: RTCPeerConnection): void => {
    const entry = peers.get(id);
    if (!entry || (expected && entry.pc !== expected)) return;
    peers.delete(id);
    entry.pc.close();
    entry.stream.getTracks().forEach(track => track.stop());
  };
  // console.log('LISTEN SOCKET');
  ipcRenderer.on('socket', (_, { id, ...msg }: WithWebSocketKey<RtcMessage>) => {
    void (async () => {
      // console.log({ socket: msg });
      // if (msg.sourceId !== sourceId) return;
      if (msg.event === 'outputVisibility' || msg.event === 'displayTopologyChanged') return;
      switch (msg.event) {
        case 'request':
          // Signaling messages reuse this capture; only a new peer needs a new stream.
          if (pendingPeers.has(id)) return;
          {
            // A request starts a fresh negotiation, including screen switches/reconnects.
            releasePeer(id);
            pendingPeers.add(id);
            let stream: MediaStream | undefined;
            try {
              stream = await createStream(await getMediaSourceId(msg.sourceId));
              if (!stream) return;
              const capturedStream = stream;
              const pc = new RTCPeerConnection();
              peers.set(id, { pc, stream });

              pc.onconnectionstatechange = () => {
                if (['closed', 'disconnected', 'failed'].includes(pc.connectionState))
                  releasePeer(id, pc);
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
                void ipcRenderer.invoke('socket', candidateMsg);
              };
              for (const track of capturedStream.getVideoTracks()) {
                pc.addTrack(track, capturedStream);
              }

              const offer = await pc.createOffer();
              const offerMsg: WithWebSocketKey<OfferMessage> = {
                id,
                event: 'offer',
                desc: JSON.parse(JSON.stringify(offer)),
                sourceId: msg.sourceId,
                sourceType: 'screen',
              };
              await pc.setLocalDescription(offer);
              await Promise.all(
                pc.getSenders().map(async sender => {
                  const params = sender.getParameters();
                  params.degradationPreference = 'balanced';
                  await sender.setParameters(params).catch(error => {
                    debug(
                      `error while setting screen preview encoding params: ${(error as Error).message}`,
                    );
                  });
                }),
              );
              await ipcRenderer.invoke('socket', offerMsg);
            } catch (e) {
              const ownsStream = peers.has(id);
              releasePeer(id);
              if (!ownsStream) stream?.getTracks().forEach(track => track.stop());
              debug(`error while create offer: ${(e as Error).message}`);
            } finally {
              pendingPeers.delete(id);
            }
          }
          break;
        case 'candidate':
          {
            const pc = peers.get(id)?.pc;
            if (!pc) debug(`Unknown id: ${id} [${[...peers.keys()].join(',')}]`);
            else if (msg.candidate) await pc.addIceCandidate(msg.candidate);
          }
          break;
        case 'answer':
          {
            const pc = peers.get(id)?.pc;
            if (!pc) debug(`Unknown id: ${id} [${[...peers.keys()].join(',')}]`);
            else await pc.setRemoteDescription(msg.desc);
          }
          break;
        default:
          debug(`Unknown event: ${msg.event}`);
      }
    })();
  });
}

ipcRenderer.on('displayTopologyChanged', () => {
  if (isRemoteSession) return;
  activeScreens.forEach(screenId => {
    stopPreview(screenId);
    void playLocal(screenId);
  });
});

export const play = (screenId: number): void => {
  activeScreens.add(screenId);
  if (isRemoteSession) playRemote(screenId);
  else void playLocal(screenId);
};
