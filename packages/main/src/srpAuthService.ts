import type { SRPServerSessionStep1 } from '@sarakusha/tssrp6a';
import { SRPParameters, SRPRoutines, SRPServerSession } from '@sarakusha/tssrp6a';

import type { RemoteAuthCredentials } from '/@common/helpers';

const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const INTEGER_PATTERN = /^(?:0x[0-9a-f]+|[0-9]+)$/i;
const CREDENTIAL_PATTERN = /^0x[0-9a-f]+$/i;
const MAX_PUBLIC_VALUE_LENGTH = 514;
const MAX_EVIDENCE_LENGTH = 130;
const MAX_SALT_LENGTH = 258;

export class SrpAuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly reauthenticateRequired = false,
  ) {
    super(message);
  }
}

type CredentialStore = {
  get: () => Promise<RemoteAuthCredentials>;
  set: (credentials: RemoteAuthCredentials) => Promise<void>;
};

type IncomingSecretStore = {
  set: (id: string, secret: bigint, revision: number) => Promise<unknown>;
  revokeAll: () => Promise<unknown>;
};

type PendingHandshake = {
  expiresAt: number;
  revision: number;
  session: SRPServerSessionStep1;
  token: symbol;
};

export type SrpAuthServiceOptions = {
  credentials: CredentialStore;
  incomingSecrets: IncomingSecretStore;
  handshakeTtlMs?: number;
  maxPendingHandshakes?: number;
  now?: () => number;
};

const parseInteger = (value: unknown, field: string, maxLength: number): bigint => {
  if (typeof value !== 'string' || value.length > maxLength || !INTEGER_PATTERN.test(value)) {
    throw new SrpAuthError(400, 'invalid_request', `Недопустимое поле ${field}`);
  }
  try {
    return BigInt(value);
  } catch {
    throw new SrpAuthError(400, 'invalid_request', `Недопустимое поле ${field}`);
  }
};

const parseCredential = (value: unknown, field: string, maxLength: number): bigint => {
  if (typeof value !== 'string' || value.length > maxLength || !CREDENTIAL_PATTERN.test(value)) {
    throw new SrpAuthError(400, 'invalid_request', `Недопустимое поле ${field}`);
  }
  return parseInteger(value, field, maxLength);
};

const validateClientId = (id: string): void => {
  if (!CLIENT_ID_PATTERN.test(id)) {
    throw new SrpAuthError(400, 'invalid_client_id', 'Недопустимый идентификатор клиента');
  }
};

export class SrpAuthService {
  private readonly routines = new SRPRoutines(new SRPParameters());

  private readonly pending = new Map<string, PendingHandshake>();

  private readonly handshakeTtlMs: number;

  private readonly maxPendingHandshakes: number;

  private readonly now: () => number;

  private rotationTail: Promise<void> = Promise.resolve();

  private readonly handshakesInProgress = new Set<string>();

