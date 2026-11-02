import { describe, expect, it } from 'vitest';
import { formatNetworkError } from '../src/networkError';

describe('formatNetworkError', () => {
  it('retains nested fetch and aggregate connection diagnostics', () => {
    const error = new TypeError('fetch failed', {
      cause: new AggregateError([
        Object.assign(new Error('connect ECONNREFUSED ::1:443'), { code: 'ECONNREFUSED' }),
        Object.assign(new Error('connect ETIMEDOUT 192.0.2.1:443'), { code: 'ETIMEDOUT' }),
      ]),
    });
    const result = formatNetworkError(error);
    expect(result).toContain('fetch failed');
    expect(result).toContain('ECONNREFUSED');
    expect(result).toContain('ETIMEDOUT');
    expect(result).toContain('Сервер отклонил');
    expect(result).toContain('время ожидания');
  });

  it.each([
    ['getaddrinfo ENOTFOUND example.org', 'DNS'],
    ['net::ERR_CERT_AUTHORITY_INVALID', 'сертификат'],
    ['net::ERR_PROXY_CONNECTION_FAILED', 'прокси'],
    ['net::ERR_TIMED_OUT', 'время ожидания'],
    ['net::ERR_CONNECTION_RESET', 'прервано'],
    ['net::ERR_INTERNET_DISCONNECTED', 'подключение'],
    ['net::ERR_ABORTED', 'отменён'],
  ])('explains %s', (message, hint) => {
    const result = formatNetworkError(new Error(message));
    expect(result).toContain(message);
    expect(result).toContain(hint);
  });

  it('redacts URL credentials, path tokens, queries and fragments in nested errors', () => {
    const result = formatNetworkError(
      new Error(
        'fetch https://user:password@example.org/token-secret?key=query-secret#fragment-secret',
        {
          cause: new Error(
            'proxy http://proxy-user:proxy-pass@proxy.example:8080/private?auth=secret',
          ),
        },
      ),
    );
    expect(result).toContain('https://example.org');
    expect(result).toContain('http://proxy.example:8080');
    for (const secret of [
      'user:',
      'password',
      'token-secret',
      'query-secret',
      'fragment-secret',
      'proxy-user',
      'proxy-pass',
      'auth=',
    ]) {
      expect(result).not.toContain(secret);
    }
  });

  it('does not serialize arbitrary objects or read payload fields', () => {
    const error = {
      message: 'fetch failed',
      headers: { Authorization: 'secret' },
      body: 'secret',
      toString: () => 'secret',
    };
    expect(formatNetworkError(error)).toBe('fetch failed');
    expect(formatNetworkError({ headers: error.headers })).toBe('Неизвестная сетевая ошибка');
  });

  it('bounds traversal and tolerates cycles and throwing accessors', () => {
    const error: { message: string; cause?: unknown; errors?: unknown[] } = {
      message: 'fetch failed',
    };
    error.cause = error;
    error.errors = [
      error,
      Object.defineProperty({}, 'message', {
        get() {
          throw new Error('secret');
        },
      }),
    ];
    expect(formatNetworkError(error)).toBe('fetch failed');
    let deep: Error = new Error('hidden');
    for (let i = 0; i < 100; i += 1) deep = new Error('wrapper', { cause: deep });
    expect(formatNetworkError(deep)).toBe('wrapper');
  });

  it('recognizes DOM cancellation and timeout names', () => {
    expect(formatNetworkError({ name: 'AbortError', message: 'cancelled' })).toContain(
      'Запрос отменён',
    );
    expect(formatNetworkError({ name: 'TimeoutError', message: 'expired' })).toContain(
      'время ожидания',
    );
  });
});
