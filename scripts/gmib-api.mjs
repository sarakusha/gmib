#!/usr/bin/env node

import { lstatSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { GmibApiClient, GmibApiError } from './gmib-api-client.mjs';

const HELP = `Usage:
  node scripts/gmib-api.mjs login [options]
  node scripts/gmib-api.mjs request --method METHOD --path /api/... [options]
  node scripts/gmib-api.mjs password-set [options]

Connection:
  --base-url URL            GMIB origin, or GMIB_BASE_URL
  --client-id ID            Stable client id, or GMIB_CLIENT_ID
  --timeout-ms MS           Per-request timeout (default: 10000)

Current password (choose one; defaults to env GMIB_PASSWORD):
  --password-env NAME
  --password-file FILE      File must not be accessible by group/other users
  --password-stdin

Request:
  --method METHOD           Default: GET
  --path PATH               Must start with /api/
  --body-file FILE          JSON request body
  --body-stdin              JSON request body from stdin

New password for password-set (choose one):
  --new-password-env NAME
  --new-password-file FILE
  --new-password-stdin

Other:
  --check                   Skip mutating requests
  --help
`;

const booleanOptions = new Set([
  'body-stdin',
  'check',
  'help',
  'new-password-stdin',
  'password-stdin',
]);
const valueOptions = new Set([
  'base-url',
  'body-file',
  'client-id',
  'method',
  'new-password-env',
  'new-password-file',
  'password-env',
  'password-file',
  'path',
  'timeout-ms',
]);
const requestMethods = new Set(['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT']);

const parseArgs = argv => {
  const [command, ...rest] = argv;
  const options = {};
  const seen = new Set();
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      throw new GmibApiError(`Неожиданный аргумент: ${token}`, { code: 'invalid_arguments' });
    }
    const name = token.slice(2);
    if (!booleanOptions.has(name) && !valueOptions.has(name)) {
      throw new GmibApiError(`Неизвестная опция: --${name}`, { code: 'invalid_arguments' });
    }
    if (seen.has(name)) {
      throw new GmibApiError(`Опция --${name} указана несколько раз`, {
        code: 'invalid_arguments',
      });
    }
    seen.add(name);
    if (booleanOptions.has(name)) {
      options[name] = true;
      continue;
    }
    const value = rest[index + 1];
    if (!value || value.startsWith('--')) {
      throw new GmibApiError(`Не задано значение --${name}`, { code: 'invalid_arguments' });
    }
    options[name] = value;
    index += 1;
  }
  return { command, options };
};

let stdinPromise;
let stdinConsumer;

const readStdin = consumer => {
  if (stdinConsumer && stdinConsumer !== consumer) {
    throw new GmibApiError('stdin можно использовать только для одного входного значения', {
      code: 'stdin_conflict',
    });
  }
  stdinConsumer = consumer;
  stdinPromise ??= new Promise((resolve, reject) => {
    let value = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      value += chunk;
    });
    process.stdin.once('end', () => resolve(value));
    process.stdin.once('error', reject);
  });
  return stdinPromise;
};

const readProtectedFile = filename => {
  let stat;
  try {
    stat = lstatSync(filename);
  } catch {
    throw new GmibApiError('Не удалось открыть файл пароля', {
      code: 'password_file_error',
    });
  }
  if (!stat.isFile()) {
    throw new GmibApiError('Файл пароля должен быть обычным файлом', {
      code: 'unsafe_password_file',
    });
  }
  if ((stat.mode & 0o077) !== 0) {
    throw new GmibApiError(
      'Файл пароля доступен группе или другим пользователям; выполните chmod 600',
      {
        code: 'unsafe_password_file',
      },
    );
  }
  try {
    return readFileSync(filename, 'utf8');
  } catch {
    throw new GmibApiError('Не удалось прочитать файл пароля', {
      code: 'password_file_error',
    });
  }
};

const normalizeSecret = (value, label) => {
  const result = value.replace(/\r?\n$/, '');
  if (!result) throw new GmibApiError(`${label} не задан`, { code: 'password_required' });
  return result;
};

