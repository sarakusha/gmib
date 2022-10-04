import { contextBridge } from 'electron';

// import debugFactory from 'debug';

import log from '/@main/initlog';
import { setDispatch } from '/@common/ipcDispatch';
import type { CandidateMessage, OfferMessage, RtcMessage } from '/@common/rtc';
import Deferred from '/@common/Deferred';

const search = new URLSearchParams(window.location.search);
const host = search.get('host') ?? 'localhost';
const port = +(search.get('port') ?? 9002);
const sourceId = +(search.get('source_id') ?? 1);

const deferred = new Deferred<MediaStream>();

const updateSrcObject = (selector: string) => {
  const video = document.querySelector(selector) as HTMLVideoElement;
  if (video)
    deferred.promise.then(stream => {
      video.srcObject = stream;
    });
};

contextBridge.exposeInMainWorld('log', log.log.bind(log));
contextBridge.exposeInMainWorld('setDispatch', setDispatch);
contextBridge.exposeInMainWorld('mediaStream', { updateSrcObject });
contextBridge.exposeInMainWorld('server', {
  port: +(process.env['NIBUS_PORT'] ?? 9001) + 1,
});

const ws = new WebSocket(`ws://${host}:${port}`);
ws.onopen = async () => {
  const pc = new RTCPeerConnection();
  pc.onicecandidate = async e => {
    const candidate: RTCIceCandidateInit = {
      candidate: e.candidate?.candidate,
      sdpMLineIndex: e.candidate?.sdpMLineIndex,
      sdpMid: e.candidate?.sdpMid,
    };
    if (ws.readyState === ws.OPEN) {
      const msg: CandidateMessage = {
        event: 'candidate',
        candidate,
        sourceId,
      };
      ws.send(JSON.stringify(msg));
    }
  };
  const offer: OfferMessage = {
    event: 'offer',
    desc: await pc.createOffer(),
    sourceId,
  };
  ws.send(JSON.stringify(offer));
  pc.ontrack = e => deferred.resolve(e.streams[0]);

  ws.onmessage = ev => {
    try {
      const msg = JSON.parse(ev.data.toString()) as RtcMessage;
      switch (msg.event) {
        case 'candidate':
          if (msg.sourceId === sourceId && 'candidate' in msg) {
            pc.addIceCandidate(msg.candidate ?? undefined);
          }
          break;
        case 'answer':
          if (msg.sourceId === sourceId) {
            pc.setRemoteDescription(msg.desc);
          }
          break;
        default:
          console.warn(`Unknown msg: ${msg}`);
          break;
      }
    } catch (e: any) {
      console.error(`error while parse websocket message: ${e.message}`);
    }
  };
};
