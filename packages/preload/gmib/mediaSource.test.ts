import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RtcMessage, WithWebSocketKey } from '/@common/rtc';

const mock = vi.hoisted(() => ({
  listeners: new Map<string, (event: unknown, message: WithWebSocketKey<RtcMessage>) => void>(),
  invoke: vi.fn(),
  capture: vi.fn(),
}));
vi.mock('electron', () => ({
  ipcRenderer: {
    on: (name: string, callback: (event: unknown, message: WithWebSocketKey<RtcMessage>) => void) =>
      mock.listeners.set(name, callback),
    invoke: mock.invoke,
  },
}));
vi.mock('/@common/remote', () => ({ host: 'localhost', port: 9001, isRemoteSession: false }));
vi.mock('../common/ipcDispatch', () => ({ default: vi.fn() }));

class Peer {
  static instances: Peer[] = [];
  connectionState = 'new';
  onconnectionstatechange?: () => void;
  onicecandidate?: (event: RTCPeerConnectionIceEvent) => void;
  addTrack = vi.fn();
  sender = {
    getParameters: vi.fn(() => ({ encodings: [{}] })),
    setParameters: vi.fn().mockResolvedValue(undefined),
  };
  getSenders = () => [this.sender];
  addIceCandidate = vi.fn().mockResolvedValue(undefined);
  setRemoteDescription = vi.fn().mockResolvedValue(undefined);
  setLocalDescription = vi.fn().mockResolvedValue(undefined);
  createOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: 'test' });
  close = vi.fn(() => {
    this.connectionState = 'closed';
    this.onconnectionstatechange?.();
  });
  constructor() {
    Peer.instances.push(this);
  }
}

const stop = vi.fn();
const track = { kind: 'video', stop };
const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
const signal = (message: RtcMessage, id = 'peer') =>
  mock.listeners.get('socket')?.({}, { id, ...message });
const request = () => signal({ event: 'request', sourceId: 1, sourceType: 'screen' });
const flush = async () => {
  for (let index = 0; index < 30; index += 1) await Promise.resolve();
};

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mock.listeners.clear();
  Peer.instances.length = 0;
  mock.invoke.mockImplementation((name: string) =>
    Promise.resolve(name === 'getMediaSourceId' ? 'window:1:0' : undefined),
  );
  mock.capture.mockResolvedValue(stream);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: mock.capture } });
  vi.stubGlobal('RTCPeerConnection', Peer);
  await import('./mediaSource');
});
afterEach(() => vi.unstubAllGlobals());

describe('screen window capture', () => {
  it('keeps native window geometry instead of forcing a 16:9 frame', async () => {
    request();
    await flush();
    const constraints = mock.capture.mock.calls[0]?.[0] as MediaStreamConstraints;
    expect(constraints).toEqual({
      audio: false,
      video: {
        mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: 'window:1:0' },
      },
    });
    expect(Peer.instances[0].addTrack).toHaveBeenCalledWith(track, stream);
    expect(Peer.instances[0].sender.setParameters).toHaveBeenCalledWith({
      encodings: [{}],
      degradationPreference: 'balanced',
    });
  });

  it('reuses the capture for ICE candidates and the answer', async () => {
    request();
    await flush();
    const candidate = { candidate: 'candidate:test' };
    const desc: RTCSessionDescriptionInit = { type: 'answer', sdp: 'answer' };
    signal({ event: 'candidate', sourceId: 1, sourceType: 'screen', candidate });
    signal({ event: 'answer', sourceId: 1, sourceType: 'screen', desc });
    await flush();
    expect(mock.capture).toHaveBeenCalledOnce();
    expect(Peer.instances).toHaveLength(1);
    expect(Peer.instances[0].addIceCandidate).toHaveBeenCalledWith(candidate);
    expect(Peer.instances[0].setRemoteDescription).toHaveBeenCalledWith(desc);
  });

  it('replaces the capture when the same socket requests a fresh negotiation', async () => {
    request();
    await flush();
    const oldPeer = Peer.instances[0];
    signal({ event: 'request', sourceId: 2, sourceType: 'screen' });
    await flush();
    expect(mock.capture).toHaveBeenCalledTimes(2);
    expect(Peer.instances).toHaveLength(2);
    expect(oldPeer.close).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
    expect(mock.invoke).toHaveBeenCalledWith(
      'socket',
      expect.objectContaining({
        event: 'offer',
        sourceId: 2,
      }),
    );
    // A delayed state callback from the old peer must not close its replacement.
    oldPeer.onconnectionstatechange?.();
    expect(Peer.instances[1].close).not.toHaveBeenCalled();
  });

  it('does not start duplicate captures while a request is pending', async () => {
    let resolve!: (value: typeof stream) => void;
    mock.capture.mockReturnValue(
      new Promise<typeof stream>(done => {
        resolve = done;
      }),
    );
    request();
    await flush();
    request();
    await flush();
    expect(mock.capture).toHaveBeenCalledOnce();
    resolve(stream);
    await flush();
    expect(Peer.instances).toHaveLength(1);
  });

  it.each(['closed', 'disconnected', 'failed'])(
    'releases capture on %s and allows reconnect',
    async state => {
      request();
      await flush();
      const peer = Peer.instances[0];
      peer.connectionState = state;
      peer.onconnectionstatechange?.();
      expect(stop).toHaveBeenCalledOnce();
      expect(peer.close).toHaveBeenCalledOnce();
      request();
      await flush();
      expect(mock.capture).toHaveBeenCalledTimes(2);
    },
  );

  it('releases capture when negotiation fails', async () => {
    mock.invoke.mockImplementation((name: string) =>
      name === 'socket'
        ? Promise.reject(new Error('socket closed'))
        : Promise.resolve('window:1:0'),
    );
    request();
    await flush();
    expect(stop).toHaveBeenCalledOnce();
    expect(Peer.instances[0].close).toHaveBeenCalledOnce();
    request();
    await flush();
    expect(mock.capture).toHaveBeenCalledTimes(2);
  });
});
