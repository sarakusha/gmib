#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { GmibApiClient, GmibApiError } from './gmib-api-client.mjs';

const RESOURCE_TYPES = new Set([
  'screen',
  'player',
  'playlist',
  'mapping',
  'scheduler',
  'gmib-scheduler',
]);

const HELP = `Usage:
  node scripts/gmib-api-resources.mjs ensure --type TYPE --desired-file FILE [options]
  node scripts/gmib-api-resources.mjs ensure --type TYPE --desired-stdin [options]

Types:
  screen, player, playlist, mapping, scheduler, gmib-scheduler

Connection:
  --base-url URL            GMIB origin, or GMIB_BASE_URL
  --client-id ID            Stable client id, or GMIB_CLIENT_ID
  --timeout-ms MS           Per-request timeout (default: 10000)

Password (choose one; defaults to GMIB_PASSWORD):
  --password-env NAME
  --password-file FILE      File must not be accessible by group/other users
  --password-stdin

Other:
  --check                   Read and predict changes without configuration writes
  --help
`;

const definitions = {
  screen: {
    listPath: '/api/screen',
    itemPath: id => `/api/screen/${encodeURIComponent(id)}`,
    createPath: '/api/screen',
    updatePath: '/api/screen',
    deletePath: id => `/api/screen/${encodeURIComponent(id)}`,
    idType: 'number',
    fields: [
      'name',
      'width',
      'height',
      'moduleWidth',
      'moduleHeight',
      'left',
      'top',
      'display',
      'addresses',
      'downToTop',
      'rightToLeft',
      'borderTop',
      'borderBottom',
      'borderLeft',
      'borderRight',
      'brightnessFactor',
      'test',
      'brightness',
      'useExternalKnob',
      'outputTransparent',
      'zIndex',
    ],
    createFields: [
      'name',
      'width',
      'height',
      'moduleWidth',
      'moduleHeight',
      'left',
      'top',
      'display',
      'downToTop',
      'rightToLeft',
      'borderTop',
      'borderBottom',
      'borderLeft',
      'borderRight',
      'brightnessFactor',
      'test',
      'useExternalKnob',
      'outputTransparent',
      'zIndex',
    ],
  },
  player: {
    listPath: '/api/player',
    itemPath: id => `/api/player/${encodeURIComponent(id)}`,
    createPath: '/api/player',
    updatePath: '/api/player',
    deletePath: id => `/api/player/${encodeURIComponent(id)}`,
    idType: 'number',
    fields: [
      'name',
      'playlistId',
      'current',
      'width',
      'height',
      'autoPlay',
      'disableFadeIn',
      'disableFadeOut',
      'playbackEngine',
      'hidden',
    ],
  },
  playlist: {
    listPath: '/api/playlist',
    itemPath: id => `/api/playlist/${encodeURIComponent(id)}`,
    createPath: '/api/playlist',
    updatePath: '/api/playlist',
    deletePath: id => `/api/playlist/${encodeURIComponent(id)}`,
    idType: 'number',
    fields: ['name', 'flags', 'items'],
  },
  mapping: {
    listPath: '/api/mapping',
    itemPath: undefined,
    createPath: '/api/mapping',
    updatePath: '/api/mapping',
    deletePath: id => `/api/mapping/${encodeURIComponent(id)}`,
    idType: 'number',
    fields: [
      'name',
      'player',
      'width',
      'height',
      'left',
      'top',
      'display',
      'kiosk',
      'zIndex',
      'shader',
      'transparent',
      'alwaysOnTop',
      'objectFit',
    ],
  },
  scheduler: {
    listPath: '/api/scheduler',
    createPath: '/api/scheduler',
    updatePath: id => `/api/scheduler/${encodeURIComponent(id)}`,
    deletePath: id => `/api/scheduler/${encodeURIComponent(id)}`,
    idType: 'string',
    fields: [
      'id',
      'kind',
      'name',
      'runAt',
      'cron',
      'enabled',
      'priority',
      'playerId',
      'action',
      'playlistId',
      'itemNumber',
      'hideOutputOnStop',
      'outputAll',
    ],
  },
  'gmib-scheduler': {
    listPath: '/api/gmib-scheduler',
    createPath: '/api/gmib-scheduler',
    updatePath: id => `/api/gmib-scheduler/${encodeURIComponent(id)}`,
    deletePath: id => `/api/gmib-scheduler/${encodeURIComponent(id)}`,
    idType: 'string',
    fields: [
      'id',
      'kind',
      'name',
      'runAt',
      'cron',
      'enabled',
      'priority',
      'action',
      'screenId',
      'testId',
      'brightness',
      'enabledValue',
    ],
  },
};

