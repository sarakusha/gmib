type ConnectionOptions = {
  onOpen: () => void;
  onMessage: (event: MessageEvent<string>) => void;
  createSocket?: () => WebSocket;
};

// Each renderer owns its subscription. Reopen it after host restarts, and let
// the caller reload the snapshot to recover events missed while disconnected.
export const connectNovastarEvents = (
  url: string,
  { onOpen, onMessage, createSocket = () => new WebSocket(url) }: ConnectionOptions,
): (() => void) => {
  let socket: WebSocket | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let connectTimer: ReturnType<typeof setTimeout> | undefined;
  let retryDelay = 1000;
  let disposed = false;

  const detach = () => {
    clearTimeout(connectTimer);
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    socket.close();
    socket = undefined;
  };

  const retry = () => {
    if (disposed || retryTimer !== undefined) return;
    detach();
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      connect();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 15000);
  };

  const connect = () => {
    if (disposed) return;
    try {
      const current = createSocket();
      socket = current;
      connectTimer = setTimeout(retry, 10000);
      current.onopen = () => {
        if (disposed || socket !== current) return;
        clearTimeout(connectTimer);
        retryDelay = 1000;
        current.send(JSON.stringify({ sourceId: 0 }));
        onOpen();
      };
      current.onmessage = event => {
        if (!disposed && socket === current) onMessage(event);
      };
      current.onerror = retry;
      current.onclose = retry;
    } catch {
      retry();
    }
  };

  connect();
  return () => {
    disposed = true;
    clearTimeout(retryTimer);
    detach();
  };
};
