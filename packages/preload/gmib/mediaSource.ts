import { ipcRenderer } from 'electron';
import { delay } from '/@common/helpers';
import debounce from 'lodash/debounce';
import debugFactory from 'debug';

import { host, isRemoteSession, port } from '/@common/remote';
import type { CandidateMessage, OfferMessage, RtcMessage, WithWebSocketKey } from '/@common/rtc';
import { setOutputHidden } from '/@renderer/store/currentSlice';

import ipcDispatch from '../common/ipcDispatch';
import {
  createScreenPreviewConnection,
  SCREEN_DISCONNECT_GRACE_MS,
} from './screenPreviewConnection';

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
  remotePreviews.get(screenId)?.();
  remotePreviews.delete(screenId);
  stopPreview(screenId);
};

const remotePreviews = new Map<number, () => void>();

const playRemote = (screenId: number): void => {
  if (remotePreviews.has(screenId)) return;
  remotePreviews.set(
    screenId,
    createScreenPreviewConnection(
      `ws://${host}:${port + 1}`,
      screenId,
      stream => {
        const video = getVideo(screenId);
        if (video && activeScreens.has(screenId)) {
          video.srcObject = stream;
          void video.play().catch(error => debug(`Screen preview play failed: ${String(error)}`));
        }
      },
      hidden => ipcDispatch(setOutputHidden(hidden)),
      debug,
    ),
  );
};

if (!isRemoteSession) {
  const peers = new Map<
    string,
    {
      pc: RTCPeerConnection;
      stream: MediaStream;
      disconnectTimer?: ReturnType<typeof setTimeout>;
      negotiationTimer?: ReturnType<typeof setTimeout>;
    }
  >();
  const pendingPeers = new Set<string>();
  const releasePeer = (id: string, expected?: RTCPeerConnection): void => {
    const entry = peers.get(id);
    if (!entry || (expected && entry.pc !== expected)) return;
    peers.delete(id);
    clearTimeout(entry.disconnectTimer);
    clearTimeout(entry.negotiationTimer);
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
              peers.set(id, {
                pc,
                stream,
                // A receiver can vanish before sending an answer, leaving ICE in `new`.
                negotiationTimer: setTimeout(() => releasePeer(id, pc), 20000),
              });

              pc.onconnectionstatechange = () => {
                const entry = peers.get(id);
                if (!entry || entry.pc !== pc) return;
                if (pc.connectionState === 'disconnected') {
                  entry.disconnectTimer ??= setTimeout(
                    () => releasePeer(id, pc),
                    SCREEN_DISCONNECT_GRACE_MS,
                  );
                } else if (['closed', 'failed'].includes(pc.connectionState)) {
                  releasePeer(id, pc);
                } else if (pc.connectionState === 'connected') {
                  clearTimeout(entry.negotiationTimer);
                  entry.negotiationTimer = undefined;
                  clearTimeout(entry.disconnectTimer);
                  entry.disconnectTimer = undefined;
                }
              };

              pc.onicecandidate = e => {
                const { candidate } = e;
                if (!candidate || peers.get(id)?.pc !== pc) return;
                const candidateMsg: WithWebSocketKey<CandidateMessage> = {
                  id,
                  event: 'candidate',
                  candidate: candidate.toJSON(),
                  sourceId: msg.sourceId,
                  sourceType: 'screen',
                };
                void ipcRenderer
                  .invoke('socket', candidateMsg)
                  .catch(error => debug(String(error)));
              };
              for (const track of capturedStream.getVideoTracks()) {
                pc.addTrack(track, capturedStream);
              }

              const offer = await pc.createOffer();
              if (peers.get(id)?.pc !== pc) return;
              const offerMsg: WithWebSocketKey<OfferMessage> = {
                id,
                event: 'offer',
                desc: JSON.parse(JSON.stringify(offer)),
                sourceId: msg.sourceId,
                sourceType: 'screen',
              };
              await pc.setLocalDescription(offer);
              if (peers.get(id)?.pc !== pc) return;
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
              if (peers.get(id)?.pc !== pc) return;
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
    })().catch(error => debug(`Screen preview signaling failed: ${String(error)}`));
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