const defaultSeconds = () => ({ mode: 'select', every: 1, selected: [0] });
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const isOptionalFiniteNumber = value => value === null || isFiniteNumber(value);
const isPositiveInteger = value => Number.isSafeInteger(value) && value > 0;

export class GmibApiResourceError extends GmibApiError {
  constructor(message, { code = 'invalid_resource', ...details } = {}) {
    super(message, { code, ...details });
    Object.assign(this, details);
  }
}

const fail = (message, code = 'invalid_resource') => {
  throw new GmibApiResourceError(message, { code });
};

const requestData = async (client, path, options) => {
  const result = await client.request(path, options);
  if (!isObject(result) || !hasOwn(result, 'data')) {
    fail('Клиент вернул некорректный результат API', 'invalid_client_result');
  }
  return result.data;
};

const listResources = async (client, definition) => {
  const result = await requestData(client, definition.listPath);
  if (!Array.isArray(result)) fail('GMIB вернул некорректный список ресурсов', 'invalid_response');
  return result;
};

const validateIdentifier = (type, definition, value) => {
  if (definition.idType === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) {
      fail(`${type}: id должен быть положительным целым числом`, 'invalid_identifier');
    }
  } else if (typeof value !== 'string' || value.length === 0) {
    fail(`${type}: id должен быть непустой строкой`, 'invalid_identifier');
  }
};

const normalizeSelected = (selected, name, min, max) => {
  if (
    !Array.isArray(selected) ||
    selected.some(value => !Number.isSafeInteger(value) || value < min || value > max)
  ) {
    fail(`${name}.selected должен содержать целые числа ${min}..${max}`, 'invalid_cron');
  }
  return Array.from(new Set(selected)).sort((a, b) => a - b);
};

const normalizeCronPart = (value, name, modes, min, max, fallback) => {
  const source = value ?? fallback;
  if (!isObject(source) || !modes.includes(source.mode)) {
    fail(`${name} содержит неподдерживаемый режим`, 'invalid_cron');
  }
  const allowed = new Set(
    modes.includes('every') ? ['mode', 'every', 'selected'] : ['mode', 'selected'],
  );
  if (Object.keys(source).some(key => !allowed.has(key))) {
    fail(`${name} содержит неподдерживаемое поле`, 'invalid_cron');
  }
  const selected = normalizeSelected(source.selected, name, min, max);
  if (source.mode === 'select' && selected.length === 0) {
    fail(`${name}.selected не может быть пустым в режиме select`, 'invalid_cron');
  }
  if (modes.includes('every')) {
    if (!Number.isSafeInteger(source.every) || source.every <= 0) {
      fail('cron.every должен быть положительным целым числом', 'invalid_cron');
    }
    return { mode: source.mode, every: source.every, selected };
  }
  return { mode: source.mode, selected };
};

export const normalizeCron = value => {
  if (!isObject(value)) fail('cron должен быть объектом', 'invalid_cron');
  const allowed = new Set(['seconds', 'minutes', 'hours', 'days', 'months', 'weekdays']);
  if (Object.keys(value).some(key => !allowed.has(key))) {
    fail('cron содержит неподдерживаемое поле', 'invalid_cron');
  }
  return {
    seconds: normalizeCronPart(
      value.seconds,
      'seconds',
      ['all', 'every', 'select'],
      0,
      59,
      defaultSeconds(),
    ),
    minutes: normalizeCronPart(value.minutes, 'minutes', ['all', 'every', 'select'], 0, 59),
    hours: normalizeCronPart(value.hours, 'hours', ['all', 'every', 'select'], 0, 23),
    days: normalizeCronPart(value.days, 'days', ['all', 'select'], 1, 31),
    months: normalizeCronPart(value.months, 'months', ['all', 'select'], 1, 12),
    weekdays: normalizeCronPart(value.weekdays, 'weekdays', ['all', 'select'], 0, 6),
  };
};

