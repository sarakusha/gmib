/* eslint-disable import/extensions */
import { contextBridge, ipcRenderer } from 'electron';

import debugFactory from 'debug';

import log from '../common/initlog';
import ipcDispatch, { setDispatch } from '../common/ipcDispatch';
import * as identify from '../common/identify';

import type { AnswerMessage, CandidateMessage, RequestMessage, RtcMessage } from '/@common/rtc';
import Deferred from '/@common/Deferred';
import expandTypes from '/@common/expandTypes';
import { host, port, sourceId } from '/@common/remote';
import { setFocused } from '/@player/store/currentSlice';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:remote`);

const deferred = new Deferred<MediaStream>();
let videoSelector: string;

const updateSrcObject = (selector: string) => {
  videoSelector = selector;
  const video = document.querySelector(selector) as HTMLVideoElement;
  if (video)
    deferred.promise.then(stream => {
      video.srcObject = stream;
    });
};

contextBridge.exposeInMainWorld('log', log.log.bind(log));
contextBridge.exposeInMainWorld('setDispatch', setDispatch);
contextBridge.exposeInMainWorld('mediaStream', { updateSrcObject });
// contextBridge.exposeInMainWorld('server', {
//   host,
//   port,
// });
contextBridge.exposeInMainWorld('identify', expandTypes(identify));

const ws = new WebSocket(`ws://${host}:${port + 1}`);
ws.onopen = async () => {
  const request: RequestMessage = {
    event: 'request',
    sourceId,
    sourceType: 'player',
  };
  let pc = new RTCPeerConnection();

  let timeout = 0;
  const connect = () => {
    pc.onicecandidate = async e => {
      const { candidate } = e;
      if (!candidate) return;
      if (ws.readyState === ws.OPEN) {
        const msg: CandidateMessage = {
          event: 'candidate',
          candidate: candidate.toJSON(),
          sourceId,
          sourceType: 'player',
        };
        ws.send(JSON.stringify(msg));
      }
    };

    pc.ontrack = e => {
      if (videoSelector) {
        const video = document.querySelector(videoSelector) as HTMLVideoElement;
        [video.srcObject] = e.streams;
      } else deferred.resolve(e.streams[0]);
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
    const sendRequest = () => {
      ws.send(JSON.stringify(request));
      timeout = window.setTimeout(sendRequest, 3000);
    };
    sendRequest();
  };
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
            window.clearTimeout(timeout);
            await pc.setRemoteDescription(msg.desc);
            const answer: AnswerMessage = {
              event: 'answer',
              desc: await pc.createAnswer(),
              sourceId,
              sourceType: 'player',
            };
            await pc.setLocalDescription(answer.desc);
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
};

ipcRenderer.on('focus', (_, focused: boolean) => {
  ipcDispatch(setFocused(focused));
});
