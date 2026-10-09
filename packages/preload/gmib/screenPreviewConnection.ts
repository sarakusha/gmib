import type { AnswerMessage, CandidateMessage, RtcMessage } from '/@common/rtc';

const RETRY_DELAY_MS = 3000;
export const SCREEN_DISCONNECT_GRACE_MS = 10000;
const CONNECT_TIMEOUT_MS = 15000;

/** Each preview owns its signaling socket, peer and timers, including during retries. */
export const createScreenPreviewConnection = (
  url: string,
  screenId: number,
  onStream: (stream: MediaStream) => void,
  onVisibility: (hidden: boolean) => void,
  log: (message: string) => void,
): (() => void) => {
  let stopped = false;
  let socket: WebSocket | undefined;
  let peer: RTCPeerConnection | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let connectTimer: ReturnType<typeof setTimeout> | undefined;

  const clearTimers = () => {
    clearTimeout(retryTimer);
    clearTimeout(connectTimer);
    retryTimer = undefined;
    connectTimer = undefined;
  };
  const release = (keepSocket = false) => {
    clearTimers();
    const oldPeer = peer;
    const oldSocket = socket;
    peer = undefined;
    if (!keepSocket) socket = undefined;
    oldPeer?.close();
    if (!keepSocket) oldSocket?.close();
  };
  const retry = (delay = RETRY_DELAY_MS) => {
    if (stopped || retryTimer) return;
    retryTimer = setTimeout(() => {
      // Keep the peer ID on older hosts so the new request releases their old capture.
      release(Boolean(socket && socket.readyState === socket.OPEN));
      connect();
    }, delay);
  };
  const connect = () => {
    if (stopped) return;
    const ws = socket && socket.readyState === socket.OPEN ? socket : new WebSocket(url);
    const candidates: (RTCIceCandidateInit | null)[] = [];
    let hasOffer = false;
    socket = ws;
    connectTimer = setTimeout(() => retry(0), CONNECT_TIMEOUT_MS);
    const negotiate = () => {
      if (socket !== ws || stopped) return;
      const pc = new RTCPeerConnection();
      peer = pc;
      pc.onicecandidate = ({ candidate }) => {
        if (!candidate || peer !== pc || ws.readyState !== ws.OPEN) return;
        const message: CandidateMessage = {
          event: 'candidate',
          candidate: candidate.toJSON(),
          sourceId: screenId,
          sourceType: 'screen',
        };
        ws.send(JSON.stringify(message));
      };
      pc.ontrack = event => {
        if (peer === pc && event.streams[0]) onStream(event.streams[0]);
      };
      pc.onconnectionstatechange = () => {
        if (peer !== pc) return;
        log(`RTC connection: ${pc.connectionState}`);
        if (pc.connectionState === 'connected') {
          clearTimers();
        } else if (pc.connectionState === 'disconnected') {
          // ICE can recover without renegotiation after a short interruption.
          retry(SCREEN_DISCONNECT_GRACE_MS);
        } else if (pc.connectionState === 'failed') {
          retry();
        }
      };
      // Repeated requests replace the source capture. Allow slow negotiation to finish.
      ws.send(JSON.stringify({ event: 'request', sourceId: screenId, sourceType: 'screen' }));
    };
    ws.onopen = negotiate;
    ws.onmessage = async event => {
      if (socket !== ws || stopped) return;
      const pc = peer;
      try {
        const message = JSON.parse(String(event.data)) as RtcMessage;
        if (message.event === 'outputVisibility') {
          onVisibility(message.hidden);
        } else if (message.event === 'displayTopologyChanged') {
          clearTimeout(retryTimer);
          retryTimer = undefined;
          retry(0);
        } else if (
          'sourceId' in message &&
          message.sourceId === screenId &&
          message.sourceType === 'screen' &&
          pc
        ) {
          if (message.event === 'candidate') {
            if (hasOffer) await pc.addIceCandidate(message.candidate ?? undefined);
            else candidates.push(message.candidate);
          } else if (message.event === 'offer') {
            await pc.setRemoteDescription(message.desc);
            if (peer !== pc) return;
            hasOffer = true;
            for (const candidate of candidates.splice(0)) {
              await pc.addIceCandidate(candidate ?? undefined);
              if (peer !== pc) return;
            }
            const answer: AnswerMessage = {
              event: 'answer',
              desc: await pc.createAnswer(),
              sourceId: screenId,
              sourceType: 'screen',
            };
            if (peer !== pc) return;
            await pc.setLocalDescription(answer.desc);
            if (peer === pc && socket === ws && ws.readyState === ws.OPEN)
              ws.send(JSON.stringify(answer));
          }
        }
      } catch (error) {
        if (socket !== ws || stopped || (pc && peer !== pc)) return;
        log(`Screen preview signaling failed: ${(error as Error).message}`);
        retry();
      }
    };
    // Losing signaling alone does not invalidate an already flowing media stream.
    ws.onclose = () => {
      if (socket === ws && peer?.connectionState !== 'connected') retry();
    };
    ws.onerror = () => {
      if (socket === ws && peer?.connectionState !== 'connected') retry();
    };
    if (ws.readyState === ws.OPEN) negotiate();
  };
  connect();
  return () => {
    stopped = true;
    release();
  };
};