const normalizeScheduler = (type, desired, { complete = false } = {}) => {
  if (complete) {
    for (const field of ['kind', 'name', 'enabled', 'priority', 'action']) {
      if (!hasOwn(desired, field)) fail(`${type}: требуется ${field}`, 'invalid_scheduler');
    }
  }
  if (hasOwn(desired, 'kind') && !['once', 'cron'].includes(desired.kind)) {
    fail('kind должен быть once или cron', 'invalid_scheduler');
  }
  if (hasOwn(desired, 'name') && (typeof desired.name !== 'string' || desired.name.length === 0)) {
    fail('name должен быть непустой строкой', 'invalid_scheduler');
  }
  if (hasOwn(desired, 'enabled') && typeof desired.enabled !== 'boolean') {
    fail('enabled имеет неверный тип', 'invalid_scheduler');
  }
  if (hasOwn(desired, 'priority')) {
    if (!Number.isFinite(desired.priority))
      fail('priority имеет неверный тип', 'invalid_scheduler');
    desired.priority = Math.trunc(desired.priority);
  }
  if (hasOwn(desired, 'runAt')) {
    if (typeof desired.runAt !== 'string' || Number.isNaN(new Date(desired.runAt).getTime())) {
      fail('runAt должен быть корректным временем', 'invalid_schedule_time');
    }
    desired.runAt = new Date(desired.runAt).toISOString();
  }
  if (hasOwn(desired, 'cron')) desired.cron = normalizeCron(desired.cron);
  if (complete && desired.kind === 'once') {
    if (!hasOwn(desired, 'runAt'))
      fail('once-задаче нужен корректный runAt', 'invalid_schedule_time');
    delete desired.cron;
  }
  if (complete && desired.kind === 'cron') {
    if (!hasOwn(desired, 'cron')) fail('cron-задаче нужен cron', 'invalid_cron');
    delete desired.runAt;
  }

  if (type === 'scheduler') {
    if (
      (complete || hasOwn(desired, 'playerId')) &&
      (!Number.isSafeInteger(desired.playerId) || desired.playerId <= 0)
    ) {
      fail('scheduler: требуется положительный playerId', 'invalid_scheduler');
    }
    const actions = [
      'load-playlist',
      'toggle-play',
      'play',
      'stop',
      'hide-output',
      'show-output',
      'next',
      'play-item',
    ];
    if (hasOwn(desired, 'action') && !actions.includes(desired.action))
      fail('scheduler: неизвестное action', 'invalid_scheduler');
    if (
      desired.action === 'load-playlist' &&
      (complete || hasOwn(desired, 'playlistId')) &&
      (!Number.isSafeInteger(desired.playlistId) || desired.playlistId <= 0)
    ) {
      fail('load-playlist требует playlistId', 'invalid_scheduler');
    }
    if (
      hasOwn(desired, 'itemNumber') &&
      (!Number.isSafeInteger(desired.itemNumber) || desired.itemNumber < 1)
    ) {
      fail('itemNumber должен быть положительным целым числом', 'invalid_scheduler');
    }
    return;
  }

  const actions = [
    'show-test',
    'hide-test',
    'set-brightness',
    'set-autobrightness',
    'set-overheat-protection',
  ];
  if (hasOwn(desired, 'action') && !actions.includes(desired.action))
    fail('gmib-scheduler: неизвестное action', 'invalid_scheduler');
  if (
    ['show-test', 'hide-test'].includes(desired.action) &&
    (complete || hasOwn(desired, 'screenId')) &&
    (!Number.isSafeInteger(desired.screenId) || desired.screenId <= 0)
  ) {
    fail(`${desired.action} требует screenId`, 'invalid_scheduler');
  }
  if (
    desired.action === 'show-test' &&
    (complete || hasOwn(desired, 'testId')) &&
    (typeof desired.testId !== 'string' || desired.testId.length === 0)
  ) {
    fail('show-test требует testId', 'invalid_scheduler');
  }
  if (desired.action === 'set-brightness' && (complete || hasOwn(desired, 'brightness'))) {
    if (!Number.isFinite(desired.brightness))
      fail('set-brightness требует brightness', 'invalid_scheduler');
    desired.brightness = Math.round(Math.max(0, Math.min(100, desired.brightness)));
  }
  if (
    ['set-autobrightness', 'set-overheat-protection'].includes(desired.action) &&
    (complete || hasOwn(desired, 'enabledValue')) &&
    typeof desired.enabledValue !== 'boolean'
  ) {
    fail(`${desired.action} требует enabledValue`, 'invalid_scheduler');
  }
};

