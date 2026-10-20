import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { connectNovastarEvents } from './novastarConnection';

class FakeSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  send = vi.fn();
  close = vi.fn();
}

describe('NovaStar event connection', () => {
  let sockets: FakeSocket[];
  let dispose: () => void;
  let onOpen: ReturnType<typeof vi.fn>;
  let onMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    onOpen = vi.fn();
    onMessage = vi.fn();
    dispose = connectNovastarEvents('ws://host:9002', {
      onOpen,
      onMessage,
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });
  });

  afterEach(() => {
    dispose();
    vi.useRealTimers();
  });

  it('subscribes and requests a fresh snapshot again after a host restart', () => {
    sockets[0].onopen?.();
    expect(sockets[0].send).toHaveBeenCalledWith('{"sourceId":0}');
    sockets[0].onclose?.();
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
    sockets[1].onopen?.();
    expect(onOpen).toHaveBeenCalledTimes(2);
    const event = { data: '{"event":"add","data":[]}' } as MessageEvent<string>;
    sockets[1].onmessage?.(event);
    expect(onMessage).toHaveBeenCalledWith(event);
  });

  it('retries failures with backoff and ignores callbacks from retired sockets', () => {
    const staleOpen = sockets[0].onopen;
    const staleMessage = sockets[0].onmessage;
    const closeAfterError = sockets[0].onclose;
    sockets[0].onerror?.();
    closeAfterError?.();
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
    staleOpen?.();
    staleMessage?.({ data: 'stale' } as MessageEvent<string>);
    expect(onOpen).not.toHaveBeenCalled();
    expect(onMessage).not.toHaveBeenCalled();
    sockets[1].onclose?.();
    vi.advanceTimersByTime(1999);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
    sockets[2].onopen?.();
    sockets[2].onclose?.();
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(4);
  });

  it('retries a connection that never finishes opening', () => {
    vi.advanceTimersByTime(10000);
    expect(sockets[0].close).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
  });

  it('cancels retries and releases sockets when the tab closes', () => {
    sockets[0].onclose?.();
    dispose();
    vi.advanceTimersByTime(60000);
    expect(sockets).toHaveLength(1);
    expect(sockets[0].onmessage).toBeNull();
  });

  it('closes an active subscription and ignores queued events after disposal', () => {
    sockets[0].onopen?.();
    const staleMessage = sockets[0].onmessage;
    dispose();
    staleMessage?.({ data: 'late' } as MessageEvent<string>);
    expect(sockets[0].close).toHaveBeenCalledOnce();
    expect(onMessage).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60000);
    expect(sockets).toHaveLength(1);
  });
});
