import { app, net } from 'electron';

import { formatNetworkError } from './networkError';

/** External services use Chromium's system proxy/PAC support, not Node's direct fetch.
 * Keep LAN/peer requests on their existing transport. Consume the body here too so
 * TLS/socket/timeout failures after the headers receive the same diagnostics.
 */
export const externalRequest = async <T>(
  url: string,
  init: RequestInit,
  consume: (response: Response) => Promise<T>,
): Promise<T> => {
  try {
    await app.whenReady();
    init.signal?.throwIfAborted();
    const response = await net.fetch(url, init);
    return await consume(response);
  } catch (error) {
    // Do not include URL credentials, paths, queries, request bodies or headers.
    let target = 'внешнему серверу';
    try {
      target = new URL(url).origin;
    } catch {
      // Invalid URLs must not expose a possibly sensitive input string.
    }
    const detail = formatNetworkError(init.signal?.aborted ? init.signal.reason : error);
    const wrapped = new Error(`Запрос к ${target}: ${detail}`, { cause: error });
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      typeof error.status === 'number'
    ) {
      Object.assign(wrapped, { status: error.status });
    }
    throw wrapped;
  }
};
