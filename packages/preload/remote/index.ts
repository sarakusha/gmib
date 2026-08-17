import { contextBridge } from 'electron';

import debugFactory from 'debug';

import log from '../common/initlog';
import ipcDispatch, { setDispatch } from '../common/ipcDispatch';
import * as identify from '../common/identify';

import type { AnswerMessage, CandidateMessage, RequestMessage, RtcMessage } from '/@common/rtc';
import expandTypes from '/@common/expandTypes';
import { host, port, sourceId } from '/@common/remote';
import { setOutputHidden } from '/@player/store/currentSlice';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:remote`);

let videoSelector: string;
let currentStream: MediaStream | undefined;
let attachStream = false;

const updateVideoStream = () => {
  if (!attachStream || !videoSelector || !currentStream) return;
  const video = document.querySelector<HTMLVideoElement>(videoSelector);
  if (!video || video.srcObject === currentStream) return;
  video.srcObject = currentStream;
  void video.play().catch(() => undefined);
};

const updateSrcObject = (selector: string) => {
  videoSelector = selector;
  attachStream = true;
  updateVideoStream();
};

const clearSrcObject = (selector = videoSelector) => {
  attachStream = false;
  const video = document.querySelector<HTMLVideoElement>(selector);
  if (!video) return;
  video.pause();
  video.srcObject = null;
  video.removeAttribute('src');
  video.load();
};

const request: RequestMessage = {
  event: 'request',
  sourceId,
  sourceType: 'player',
};
let ws: WebSocket | undefined;
let pc: RTCPeerConnection | undefined;
let requestTimeout = 0;
let reconnectTimeout = 0;

const clearTimers = () => {
  window.clearTimeout(requestTimeout);
  window.clearTimeout(reconnectTimeout);
  requestTimeout = 0;
  reconnectTimeout = 0;
};

const closeConnection = () => {
  clearTimers();
  pc?.close();
  pc = undefined;
  const socket = ws;
  ws = undefined;
  socket?.close();
};

const resetPreviewStream = () => {
  currentStream?.getTracks().forEach(track => track.stop());
  currentStream = undefined;
  const video = videoSelector && document.querySelector<HTMLVideoElement>(videoSelector);
  if (video) video.srcObject = null;
};

const connect = () => {
  if (ws) return;
  const socket = new WebSocket(`ws://${host}:${port + 1}`);
  ws = socket;

  const scheduleReconnect = (delay = 3000) => {
    if (ws !== socket || reconnectTimeout) return;
    reconnectTimeout = window.setTimeout(() => {
      debug('try reconnect preview');
      resetPreviewStream();
      closeConnection();
      connect();
    }, delay);
  };

  socket.onopen = () => {
    if (ws !== socket) return;
    const peer = new RTCPeerConnection();
    pc = peer;
    peer.onicecandidate = event => {
      const { candidate } = event;
      if (!candidate || ws !== socket || socket.readyState !== socket.OPEN) return;
      const msg: CandidateMessage = {
        event: 'candidate',
        candidate: candidate.toJSON(),
        sourceId,
        sourceType: 'player',
      };
      socket.send(JSON.stringify(msg));
    };
    peer.ontrack = event => {
      [currentStream] = event.streams;
      updateVideoStream();
    };
    peer.onconnectionstatechange = () => {
      if (pc !== peer) return;
      debug(`RTC connection: ${peer.connectionState}`);
      if (peer.connectionState === 'connected') {
        window.clearTimeout(reconnectTimeout);
        reconnectTimeout = 0;
      } else if (['disconnected', 'failed'].includes(peer.connectionState)) {
        scheduleReconnect();
      }
    };
    const sendRequest = () => {
      if (ws !== socket || socket.readyState !== socket.OPEN) return;
      socket.send(JSON.stringify(request));
      requestTimeout = window.setTimeout(sendRequest, 3000);
    };
    sendRequest();
  };

  socket.onmessage = async (ev: MessageEvent) => {
    if (ws !== socket) return;
    try {
      let payload: string;
      if (typeof ev.data === 'string') payload = ev.data;
      else if (ev.data instanceof ArrayBuffer) payload = new TextDecoder().decode(ev.data);
      else if (ev.data instanceof Blob) payload = await ev.data.text();
      else payload = String(ev.data);

      const msg = JSON.parse(payload) as RtcMessage;
      switch (msg.event) {
        case 'candidate':
          if (msg.sourceId === sourceId && 'candidate' in msg) {
            await pc?.addIceCandidate(msg.candidate ?? undefined);
          }
          break;
        case 'offer':
          if (msg.sourceId === sourceId && pc) {
            window.clearTimeout(requestTimeout);
            requestTimeout = 0;
            await pc.setRemoteDescription(msg.desc);
            const answer: AnswerMessage = {
              event: 'answer',
              desc: await pc.createAnswer(),
              sourceId,
              sourceType: 'player',
            };
            await pc.setLocalDescription(answer.desc);
            if (ws === socket && socket.readyState === socket.OPEN) {
              socket.send(JSON.stringify(answer));
            }
          }
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

  socket.onclose = () => {
    if (ws === socket) scheduleReconnect();
  };
  socket.onerror = () => {
    if (ws === socket) scheduleReconnect();
  };
};

const reconnect = () => {
  debug('reconnect preview requested');
  resetPreviewStream();
  closeConnection();
  connect();
};

contextBridge.exposeInMainWorld('log', log.log.bind(log));
contextBridge.exposeInMainWorld('setDispatch', setDispatch);
contextBridge.exposeInMainWorld('mediaStream', { clearSrcObject, reconnect, updateSrcObject });
// contextBridge.exposeInMainWorld('server', {
//   host,
//   port,
// });
contextBridge.exposeInMainWorld('identify', expandTypes(identify));

connect();