const validateFields = (type, desired) => {
  const hasInvalid = (fields, predicate) =>
    fields.some(field => hasOwn(desired, field) && !predicate(desired[field]));
  if (type === 'screen') {
    if (hasOwn(desired, 'name') && (typeof desired.name !== 'string' || desired.name.length === 0))
      fail('screen.name имеет неверный тип', 'invalid_screen');
    if (
      hasInvalid(
        [
          'width',
          'height',
          'moduleWidth',
          'moduleHeight',
          'left',
          'top',
          'borderTop',
          'borderBottom',
          'borderLeft',
          'borderRight',
          'brightnessFactor',
          'brightness',
          'zIndex',
        ],
        isOptionalFiniteNumber,
      )
    )
      fail('screen содержит нечисловое поле', 'invalid_screen');
    if (
      hasOwn(desired, 'display') &&
      !(desired.display === null || Number.isSafeInteger(desired.display))
    )
      fail('screen.display имеет неверный тип', 'invalid_screen');
    if (
      hasInvalid(
        ['downToTop', 'rightToLeft', 'useExternalKnob', 'outputTransparent'],
        value => typeof value === 'boolean',
      )
    )
      fail('screen содержит неboolean поле', 'invalid_screen');
    if (
      hasOwn(desired, 'addresses') &&
      (!Array.isArray(desired.addresses) ||
        desired.addresses.some(address => typeof address !== 'string' || address.length === 0))
    )
      fail('screen.addresses имеет неверный тип', 'invalid_screen');
    if (hasOwn(desired, 'test') && !(desired.test === null || typeof desired.test === 'string'))
      fail('screen.test имеет неверный тип', 'invalid_screen');
    return;
  }
  if (type === 'player') {
    if (hasOwn(desired, 'name') && (typeof desired.name !== 'string' || desired.name.length === 0))
      fail('player.name имеет неверный тип', 'invalid_player');
    if (
      hasOwn(desired, 'playlistId') &&
      !(desired.playlistId === null || isPositiveInteger(desired.playlistId))
    )
      fail('player.playlistId имеет неверный тип', 'invalid_player');
    if (
      hasOwn(desired, 'current') &&
      !(desired.current === null || typeof desired.current === 'string')
    )
      fail('player.current имеет неверный тип', 'invalid_player');
    if (hasInvalid(['width', 'height'], isOptionalFiniteNumber))
      fail('player содержит нечисловое поле', 'invalid_player');
    if (
      hasInvalid(
        ['autoPlay', 'disableFadeIn', 'disableFadeOut', 'hidden'],
        value => typeof value === 'boolean',
      )
    )
      fail('player содержит неboolean поле', 'invalid_player');
    if (
      hasOwn(desired, 'playbackEngine') &&
      !['decoder', 'capture'].includes(desired.playbackEngine)
    )
      fail('player.playbackEngine имеет неверный тип', 'invalid_player');
    return;
  }
  if (type === 'playlist') {
    if (hasOwn(desired, 'name') && (typeof desired.name !== 'string' || desired.name.length === 0))
      fail('playlist.name имеет неверный тип', 'invalid_playlist');
    if (hasOwn(desired, 'flags') && !Number.isSafeInteger(desired.flags))
      fail('playlist.flags имеет неверный тип', 'invalid_playlist');
    if (
      hasOwn(desired, 'items') &&
      (!Array.isArray(desired.items) ||
        desired.items.some(
          item =>
            !isObject(item) ||
            typeof item.md5 !== 'string' ||
            item.md5.length === 0 ||
            (hasOwn(item, 'flags') && !Number.isSafeInteger(item.flags)) ||
            (hasOwn(item, 'start') && !isOptionalFiniteNumber(item.start)) ||
            (hasOwn(item, 'duration') && !isOptionalFiniteNumber(item.duration)),
        ))
    )
      fail('playlist.items имеет неверный тип', 'invalid_playlist');
    return;
  }
  if (type === 'mapping') {
    if (hasOwn(desired, 'name') && (typeof desired.name !== 'string' || desired.name.length === 0))
      fail('mapping.name имеет неверный тип', 'invalid_mapping');
    if (hasOwn(desired, 'player') && !isPositiveInteger(desired.player))
      fail('mapping.player имеет неверный тип', 'invalid_mapping');
    if (hasInvalid(['width', 'height', 'left', 'top', 'zIndex'], isOptionalFiniteNumber))
      fail('mapping содержит нечисловое поле', 'invalid_mapping');
    if (
      hasOwn(desired, 'display') &&
      !(desired.display === null || Number.isSafeInteger(desired.display))
    )
      fail('mapping.display имеет неверный тип', 'invalid_mapping');
    if (hasInvalid(['kiosk', 'transparent', 'alwaysOnTop'], value => typeof value === 'boolean'))
      fail('mapping содержит неboolean поле', 'invalid_mapping');
    if (
      hasOwn(desired, 'shader') &&
      !(desired.shader === null || typeof desired.shader === 'string')
    )
      fail('mapping.shader имеет неверный тип', 'invalid_mapping');
    if (
      hasOwn(desired, 'objectFit') &&
      !['fill', 'contain', 'cover', 'none', 'scale-down'].includes(desired.objectFit)
    )
      fail('mapping.objectFit имеет неверный тип', 'invalid_mapping');
  }
};