  constructor(private readonly options: SrpAuthServiceOptions) {
    this.handshakeTtlMs = options.handshakeTtlMs ?? 10_000;
    this.maxPendingHandshakes = options.maxPendingHandshakes ?? 256;
    this.now = options.now ?? Date.now;
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [id, handshake] of this.pending) {
      if (handshake.expiresAt <= now) this.pending.delete(id);
    }
  }

  async createHandshake(id: string): Promise<{ id: string; salt: string; B: string }> {
    validateClientId(id);
    this.pruneExpired();
    if (this.handshakesInProgress.has(id)) {
      throw new SrpAuthError(409, 'handshake_in_progress', 'Подключение уже создаётся');
    }
    if (
      !this.pending.has(id) &&
      this.pending.size + this.handshakesInProgress.size >= this.maxPendingHandshakes
    ) {
      throw new SrpAuthError(429, 'too_many_handshakes', 'Слишком много незавершённых подключений');
    }

    this.handshakesInProgress.add(id);
    try {
      const credentials = await this.options.credentials.get();
      const server = new SRPServerSession(this.routines);
      const session = await server.step1(
        'gmib',
        parseCredential(credentials.salt, 'salt', MAX_SALT_LENGTH),
        parseCredential(credentials.verifier, 'verifier', MAX_PUBLIC_VALUE_LENGTH),
      );
      const token = Symbol(id);
      this.pending.set(id, {
        expiresAt: this.now() + this.handshakeTtlMs,
        revision: credentials.revision,
        session,
        token,
      });
      const timeout = setTimeout(() => {
        if (this.pending.get(id)?.token === token) this.pending.delete(id);
      }, this.handshakeTtlMs);
      timeout.unref();
      return { id, salt: credentials.salt, B: `0x${session.B.toString(16)}` };
    } finally {
      this.handshakesInProgress.delete(id);
    }
  }

  async completeLogin(id: string, body: unknown): Promise<{ M2: string }> {
    validateClientId(id);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new SrpAuthError(400, 'invalid_request', 'Некорректное тело запроса');
    }
    const data = body as Record<string, unknown>;
    if ('salt' in data || 'verifier' in data) {
      throw new SrpAuthError(
        400,
        'password_rotation_moved',
        'Для смены пароля используйте PUT /api/manage/v1/auth/password',
      );
    }
    const A = parseInteger(data.A, 'A', MAX_PUBLIC_VALUE_LENGTH);
    const M1 = parseInteger(data.M1, 'M1', MAX_EVIDENCE_LENGTH);
    if (!this.routines.isValidPublicValue(A)) {
      throw new SrpAuthError(400, 'invalid_request', 'Недопустимое поле A');
    }

    this.pruneExpired();
    const pending = this.pending.get(id);
    if (!pending) throw new SrpAuthError(404, 'handshake_not_found', 'Подключение не найдено');
    this.pending.delete(id);
    if (pending.expiresAt <= this.now()) {
      throw new SrpAuthError(404, 'handshake_not_found', 'Подключение не найдено');
    }

    const before = await this.options.credentials.get();
    if (before.revision !== pending.revision) {
      throw new SrpAuthError(409, 'credentials_changed', 'Учётные данные были изменены', true);
    }

    let M2: bigint;
    let apiSecret: bigint;
    try {
      M2 = await pending.session.step2(A, M1);
      apiSecret = await pending.session.sessionKey(A);
    } catch {
      throw new SrpAuthError(401, 'authentication_failed', 'Ошибка аутентификации');
    }

    const after = await this.options.credentials.get();
    if (after.revision !== pending.revision) {
      throw new SrpAuthError(409, 'credentials_changed', 'Учётные данные были изменены', true);
    }
    await this.options.incomingSecrets.set(id, apiSecret, pending.revision);
    return { M2: `0x${M2.toString(16)}` };
  }

  rotateCredentials(
    body: unknown,
    authorizedRevision?: number,
  ): Promise<{ reauthenticateRequired: true }> {
    const execute = () => this.rotateCredentialsImpl(body, authorizedRevision);
    const result = this.rotationTail.then(execute, execute);
    this.rotationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async rotateCredentialsImpl(
    body: unknown,
    authorizedRevision?: number,
  ): Promise<{ reauthenticateRequired: true }> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new SrpAuthError(400, 'invalid_request', 'Некорректное тело запроса');
    }
    const data = body as Record<string, unknown>;
    if (Object.keys(data).some(key => key !== 'salt' && key !== 'verifier')) {
      throw new SrpAuthError(400, 'invalid_request', 'Запрос содержит неподдерживаемые поля');
    }
    const salt = parseCredential(data.salt, 'salt', MAX_SALT_LENGTH);
    const verifier = parseCredential(data.verifier, 'verifier', MAX_PUBLIC_VALUE_LENGTH);
    const modulus = this.routines.parameters.primeGroup.N;
    if (salt <= 0n || verifier <= 1n || verifier >= modulus) {
      throw new SrpAuthError(400, 'invalid_request', 'Недопустимые параметры SRP');
    }

    const current = await this.options.credentials.get();
    if (authorizedRevision !== undefined && current.revision !== authorizedRevision) {
      throw new SrpAuthError(409, 'authorization_stale', 'Авторизация была отозвана', true);
    }
    if (!Number.isSafeInteger(current.revision + 1)) {
      throw new SrpAuthError(500, 'rotation_failed', 'Не удалось сменить пароль');
    }
    const next: RemoteAuthCredentials = {
      salt: `0x${salt.toString(16)}`,
      verifier: `0x${verifier.toString(16)}`,
      revision: current.revision + 1,
    };

    try {
      await this.options.credentials.set(next);
    } catch {
      throw new SrpAuthError(500, 'rotation_failed', 'Не удалось сохранить новый пароль');
    }

    this.pending.clear();
    try {
      await this.options.incomingSecrets.revokeAll();
    } catch {
      throw new SrpAuthError(
        500,
        'revocation_incomplete',
        'Пароль изменён, но очистка сохранённых подключений завершилась ошибкой',
        true,
      );
    }
    return { reauthenticateRequired: true };
  }
}
