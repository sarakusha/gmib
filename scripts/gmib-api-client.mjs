import crypto from 'node:crypto';

import {
  createVerifierAndSalt,
  SRPClientSession,
  SRPParameters,
  SRPRoutines,
} from '@sarakusha/tssrp6a';

const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_TIMEOUT_MS = 3_600_000;

const isEmptyObject = value =>
  typeof value === 'object' &&
  value !== null &&
  Object.keys(value).length === 0 &&
  Object.getPrototypeOf(value) === Object.prototype;

export const sessionKeyToBuffer = sessionKey => Buffer.from(sessionKey.toString(16), 'hex');

export const generateSignature = (secret, method, uri, timestamp, body) => {
  const url = new URL(uri, 'http://localhost');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${method.toUpperCase()}${url.pathname}${url.search}${timestamp}`);
  if (body && !isEmptyObject(body)) {
    hmac.update(Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
  }
  return hmac.digest('hex');
};

const responseData = async response => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const errorDetails = (status, data) => {
  const nested =
    data && typeof data === 'object' && 'error' in data && typeof data.error === 'object'
      ? data.error
      : undefined;
  const message =
    (nested && typeof nested.message === 'string' && nested.message) ||
    (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
      ? data.message
      : undefined) ||
    (typeof data === 'string' && data) ||
    `HTTP ${status}`;
  return {
    code: (nested && typeof nested.code === 'string' && nested.code) || 'http_error',
    message,
    reauthenticateRequired: Boolean(nested?.reauthenticateRequired),
  };
};

export class GmibApiError extends Error {
  constructor(message, { code = 'client_error', status, reauthenticateRequired = false } = {}) {
    super(message);
    this.name = 'GmibApiError';
    this.code = code;
    this.status = status;
    this.reauthenticateRequired = reauthenticateRequired;
  }
}

const normalizeBaseUrl = value => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new GmibApiError('Некорректный URL GMIB', { code: 'invalid_url' });
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new GmibApiError('URL GMIB должен использовать HTTP(S) и не содержать credentials', {
      code: 'invalid_url',
    });
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new GmibApiError('Укажите origin GMIB без пути, query и fragment', {
      code: 'invalid_url',
    });
  }
  return url;
};

export class GmibApiClient {
  constructor({ baseUrl, clientId, password, timeoutMs = 10_000, fetchImpl = globalThis.fetch }) {
    if (!CLIENT_ID_PATTERN.test(clientId ?? '')) {
      throw new GmibApiError('clientId должен содержать 1-128 символов A-Z, a-z, 0-9, _ или -', {
        code: 'invalid_client_id',
      });
    }
    if (typeof password !== 'string' || password.length === 0) {
      throw new GmibApiError('Пароль не задан', { code: 'password_required' });
    }
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > MAX_TIMEOUT_MS) {
      throw new GmibApiError(`timeoutMs должен быть целым числом от 100 до ${MAX_TIMEOUT_MS}`, {
        code: 'invalid_timeout',
      });
    }
    if (typeof fetchImpl !== 'function') {
      throw new GmibApiError('Fetch API недоступен', { code: 'fetch_unavailable' });
    }
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.clientId = clientId;
    this.password = password;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
    this.secret = undefined;
    this.serverId = undefined;
  }

  clearSession() {
    this.secret?.fill(0);
    this.secret = undefined;
  }

  url(path) {
    if (typeof path !== 'string' || (!path.startsWith('/api/') && path !== '/api')) {
      throw new GmibApiError('API path должен начинаться с /api/', { code: 'invalid_path' });
    }
    const url = new URL(path, this.baseUrl);
    if (url.origin !== this.baseUrl.origin || url.hash) {
      throw new GmibApiError('API path должен относиться к указанному GMIB', {
        code: 'invalid_path',
      });
    }
    return url;
  }

  async fetch(url, init = {}) {
    try {
      return await this.fetchImpl(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new GmibApiError(`GMIB не ответил за ${this.timeoutMs} мс`, {
          code: 'request_timeout',
        });
      }
      throw new GmibApiError('Не удалось выполнить запрос к GMIB', {
        code: 'network_error',
      });
    }
  }

  async expectOk(response) {
    let data;
    try {
      data = await responseData(response);
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new GmibApiError(`GMIB не завершил ответ за ${this.timeoutMs} мс`, {
          code: 'request_timeout',
        });
      }
      throw new GmibApiError('Не удалось прочитать ответ GMIB', {
        code: 'response_read_error',
      });
    }
    if (response.ok) return { data, status: response.status };
    const details = errorDetails(response.status, data);
    throw new GmibApiError(details.message, { ...details, status: response.status });
  }

  async login({ force = false } = {}) {
    if (this.secret && !force) return { serverId: this.serverId };
    this.clearSession();

    const identifierResponse = await this.fetch(this.url('/api/identifier'));
    const identifierResult = await this.expectOk(identifierResponse);
    if (typeof identifierResult.data !== 'string' || identifierResult.data.length === 0) {
      throw new GmibApiError('GMIB вернул некорректный identifier', {
        code: 'invalid_server_identifier',
      });
    }

    const routines = new SRPRoutines(new SRPParameters());
    const client = new SRPClientSession(routines);
    const first = await client.step1('gmib', this.password);
    const handshakeResponse = await this.fetch(
      this.url(`/api/handshake/${encodeURIComponent(this.clientId)}`),
      { cache: 'no-store' },
    );
    const { data: challenge } = await this.expectOk(handshakeResponse);
    if (
      !challenge ||
      typeof challenge !== 'object' ||
      typeof challenge.salt !== 'string' ||
      typeof challenge.B !== 'string'
    ) {
      throw new GmibApiError('GMIB вернул некорректный SRP challenge', {
        code: 'invalid_handshake',
      });
    }

    let proof;
    try {
      proof = await first.step2(BigInt(challenge.salt), BigInt(challenge.B));
    } catch {
      throw new GmibApiError('Не удалось обработать SRP challenge', {
        code: 'invalid_handshake',
      });
    }
    const loginBody = {
      A: `0x${proof.A.toString(16)}`,
      M1: `0x${proof.M1.toString(16)}`,
    };
    const loginResponse = await this.fetch(
      this.url(`/api/login/${encodeURIComponent(this.clientId)}`),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(loginBody),
      },
    );
    const { data: login } = await this.expectOk(loginResponse);
    if (!login || typeof login !== 'object' || typeof login.M2 !== 'string') {
      throw new GmibApiError('GMIB вернул некорректное SRP-доказательство', {
        code: 'invalid_server_proof',
      });
    }
    try {
      await proof.step3(BigInt(login.M2));
    } catch {
      throw new GmibApiError('SRP-доказательство сервера не совпало', {
        code: 'server_proof_mismatch',
      });
    }
    this.secret = sessionKeyToBuffer(proof.S);
    this.serverId = identifierResult.data;
    return { serverId: this.serverId };
  }

  async signedRequest(path, { body, method = 'GET' } = {}) {
    if (!this.secret) throw new GmibApiError('Сессия не установлена', { code: 'session_required' });
    const url = this.url(path);
    const normalizedMethod = method.toUpperCase();
    const timestamp = Date.now();
    const headers = {
      'x-ni-identifier': this.clientId,
      'x-ni-timestamp': String(timestamp),
      'x-ni-signature': generateSignature(this.secret, normalizedMethod, url, timestamp, body),
    };
    const hasBody = body !== undefined;
    if (hasBody) headers['content-type'] = 'application/json';
    return this.fetch(url, {
      method: normalizedMethod,
      headers,
      ...(hasBody ? { body: JSON.stringify(body) } : {}),
    });
  }

  async request(path, options = {}) {
    await this.login();
    let response = await this.signedRequest(path, options);
    let authChallenge = false;
    if (response.status === 401) {
      try {
        const data = await response.clone().json();
        authChallenge =
          data &&
          typeof data === 'object' &&
          Object.keys(data).length === 1 &&
          typeof data.identifier === 'string' &&
          data.identifier.length > 0;
      } catch {
        authChallenge = false;
      }
    }
    if (authChallenge) {
      await this.login({ force: true });
      response = await this.signedRequest(path, options);
    }
    const result = await this.expectOk(response);
    return { ...result, serverId: this.serverId };
  }

  async rotatePassword(newPassword) {
    if (typeof newPassword !== 'string' || newPassword.length === 0) {
      throw new GmibApiError('Новый пароль не задан', { code: 'new_password_required' });
    }
    const routines = new SRPRoutines(new SRPParameters());
    const { s, v } = await createVerifierAndSalt(routines, 'gmib', newPassword);
    try {
      const result = await this.request('/api/manage/v1/auth/password', {
        method: 'PUT',
        body: { salt: `0x${s.toString(16)}`, verifier: `0x${v.toString(16)}` },
      });
      this.password = newPassword;
      this.clearSession();
      return result;
    } catch (error) {
      if (error instanceof GmibApiError && error.code === 'revocation_incomplete') {
        this.password = newPassword;
        this.clearSession();
      }
      throw error;
    }
  }
}