const readSecret = async (options, prefix, defaultEnvironmentName) => {
  const sources = [
    options[`${prefix}-env`] && ['env', options[`${prefix}-env`]],
    options[`${prefix}-file`] && ['file', options[`${prefix}-file`]],
    options[`${prefix}-stdin`] && ['stdin'],
  ].filter(Boolean);
  if (sources.length > 1) {
    throw new GmibApiError(`Укажите один источник --${prefix}-*`, {
      code: 'invalid_arguments',
    });
  }
  const [kind, value] = sources[0] ?? ['env', defaultEnvironmentName];
  if (kind === 'env') {
    return normalizeSecret(
      process.env[value] ?? '',
      prefix === 'password' ? 'Пароль' : 'Новый пароль',
    );
  }
  if (kind === 'file') {
    return normalizeSecret(
      readProtectedFile(value),
      prefix === 'password' ? 'Пароль' : 'Новый пароль',
    );
  }
  return normalizeSecret(
    await readStdin(prefix),
    prefix === 'password' ? 'Пароль' : 'Новый пароль',
  );
};

const readBody = async options => {
  if (options['body-file'] && options['body-stdin']) {
    throw new GmibApiError('Укажите только один источник body', { code: 'invalid_arguments' });
  }
  if (!options['body-file'] && !options['body-stdin']) return undefined;
  let raw;
  try {
    raw = options['body-file']
      ? readFileSync(options['body-file'], 'utf8')
      : await readStdin('body');
  } catch {
    throw new GmibApiError('Не удалось прочитать JSON body', { code: 'body_read_error' });
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new GmibApiError('Тело запроса должно быть корректным JSON', {
      code: 'invalid_json_body',
    });
  }
};

const writeResult = value => process.stdout.write(`${JSON.stringify(value)}\n`);

const skippedCheckResult = command => ({
  ok: true,
  changed: false,
  checkMode: true,
  skipped: true,
  command,
});

export const main = async (argv = process.argv.slice(2)) => {
  const { command, options } = parseArgs(argv);
  if (options.help || command === '--help' || !command) {
    process.stdout.write(HELP);
    return;
  }
  if (!['login', 'password-set', 'request'].includes(command)) {
    throw new GmibApiError(`Неизвестная команда: ${command}`, { code: 'invalid_arguments' });
  }

  const method = String(options.method ?? 'GET').toUpperCase();
  if (command === 'request' && !requestMethods.has(method)) {
    throw new GmibApiError(`Неподдерживаемый HTTP-метод: ${method}`, {
      code: 'invalid_arguments',
    });
  }
  if (command === 'request' && !options.path) {
    throw new GmibApiError('--path обязателен', { code: 'invalid_arguments' });
  }
  if (options.check && (command === 'password-set' || !['GET', 'HEAD'].includes(method))) {
    writeResult(skippedCheckResult(command));
    return;
  }

  const baseUrl = options['base-url'] ?? process.env.GMIB_BASE_URL;
  const clientId = options['client-id'] ?? process.env.GMIB_CLIENT_ID;
  const timeoutMs = Number(options['timeout-ms'] ?? 10_000);
  const password = await readSecret(options, 'password', 'GMIB_PASSWORD');
  const client = new GmibApiClient({ baseUrl, clientId, password, timeoutMs });

  if (command === 'login') {
    const result = await client.login();
    writeResult({ ok: true, authenticated: true, ...result });
    client.clearSession();
    return;
  }
  if (command === 'request') {
    const path = options.path;
    const body = await readBody(options);
    const result = await client.request(path, { method, body });
    writeResult({ ok: true, ...result });
    client.clearSession();
    return;
  }

  const newPassword = await readSecret(options, 'new-password', 'GMIB_NEW_PASSWORD');
  const result = await client.rotatePassword(newPassword);
  writeResult({ ok: true, changed: true, ...result });
};

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch(error => {
    const known = error instanceof GmibApiError ? error : undefined;
    const result = {
      ok: false,
      error: {
        code: known?.code ?? 'internal_error',
        message: known?.message ?? 'Внутренняя ошибка helper',
        ...(known?.status ? { status: known.status } : {}),
        ...(known?.reauthenticateRequired ? { reauthenticateRequired: true } : {}),
      },
    };
    writeResult(result);
    process.stderr.write(`gmib-api: ${result.error.message}\n`);
    process.exitCode = known?.status === 401 ? 3 : 2;
  });
}