const validateCreate = (type, candidate) => {
  if (
    ['screen', 'player', 'playlist', 'mapping'].includes(type) &&
    typeof candidate.name !== 'string'
  ) {
    fail(`${type}: name обязателен при создании`, 'missing_create_name');
  }
  if (type === 'screen' && (!isFiniteNumber(candidate.left) || !isFiniteNumber(candidate.top))) {
    fail('screen: left и top обязательны при создании', 'invalid_screen');
  }
  if (type === 'playlist' && !Number.isSafeInteger(candidate.flags)) {
    fail('playlist: flags обязателен при создании', 'invalid_playlist');
  }
  if (type === 'mapping' && !isPositiveInteger(candidate.player)) {
    fail('mapping: player обязателен при создании', 'invalid_mapping');
  }
  if (type === 'screen' && candidate.useExternalKnob && candidate.brightnessFactor) {
    fail('screen: useExternalKnob несовместим с ненулевым brightnessFactor', 'invalid_screen');
  }
};

const validateEffective = (type, candidate) => {
  if (type === 'screen' && candidate.useExternalKnob && candidate.brightnessFactor) {
    fail('screen: useExternalKnob несовместим с ненулевым brightnessFactor', 'invalid_screen');
  }
};

export const normalizeDesired = (type, input) => {
  const definition = definitions[type];
  if (!definition) fail(`Неподдерживаемый тип ресурса: ${type}`, 'invalid_resource_type');
  if (!isObject(input)) fail('desired должен быть JSON-объектом', 'invalid_desired');
  const allowed = new Set(['state', 'id', ...definition.fields]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) fail(`${type}: поле ${key} не разрешено`, 'unsupported_field');
  }
  const desired = { ...input };
  const state = desired.state ?? 'present';
  if (!['present', 'absent'].includes(state))
    fail('state должен быть present или absent', 'invalid_state');
  desired.state = state;
  if (hasOwn(desired, 'id')) validateIdentifier(type, definition, desired.id);
  if (!hasOwn(desired, 'id') && (typeof desired.name !== 'string' || desired.name.length === 0)) {
    fail(`${type}: укажите id либо точное непустое name`, 'missing_selector');
  }
  if (state === 'absent') {
    for (const key of Object.keys(desired)) {
      if (!['state', 'id', 'name'].includes(key)) {
        fail('state: absent принимает только id или name', 'invalid_absent_resource');
      }
    }
    return desired;
  }
  validateFields(type, desired);
  if (type === 'scheduler' || type === 'gmib-scheduler') normalizeScheduler(type, desired);
  return desired;
};

const resolveResource = async (client, type, desired) => {
  const definition = definitions[type];
  const resources = await listResources(client, definition);
  let matches;
  if (hasOwn(desired, 'id')) {
    matches = resources.filter(resource => resource?.id === desired.id);
  } else {
    matches = resources.filter(resource => resource?.name === desired.name);
  }
  if (matches.length > 1) {
    fail(`${type}: найдено несколько ресурсов с указанным selector`, 'ambiguous_resource');
  }
  const resource = matches[0];
  if (!resource) return undefined;
  if (definition.itemPath) {
    const current = await requestData(client, definition.itemPath(resource.id));
    if (!isObject(current)) fail(`${type}: GMIB вернул некорректный ресурс`, 'invalid_response');
    return current;
  }
  return resource;
};

const requireReference = async (client, path, label) => {
  const resource = await requestData(client, path);
  if (!isObject(resource)) fail(`${label}: GMIB вернул некорректную ссылку`, 'invalid_reference');
};

