import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createScreenPreviewConnection } from './screenPreviewConnection';

class Socket {
  static instances: Socket[] = [];
  OPEN = 1;
  readyState = 0;
  onopen?: () => void;
  onclose?: () => void;
  onerror?: () => void;
  onmessage?: (event: { data: string }) => Promise<void>;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.();
  });
  constructor(public url: string) {
    Socket.instances.push(this);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  message(data: object) {
    return this.onmessage?.({ data: JSON.stringify(data) });
  }
}
class Peer {
  static instances: Peer[] = [];
  connectionState = 'new';
  onconnectionstatechange?: () => void;
  ontrack?: (event: { streams: MediaStream[] }) => void;
  onicecandidate?: (event: { candidate: RTCIceCandidate | null }) => void;
  close = vi.fn(() => {
    this.connectionState = 'closed';
    this.onconnectionstatechange?.();
  });
  addIceCandidate = vi.fn().mockResolvedValue(undefined);
  setRemoteDescription = vi.fn().mockResolvedValue(undefined);
  setLocalDescription = vi.fn().mockResolvedValue(undefined);
  createAnswer = vi.fn().mockResolvedValue({ type: 'answer', sdp: 'answer' });
  constructor() {
    Peer.instances.push(this);
  }
  state(state: string) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}
const stream = {} as MediaStream;
const onStream = vi.fn();
const onVisibility = vi.fn();
let stop: () => void;
const start = () => {
  stop = createScreenPreviewConnection('ws://remote:9002', 1, onStream, onVisibility, vi.fn());
  return Socket.instances.at(-1)!;
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Socket.instances.length = 0;
  Peer.instances.length = 0;
  vi.stubGlobal('WebSocket', Socket);
  vi.stubGlobal('RTCPeerConnection', Peer);
});
afterEach(() => {
  stop?.();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('remote screen preview lifecycle', () => {
  it('allows slow negotiation without periodically replacing the remote capture', async () => {
    const socket = start();
    socket.open();
    vi.advanceTimersByTime(9000);
    expect(socket.send).toHaveBeenCalledTimes(1);
    await socket.message({
      event: 'offer',
      sourceId: 1,
      sourceType: 'screen',
      desc: { type: 'offer' },
    });
    expect(socket.send).toHaveBeenLastCalledWith(expect.stringContaining('"event":"answer"'));
    Peer.instances[0].state('connected');
    vi.advanceTimersByTime(60000);
    expect(Socket.instances).toHaveLength(1);
  });
  it('recovers brief ICE disconnects without clearing or recreating the stream', () => {
    start().open();
    const peer = Peer.instances[0];
    peer.state('connected');
    peer.ontrack?.({ streams: [stream] });
    peer.state('disconnected');
    vi.advanceTimersByTime(9000);
    peer.state('connected');
    vi.advanceTimersByTime(10000);
    expect(peer.close).not.toHaveBeenCalled();
    expect(Socket.instances).toHaveLength(1);
    expect(onStream).toHaveBeenCalledOnce();
  });
  it('retries a sustained ICE loss once and reuses the signaling peer ID', () => {
    const socket = start();
    socket.open();
    Peer.instances[0].state('connected');
    Peer.instances[0].state('disconnected');
    Peer.instances[0].onconnectionstatechange?.();
    vi.advanceTimersByTime(10000);
    expect(socket.close).not.toHaveBeenCalled();
    expect(Socket.instances).toHaveLength(1);
    expect(Peer.instances).toHaveLength(2);
    expect(socket.send).toHaveBeenCalledTimes(2);
  });
  it('keeps flowing media when only signaling closes, then retries if ICE also fails', () => {
    const socket = start();
    socket.open();
    Peer.instances[0].state('connected');
    socket.close();
    vi.advanceTimersByTime(20000);
    expect(Socket.instances).toHaveLength(1);
    Peer.instances[0].state('failed');
    vi.advanceTimersByTime(3000);
    expect(Socket.instances).toHaveLength(2);
  });
  it('retries a missing offer after a bounded negotiation timeout', () => {
    const socket = start();
    socket.open();
    vi.advanceTimersByTime(15001);
    expect(socket.close).not.toHaveBeenCalled();
    expect(Socket.instances).toHaveLength(1);
    expect(Peer.instances).toHaveLength(2);
  });
  it('queues early ICE candidates until the offer is installed', async () => {
    const socket = start();
    socket.open();
    const candidate = { candidate: 'early' };
    await socket.message({ event: 'candidate', sourceId: 1, sourceType: 'screen', candidate });
    expect(Peer.instances[0].addIceCandidate).not.toHaveBeenCalled();
    await socket.message({
      event: 'offer',
      sourceId: 1,
      sourceType: 'screen',
      desc: { type: 'offer' },
    });
    expect(Peer.instances[0].addIceCandidate).toHaveBeenCalledWith(candidate);
  });
  it('stops timers, late signaling, tracks and retries when the preview closes', async () => {
    const socket = start();
    socket.open();
    const peer = Peer.instances[0];
    peer.state('failed');
    stop();
    await socket.message({ event: 'outputVisibility', hidden: true });
    peer.ontrack?.({ streams: [stream] });
    vi.advanceTimersByTime(60000);
    expect(Socket.instances).toHaveLength(1);
    expect(onStream).not.toHaveBeenCalled();
    expect(onVisibility).not.toHaveBeenCalled();
  });
  it('ignores a rejected old offer after retry on the same signaling socket', async () => {
    const socket = start();
    socket.open();
    let reject!: (error: Error) => void;
    Peer.instances[0].setRemoteDescription.mockReturnValue(
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
    );
    const processing = socket.message({
      event: 'offer',
      sourceId: 1,
      sourceType: 'screen',
      desc: { type: 'offer' },
    });
    vi.advanceTimersByTime(15001);
    expect(Peer.instances).toHaveLength(2);
    reject(new Error('old peer closed'));
    await processing;
    vi.advanceTimersByTime(3000);
    expect(Peer.instances).toHaveLength(2);
  });

  it('ignores stale asynchronous offers after replacement', async () => {
    const socket = start();
    socket.open();
    let resolve!: () => void;
    Peer.instances[0].setRemoteDescription.mockReturnValue(
      new Promise<void>(done => {
        resolve = done;
      }),
    );
    const processing = socket.message({
      event: 'offer',
      sourceId: 1,
      sourceType: 'screen',
      desc: { type: 'offer' },
    });
    stop();
    resolve();
    await processing;
    expect(Peer.instances[0].createAnswer).not.toHaveBeenCalled();
  });
});
