/** Read only known diagnostic fields: never stringify request/response objects. */
function read(value: object, key: string): unknown {
  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
}

function sanitize(text: string): string {
  // Keep only origins: paths can themselves contain access tokens.
  return text
    .replace(/\b[a-z][a-z\d+.-]*:\/\/[^\s<>"'`]+/gi, url => {
      try {
        const parsed = new URL(url);
        return parsed.origin === 'null' ? '[URL скрыт]' : parsed.origin;
      } catch {
        return '[URL скрыт]';
      }
    })
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 500);
}

/** A bounded, credential-safe diagnostic for both Chromium and Node fetch errors. */
export function formatNetworkError(error: unknown): string {
  const seen = new Set<object>();
  const details = new Set<string>();
  const hints = new Set<string>();
  let remaining = 24;

  function visit(value: unknown, depth: number): void {
    if (remaining <= 0 || depth > 6) return;
    remaining -= 1;
    if (typeof value === 'string') {
      add(value);
      return;
    }
    if (value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    const message = read(value, 'message');
    const code = read(value, 'code');
    const name = read(value, 'name');
    if (typeof message === 'string') add(message);
    // Codes are diagnostics, not free-form payloads.
    if (typeof code === 'string' && /^(?:net::)?[A-Z][A-Z\d_:-]{1,79}$/.test(code)) add(code);
    if (name === 'AbortError' || name === 'TimeoutError') add(name);
    visit(read(value, 'cause'), depth + 1);
    const errors = read(value, 'errors');
    if (Array.isArray(errors)) {
      for (let index = 0; index < Math.min(errors.length, 24) && remaining > 0; index += 1) {
        visit(read(errors, String(index)), depth + 1);
      }
    }
  }

  function add(raw: string): void {
    const text = sanitize(raw).trim();
    if (!text) return;
    details.add(text);
    const diagnostic = text.toUpperCase();
    if (/ENOTFOUND|EAI_AGAIN|ERR_NAME_NOT_RESOLVED|ERR_DNS_|GETADDRINFO/.test(diagnostic)) {
      hints.add('Не удалось определить адрес сервера (DNS).');
    }
    if (
      /CERT_|CERTIFICATE|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_SSL_|ERR_TLS_|TLS|SSL/.test(diagnostic)
    ) {
      hints.add('Ошибка защищённого соединения: проверьте сертификат и дату на компьютере.');
    }
    if (/PROXY|ERR_TUNNEL_CONNECTION_FAILED/.test(diagnostic)) {
      hints.add('Проверьте настройки и доступность прокси-сервера.');
    }
    if (/TIMED?[\s_]?OUT|ETIMEDOUT|ETIMEOUT|UND_ERR_.*TIMEOUT|TIMEOUTERROR/.test(diagnostic)) {
      hints.add('Превышено время ожидания ответа сервера.');
    }
    if (/ECONNREFUSED|ERR_CONNECTION_REFUSED/.test(diagnostic)) {
      hints.add('Сервер отклонил соединение.');
    }
    if (/ECONNRESET|EPIPE|UND_ERR_SOCKET|ERR_CONNECTION_(RESET|CLOSED|ABORTED)/.test(diagnostic)) {
      hints.add('Соединение с сервером было прервано.');
    }
    if (
      /ERR_(INTERNET_DISCONNECTED|ADDRESS_UNREACHABLE|NETWORK_CHANGED)|ENETUNREACH|EHOSTUNREACH/.test(
        diagnostic,
      )
    ) {
      hints.add('Проверьте подключение к сети и доступность сервера.');
    }
    if (/ABORTERROR|ERR_ABORTED|ABORT_ERR|OPERATION WAS ABORTED/.test(diagnostic)) {
      hints.add('Запрос отменён.');
    }
  }

  visit(error, 0);
  return [...hints, ...details].join(' ') || 'Неизвестная сетевая ошибка';
}