const validateReferences = async (client, type, candidate, requested) => {
  if (type === 'screen' && hasOwn(requested, 'test') && requested.test) {
    const pages = await requestData(client, '/api/pages');
    if (!Array.isArray(pages) || !pages.some(page => page?.id === requested.test)) {
      fail('test с указанным id не найден', 'missing_reference');
    }
  }
  if (type === 'player' && hasOwn(requested, 'playlistId') && requested.playlistId != null) {
    if (!Number.isSafeInteger(requested.playlistId) || requested.playlistId <= 0)
      fail('playlistId имеет неверный вид', 'invalid_reference');
    await requireReference(client, `/api/playlist/${requested.playlistId}`, 'playlistId');
  }
  if (type === 'playlist' && hasOwn(requested, 'items')) {
    if (!Array.isArray(requested.items)) fail('items должен быть массивом', 'invalid_playlist');
    const media = await requestData(client, '/api/media');
    if (!Array.isArray(media)) fail('media: GMIB вернул некорректный список', 'invalid_response');
    const mediaIds = new Set(media.map(item => item?.md5));
    for (const item of requested.items) {
      if (!isObject(item) || typeof item.md5 !== 'string' || !mediaIds.has(item.md5)) {
        fail('playlist содержит отсутствующий media md5', 'missing_reference');
      }
    }
  }
  if (type === 'mapping') {
    if (!Number.isSafeInteger(candidate.player) || candidate.player <= 0)
      fail('mapping требует player', 'invalid_reference');
    await requireReference(client, `/api/player/${candidate.player}`, 'player');
  }
  if (type === 'scheduler') {
    await requireReference(client, `/api/player/${candidate.playerId}`, 'playerId');
    if (candidate.action === 'load-playlist') {
      await requireReference(client, `/api/playlist/${candidate.playlistId}`, 'playlistId');
    }
  }
  if (type === 'gmib-scheduler') {
    if (['show-test', 'hide-test'].includes(candidate.action)) {
      await requireReference(client, `/api/screen/${candidate.screenId}`, 'screenId');
    }
    if (candidate.action === 'show-test') {
      const pages = await requestData(client, '/api/pages');
      if (!Array.isArray(pages) || !pages.some(page => page?.id === candidate.testId)) {
        fail('testId с указанным id не найден', 'missing_reference');
      }
    }
  }
};

const copyKnown = (source, fields) => {
  const result = {};
  for (const field of fields) {
    if (hasOwn(source, field)) result[field] = source[field];
  }
  return result;
};

const normalizedPlaylistItem = item => ({
  md5: item.md5,
  flags: item.flags ?? 0,
  start: item.start ?? null,
  duration: item.duration ?? null,
});

const playlistItemKey = item => JSON.stringify(normalizedPlaylistItem(item));

const mergePlaylistItems = (current, desired) => {
  const reusableIds = new Map();
  for (const item of current) {
    const key = playlistItemKey(item);
    const ids = reusableIds.get(key) ?? [];
    ids.push(item.id);
    reusableIds.set(key, ids);
  }
  return desired.map(item => {
    const key = playlistItemKey(item);
    const ids = reusableIds.get(key);
    return { ...normalizedPlaylistItem(item), id: ids?.shift() ?? randomUUID() };
  });
};

const buildPayload = (type, current, desired, creating) => {
  const definition = definitions[type];
  if (creating) {
    const fields =
      definition.createFields ??
      (type === 'scheduler' || type === 'gmib-scheduler'
        ? definition.fields
        : definition.fields.filter(field => field !== 'id'));
    const payload = copyKnown(desired, fields);
    if (type === 'playlist' && hasOwn(payload, 'items')) {
      payload.items = payload.items.map(normalizedPlaylistItem);
    }
    return payload;
  }

  if (type === 'playlist') {
    const payload = {
      id: current.id,
      name: current.name,
      flags: current.flags,
      lastUsed: current.lastUsed,
      items: current.items,
    };
    for (const field of ['name', 'flags']) {
      if (hasOwn(desired, field)) payload[field] = desired[field];
    }
    if (hasOwn(desired, 'items'))
      payload.items = mergePlaylistItems(current.items ?? [], desired.items);
    return payload;
  }

  const payload = copyKnown(current, definition.fields);
  payload.id = current.id;
  for (const field of definition.fields) {
    if (field !== 'id' && hasOwn(desired, field)) payload[field] = desired[field];
  }
  return payload;
};

const sameValue = (type, field, actual, desired) => {
  if (actual == null && desired == null) return true;
  if (type === 'playlist' && field === 'items') {
    if (!Array.isArray(actual) || !Array.isArray(desired) || actual.length !== desired.length)
      return false;
    return actual.every((item, index) => playlistItemKey(item) === playlistItemKey(desired[index]));
  }
  if (field === 'addresses') {
    if (!Array.isArray(actual) || !Array.isArray(desired)) return false;
    return (
      JSON.stringify([...new Set(actual)].sort()) === JSON.stringify([...new Set(desired)].sort())
    );
  }
  if (field === 'cron')
    return JSON.stringify(normalizeCron(actual)) === JSON.stringify(normalizeCron(desired));
  return Object.is(actual, desired);
};

