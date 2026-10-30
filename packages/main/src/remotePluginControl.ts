import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';

import { shell, type WebContents } from 'electron';
import { WebSocket, WebSocketServer } from 'ws';

import type { GmibWindowParams } from '/@common/WindowParams';
import type { PluginStatus } from '/@common/plugins';
import authRequest from './authRequest';
import { requireRemotePluginSupport } from './remotePluginLifecycle';

const LIMIT = 20 * 1024 * 1024;
const sessions = new Map<string, () => void>();

// Reject ambiguous paths before mapping them into a signed gateway request.
export const remoteControlPath = (raw: string, pluginId: string): string | undefined => {
  const [path] = raw.split('?');
  if (!path || /%(?:2f|5c|25)/i.test(path) || path.includes('\\')) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return undefined;
  }
  if (decoded.split('/').some(part => part === '.' || part === '..')) return undefined;
  const prefix = `/plugins/${pluginId}/`;
  if (!decoded.startsWith(prefix)) return undefined;
  const relative = path.slice(prefix.length);
  if (!relative) return undefined;
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';
  return `${relative.startsWith('api/') ? `api/${relative.slice(4)}` : `static/${relative}`}${query}`;
};

export const openRemotePluginControl = async (
  params: GmibWindowParams,
  id: string,
  owner: WebContents,
): Promise<void> => {
  requireRemotePluginSupport(params);
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) throw new Error('Недопустимый плагин');
  const target = { host: params.host, port: params.nibusPort + 1 };
  const listing = await authRequest({ ...target, api: '/manage/v1/plugins', redirect: 'error' });
  if (!listing?.ok) throw new Error('Не удалось открыть пульт удалённого плагина');
  const data = (await listing.json()) as { plugins: PluginStatus[] };
  const plugin = data.plugins.find(item => item.manifest.id === id);
  if (!plugin?.manifest.control) throw new Error('У плагина нет пульта');
  if (plugin.manifest.localOnly) throw new Error('Пульт плагина доступен только локально');
  const root = `/manage/v1/plugins/${id}/control/`;
  const token = randomBytes(32).toString('hex');
  const cookieName = `gmib_control_${randomBytes(8).toString('hex')}`;
  const lifetime = new AbortController();
  let origin = '';
  let stopped = false;
  const key = `${owner.id}:${params.host}:${params.nibusPort}:${id}`;
  const wsServer = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  const authorized = (req: IncomingMessage): boolean => {
    if (req.headers.host !== new URL(origin).host) return false;
    if (req.headers.origin && req.headers.origin !== origin) return false;
    if (req.headers['sec-fetch-site'] === 'cross-site') return false;
    const value =
      req.headers.cookie
        ?.split(';')
        .map(part => part.trim())
        .find(part => part.startsWith(`${cookieName}=`))
        ?.slice(cookieName.length + 1) ?? '';
    return /^[a-f0-9]{64}$/.test(value) && timingSafeEqual(Buffer.from(value), Buffer.from(token));
  };
  const server = createServer((req, res) => {
    void (async () => {
      try {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        if (
          req.method === 'GET' &&
          req.url === `/session/${token}` &&
          req.headers.host === new URL(origin).host &&
          (!req.headers.origin || req.headers.origin === origin) &&
          req.headers['sec-fetch-site'] !== 'cross-site'
        ) {
          res.setHeader('Set-Cookie', `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/`);
          res.writeHead(302, { Location: `/plugins/${id}/${plugin.manifest.control!.path}` });
          res.end();
          return;
        }
        if (!authorized(req)) {
          res.writeHead(403);
          res.end();
          return;
        }
        const mapped = remoteControlPath(req.url ?? '', id);
        if (!mapped) {
          res.writeHead(404);
          res.end();
          return;
        }
        if (
          !['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method ?? '') ||
          (!mapped.startsWith('api/') && !['GET', 'HEAD'].includes(req.method ?? ''))
        ) {
          res.writeHead(405);
          res.end();
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        for await (const part of req) {
          const chunk = Buffer.from(part as Uint8Array);
          size += chunk.length;
          if (size > LIMIT) {
            res.writeHead(413);
            res.end();
            return;
          }
          chunks.push(chunk);
        }
        let body: unknown;
        if (size) {
          if (!req.headers['content-type']?.startsWith('application/json')) {
            res.writeHead(415);
            res.end();
            return;
          }
          try {
            body = JSON.parse(Buffer.concat(chunks).toString());
          } catch {
            res.writeHead(400);
            res.end();
            return;
          }
        }
        const controller = new AbortController();
        const abort = () => controller.abort();
        lifetime.signal.addEventListener('abort', abort, { once: true });
        res.on('close', abort);
        const timeout = setTimeout(abort, 30000);
        try {
          const upstream = await authRequest({
            ...target,
            api: root + mapped,
            method: req.method,
            body,
            signal: controller.signal,
            redirect: 'error',
          });
          if (!upstream) {
            res.writeHead(401);
            res.end();
            return;
          }
          // eslint-disable-next-line no-param-reassign
          res.statusCode = upstream.status;
          const type = upstream.headers.get('content-type');
          if (type) res.setHeader('Content-Type', type);
          // Only content is forwarded. Remote cookies, CORS and redirects never escape.
          if (upstream.body) {
            const reader = upstream.body.getReader();
            let received = 0;
            const responseChunks: Uint8Array[] = [];
            try {
              for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                received += value.byteLength;
                if (received > LIMIT) throw new Error('Ответ пульта слишком большой');
                responseChunks.push(value);
              }
            } finally {
              reader.releaseLock();
            }
            res.end(Buffer.concat(responseChunks));
            return;
          }
          res.end();
        } finally {
          controller.abort();
          clearTimeout(timeout);
          lifetime.signal.removeEventListener('abort', abort);
        }
      } catch {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Удалённый GMIB недоступен. Проверьте подключение.' }));
        } else res.destroy();
      }
    })();
  });
  server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => socket.destroy());
    if (req.url !== '/' || !authorized(req)) {
      socket.destroy();
      return;
    }
    wsServer.handleUpgrade(req, socket, head, ws => {
      wsServer.emit('connection', ws);
    });
  });
  wsServer.on('connection', (ws: WebSocket) => {
    ws.on('error', () => ws.terminate());
    const controller = new AbortController();
    const abort = () => controller.abort();
    lifetime.signal.addEventListener('abort', abort, { once: true });
    ws.once('close', abort);
    // Browser connections only receive events for this plugin; commands use signed HTTP.
    void (async () => {
      try {
        const response = await authRequest({
          ...target,
          api: `${root}events`,
          signal: controller.signal,
          redirect: 'error',
        });
        if (!response?.ok || !response.body) throw new Error('Поток событий недоступен');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let pending = '';
        try {
          while (ws.readyState === WebSocket.OPEN) {
            const { value, done } = await reader.read();
            if (done) break;
            pending += decoder.decode(value, { stream: true });
            if (pending.length > LIMIT || ws.bufferedAmount > LIMIT)
              throw new Error('Поток событий слишком большой');
            let end: number;
            while ((end = pending.indexOf('\n')) >= 0) {
              const line = pending.slice(0, end);
              pending = pending.slice(end + 1);
              if (line) ws.send(line);
            }
          }
        } finally {
          await reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
      } catch {
        /* Client reconnects using its normal WebSocket retry policy. */
      } finally {
        lifetime.signal.removeEventListener('abort', abort);
        ws.close();
      }
    })();
  });
  const stop = () => {
    if (stopped) return;
    stopped = true;
    lifetime.abort();
    for (const ws of wsServer.clients) ws.terminate();
    wsServer.close();
    server.close();
    server.closeAllConnections();
    owner.off('destroyed', stop);
    if (sessions.get(key) === stop) sessions.delete(key);
  };
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    stop();
    throw new Error('Не удалось открыть локальный прокси');
  }
  origin = `http://127.0.0.1:${address.port}`;
  sessions.get(key)?.();
  sessions.set(key, stop);
  owner.once('destroyed', stop);
  if (owner.isDestroyed()) {
    stop();
    throw new Error('Подключение GMIB закрыто');
  }
  try {
    await shell.openExternal(`${origin}/session/${token}`);
  } catch (error) {
    stop();
    throw error;
  }
};
