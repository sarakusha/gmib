import { contextBridge } from 'electron';

import debugFactory from 'debug';

import log from '../common/initlog';
import { setDispatch } from '../common/ipcDispatch';
import * as identify from '../common/identify';

import type { AnswerMessage, CandidateMessage, RequestMessage, RtcMessage } from '/@common/rtc';
import Deferred from '/@common/Deferred';
import expandTypes from '/@common/expandTypes';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:remote`);

const search = new URLSearchParams(window.location.search);
const host = search.get('host') ?? 'localhost';
const port = +(search.get('port') ?? 9001);
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
  host,
  port,
});
contextBridge.exposeInMainWorld('identify', expandTypes(identify));

const ws = new WebSocket(`ws://${host}:${port + 1}`);
ws.onopen = async () => {
  const pc = new RTCPeerConnection();
  
  pc.onicecandidate = async e => {
    const { candidate } = e;
    if (!candidate) return;
    if (ws.readyState === ws.OPEN) {
      const msg: CandidateMessage = {
        event: 'candidate',
        candidate: candidate.toJSON(),
        sourceId,
      };
      ws.send(JSON.stringify(msg));
    }
  };
  
  pc.ontrack = e => deferred.resolve(e.streams[0]);

  ws.onmessage = async ev => {
    try {
      const msg = JSON.parse(ev.data.toString()) as RtcMessage;
      switch (msg.event) {
        case 'candidate':
          if (msg.sourceId === sourceId && 'candidate' in msg) {
            await pc.addIceCandidate(msg.candidate ?? undefined);
          }
          break;
        case 'offer':
          if (msg.sourceId === sourceId) {
            await pc.setRemoteDescription(msg.desc);
            const answer: AnswerMessage = {
              event: 'answer',
              desc: await pc.createAnswer(),
              sourceId,
            };
            await pc.setLocalDescription(answer.desc);
            ws.send(JSON.stringify(answer));
          }
          break;
        default:
          console.warn(`Unknown msg: ${msg}`);
          break;
      }
    } catch (e) {
      debug(`error while parse websocket message: ${(e as Error).message}`);
    }
  };
  const request: RequestMessage = {
    event: 'request',
    sourceId,
  };
  
  ws.send(JSON.stringify(request));
};