const isUnchanged = (type, current, desired) => {
  const fields = definitions[type].fields;
  return fields.every(
    field =>
      !hasOwn(desired, field) ||
      field === 'id' ||
      sameValue(type, field, current[field], desired[field]),
  );
};

const assertApplied = (type, resource, desired, { id, operations }) => {
  if (!isObject(resource) || !isUnchanged(type, resource, desired)) {
    throw new GmibApiResourceError('GMIB не подтвердил примененное состояние ресурса', {
      code: 'apply_unconfirmed',
      id,
      operations,
    });
  }
};

const createFollowupError = (error, createdId, operations) => {
  const known = error instanceof GmibApiError ? error : undefined;
  return new GmibApiResourceError(
    'Экран создан, но завершающий PUT не выполнен; повторите с тем же exact name или id',
    {
      code: 'screen_followup_failed',
      status: known?.status,
      createdId,
      operations,
    },
  );
};

export const ensureResource = async (client, type, input, { check = false } = {}) => {
  const desired = normalizeDesired(type, input);
  const definition = definitions[type];
  const current = await resolveResource(client, type, desired);

  if (
    !current &&
    hasOwn(desired, 'id') &&
    definitions[type].idType === 'number' &&
    desired.state === 'present'
  ) {
    fail(`${type}: ресурс с явно указанным server-generated id не найден`, 'resource_not_found');
  }

  if (desired.state === 'absent') {
    if (!current) return { changed: false, checkMode: check, resource: type };
    if (check) {
      return {
        changed: true,
        checkMode: true,
        resource: type,
        id: current.id,
        predicted: 'delete',
      };
    }
    await requestData(client, definition.deletePath(current.id), { method: 'DELETE' });
    return { changed: true, resource: type, id: current.id, operations: ['delete'] };
  }

  const candidate = buildPayload(type, current ?? {}, desired, !current);
  if (type === 'scheduler' || type === 'gmib-scheduler') {
    normalizeScheduler(type, candidate, { complete: true });
  }
  if (!current) validateCreate(type, candidate);
  validateEffective(type, candidate);
  await validateReferences(client, type, candidate, desired);
  if (current && isUnchanged(type, current, desired)) {
    return { changed: false, checkMode: check, resource: type, id: current.id };
  }
  if (check) {
    return {
      changed: true,
      checkMode: true,
      resource: type,
      ...(current ? { id: current.id, predicted: 'update' } : { predicted: 'create' }),
    };
  }

  if (current) {
    const payload = candidate;
    const path =
      typeof definition.updatePath === 'function'
        ? definition.updatePath(current.id)
        : definition.updatePath;
    const resource = await requestData(client, path, { method: 'PUT', body: payload });
    assertApplied(type, resource, desired, { id: current.id, operations: ['update'] });
    return {
      changed: true,
      resource: type,
      id: current.id,
      operations: ['update'],
      resourceData: resource,
    };
  }

  const resource = await requestData(client, definition.createPath, {
    method: 'POST',
    body: candidate,
  });
  if (!isObject(resource) || !hasOwn(resource, 'id'))
    fail(`${type}: POST не вернул id`, 'invalid_response');

  if (type !== 'screen' || isUnchanged(type, resource, desired)) {
    assertApplied(type, resource, desired, { id: resource.id, operations: ['create'] });
    return {
      changed: true,
      resource: type,
      id: resource.id,
      operations: ['create'],
      resourceData: resource,
    };
  }
  const payload = buildPayload(type, resource, desired, false);
  try {
    const updated = await requestData(client, definition.updatePath, {
      method: 'PUT',
      body: payload,
    });
    assertApplied(type, updated, desired, { id: resource.id, operations: ['create', 'update'] });
    return {
      changed: true,
      resource: type,
      id: resource.id,
      operations: ['create', 'update'],
      resourceData: updated,
    };
  } catch (error) {
    throw createFollowupError(error, resource.id, ['create']);
  }
};

const booleanOptions = new Set(['check', 'desired-stdin', 'help', 'password-stdin']);
const valueOptions = new Set([
  'base-url',
  'client-id',
  'desired-file',
  'password-env',
  'password-file',
  'timeout-ms',
  'type',
]);

const parseArgs = argv => {
  const [command, ...rest] = argv;
  const options = {};
  const seen = new Set();
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) fail(`Неожиданный аргумент: ${token}`, 'invalid_arguments');
    const name = token.slice(2);
    if (!booleanOptions.has(name) && !valueOptions.has(name)) {
      fail(`Неизвестная опция: --${name}`, 'invalid_arguments');
    }
    if (seen.has(name)) fail(`Опция --${name} указана несколько раз`, 'invalid_arguments');
    seen.add(name);
    if (booleanOptions.has(name)) {
      options[name] = true;
    } else {
      const value = rest[index + 1];
      if (!value || value.startsWith('--'))
        fail(`Не задано значение --${name}`, 'invalid_arguments');
      options[name] = value;
      index += 1;
    }
  }
  return { command, options };
};

let stdinPromise;
let stdinConsumer;
const readStdin = consumer => {
  if (stdinConsumer && stdinConsumer !== consumer)
    fail('stdin можно использовать только для одного входного значения', 'stdin_conflict');
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
    fail('Не удалось открыть файл пароля', 'password_file_error');
  }
  if (!stat.isFile() || (stat.mode & 0o077) !== 0) {
    fail('Файл пароля должен быть обычным и недоступным группе/другим', 'unsafe_password_file');
  }
  try {
    return readFileSync(filename, 'utf8');
  } catch {
    fail('Не удалось прочитать файл пароля', 'password_file_error');
  }
};

const readPassword = async options => {
  const sources = [
    options['password-env'] && ['env', options['password-env']],
    options['password-file'] && ['file', options['password-file']],
    options['password-stdin'] && ['stdin'],
  ].filter(Boolean);
  if (sources.length > 1) fail('Укажите один источник --password-*', 'invalid_arguments');
  const [kind, value] = sources[0] ?? ['env', 'GMIB_PASSWORD'];
  const password =
    kind === 'env'
      ? (process.env[value] ?? '')
      : kind === 'file'
        ? readProtectedFile(value)
        : await readStdin('password');
  const normalized = password.replace(/\r?\n$/, '');
  if (!normalized) fail('Пароль не задан', 'password_required');
  return normalized;
};

const readDesired = async options => {
  if (Boolean(options['desired-file']) === Boolean(options['desired-stdin'])) {
    fail('Укажите ровно один --desired-file или --desired-stdin', 'invalid_arguments');
  }
  let raw;
  try {
    raw = options['desired-file']
      ? readFileSync(options['desired-file'], 'utf8')
      : await readStdin('desired');
  } catch {
    fail('Не удалось прочитать desired JSON', 'desired_read_error');
  }
  try {
    return JSON.parse(raw);
  } catch {
    fail('desired должен быть корректным JSON', 'invalid_desired_json');
  }
};

const writeResult = value => process.stdout.write(`${JSON.stringify(value)}\n`);

export const main = async (argv = process.argv.slice(2)) => {
  const { command, options } = parseArgs(argv);
  if (options.help || command === '--help' || !command) {
    process.stdout.write(HELP);
    return;
  }
  if (command !== 'ensure') fail(`Неизвестная команда: ${command}`, 'invalid_arguments');
  if (!RESOURCE_TYPES.has(options.type))
    fail('--type обязателен и должен быть поддерживаемым', 'invalid_resource_type');
  const desired = await readDesired(options);
  const password = await readPassword(options);
  const client = new GmibApiClient({
    baseUrl: options['base-url'] ?? process.env.GMIB_BASE_URL,
    clientId: options['client-id'] ?? process.env.GMIB_CLIENT_ID,
    password,
    timeoutMs: Number(options['timeout-ms'] ?? 10_000),
  });
  try {
    writeResult({
      ok: true,
      ...(await ensureResource(client, options.type, desired, { check: Boolean(options.check) })),
    });
  } finally {
    client.clearSession();
  }
};

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch(error => {
    const known = error instanceof GmibApiError ? error : undefined;
    writeResult({
      ok: false,
      error: {
        code: known?.code ?? 'internal_error',
        message: known?.message ?? 'Внутренняя ошибка resource helper',
        ...(known?.status ? { status: known.status } : {}),
        ...(known?.createdId ? { createdId: known.createdId } : {}),
        ...(known?.operations ? { operations: known.operations } : {}),
      },
    });
    process.stderr.write(
      `gmib-api-resources: ${known?.message ?? 'Внутренняя ошибка resource helper'}\n`,
    );
    process.exitCode = known?.status === 401 ? 3 : 2;
  });
}
