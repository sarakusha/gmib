import type { Player, PlayerMapping } from './video';

export type PortablePlayerSettings = Omit<Player, 'id' | 'playlistId' | 'current' | 'hidden'>;
export type PortablePlayerMapping = Omit<PlayerMapping, 'id' | 'player'>;
export type PlayerConfiguration = {
  format: 'gmib-player-configuration';
  version: 1;
  players: Array<{
    settings: PortablePlayerSettings;
    mappings: PortablePlayerMapping[];
  }>;
  warnings?: string[];
};

export const MAX_PLAYER_CONFIGURATION_BYTES = 5 * 1024 * 1024;
const MAX_PLAYERS = 1000;
const MAX_MAPPINGS = 10000;
const objectFits = new Set(['fill', 'contain', 'cover', 'none', 'scale-down']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
function fail(message: string): never {
  throw new Error(message);
}
const optionalString = (value: unknown, label: string): string | undefined =>
  value == null
    ? undefined
    : typeof value === 'string'
      ? value
      : fail(`${label}: ожидается строка`);
const optionalBoolean = (value: unknown, label: string): boolean | undefined =>
  value == null
    ? undefined
    : typeof value === 'boolean'
      ? value
      : fail(`${label}: ожидается логическое значение`);
const optionalFinite = (value: unknown, label: string): number | undefined =>
  value == null
    ? undefined
    : typeof value === 'number' && Number.isFinite(value)
      ? value
      : fail(`${label}: ожидается конечное число`);
const positiveDimension = (value: unknown, label: string): number | undefined => {
  const number = optionalFinite(value, label);
  if (number === undefined) return undefined;
  return number > 0 ? number : fail(`${label}: размер должен быть больше нуля`);
};

const projectPlayerSettings = (value: unknown, index: number): PortablePlayerSettings => {
  if (!isRecord(value)) fail(`Плеер ${index + 1}: ожидается объект настроек`);
  const settings: PortablePlayerSettings = {};
  const name = optionalString(value.name, `Плеер ${index + 1}, имя`);
  if (name !== undefined) settings.name = name;
  for (const key of ['width', 'height'] as const) {
    const dimension = optionalFinite(value[key], `Плеер ${index + 1}, ${key}`);
    if (dimension !== undefined) {
      if (!Number.isInteger(dimension) || dimension < 4 || dimension % 2 !== 0)
        fail(`Плеер ${index + 1}, ${key}: размер должен быть чётным целым числом не меньше 4`);
      settings[key] = dimension;
    }
  }
  for (const key of ['autoPlay', 'disableFadeIn', 'disableFadeOut'] as const) {
    const boolean = optionalBoolean(value[key], `Плеер ${index + 1}, ${key}`);
    if (boolean !== undefined) settings[key] = boolean;
  }
  if (value.playbackEngine != null) {
    if (value.playbackEngine !== 'decoder' && value.playbackEngine !== 'capture')
      fail(`Плеер ${index + 1}, playbackEngine: неизвестный режим`);
    settings.playbackEngine = value.playbackEngine;
  }
  return settings;
};

const projectMapping = (
  value: unknown,
  index: number,
  allowHostDisplay = false,
): PortablePlayerMapping => {
  if (!isRecord(value)) fail(`Область вывода ${index + 1}: ожидается объект`);
  const mapping = {} as PortablePlayerMapping;
  const name = optionalString(value.name, `Область вывода ${index + 1}, имя`);
  if (name === undefined) fail(`Область вывода ${index + 1}: не задано имя`);
  mapping.name = name;
  for (const key of ['left', 'top'] as const) {
    const number = optionalFinite(value[key], `Область вывода ${index + 1}, ${key}`);
    if (number === undefined) fail(`Область вывода ${index + 1}: не задано поле ${key}`);
    mapping[key] = number;
  }
  for (const key of ['width', 'height'] as const) {
    const number = positiveDimension(value[key], `Область вывода ${index + 1}, ${key}`);
    if (number !== undefined) mapping[key] = number;
  }
  for (const key of ['kiosk', 'transparent', 'alwaysOnTop'] as const) {
    const boolean = optionalBoolean(value[key], `Область вывода ${index + 1}, ${key}`);
    if (boolean !== undefined) mapping[key] = boolean;
    else if (key === 'kiosk') mapping.kiosk = false;
  }
  const zIndex = optionalFinite(value.zIndex, `Область вывода ${index + 1}, zIndex`);
  if (zIndex !== undefined) mapping.zIndex = zIndex;
  const shader = optionalString(value.shader, `Область вывода ${index + 1}, shader`);
  if (shader !== undefined) mapping.shader = shader;
  if (value.objectFit != null) {
    if (typeof value.objectFit !== 'string' || !objectFits.has(value.objectFit))
      fail(`Область вывода ${index + 1}, objectFit: неизвестное значение`);
    mapping.objectFit = value.objectFit as PortablePlayerMapping['objectFit'];
  }
  const display = optionalFinite(value.display, `Область вывода ${index + 1}, display`);
  if (display !== undefined) {
    if (!allowHostDisplay && ![0, -1, -2].includes(display))
      fail(`Область вывода ${index + 1}, display: допускаются только 0, -1 и -2`);
    mapping.display = display;
  }
  return mapping;
};

export const createPlayerConfiguration = (
  players: Player[],
  mappings: PlayerMapping[],
  displays: Array<{ id: number; primary?: boolean }>,
): PlayerConfiguration => {
  if (players.length > MAX_PLAYERS) fail(`Нельзя экспортировать более ${MAX_PLAYERS} плееров`);
  if (mappings.length > MAX_MAPPINGS)
    fail(`Нельзя экспортировать более ${MAX_MAPPINGS} областей вывода`);
  const primary = displays.find(display => display.primary)?.id ?? displays[0]?.id;
  const secondary = displays.find(display => display.id !== primary)?.id;
  let droppedDisplays = 0;
  const entries = players.map((player, index) => {
    const settings = projectPlayerSettings(player, index);
    const playerMappings = mappings
      .filter(mapping => mapping.player === player.id)
      .map(mapping => {
        const portable = projectMapping(mapping, 0, true);
        if (
          mapping.display == null ||
          mapping.display === 0 ||
          mapping.display === -1 ||
          mapping.display === -2
        )
          return portable;
        if (mapping.display === primary) portable.display = -1;
        else if (mapping.display === secondary) portable.display = -2;
        else {
          delete portable.display;
          droppedDisplays += 1;
        }
        return portable;
      });
    return { settings, mappings: playerMappings };
  });
  return {
    format: 'gmib-player-configuration',
    version: 1,
    players: entries,
    ...(droppedDisplays
      ? {
          warnings: [
            `Привязки к дисплеям кроме основного и первого дополнительного сброшены (${droppedDisplays})`,
          ],
        }
      : {}),
  };
};

export const parsePlayerConfiguration = (value: unknown): PlayerConfiguration => {
  if (!isRecord(value) || value.format !== 'gmib-player-configuration')
    fail('Файл не является конфигурацией плееров GMIB');
  if (value.version !== 1) fail(`Неподдерживаемая версия конфигурации: ${String(value.version)}`);
  if (!Array.isArray(value.players)) fail('Поле players должно быть массивом');
  const rawPlayers: unknown[] = value.players;
  if (rawPlayers.length > MAX_PLAYERS) fail(`Нельзя импортировать более ${MAX_PLAYERS} плееров`);
  let mappingCount = 0;
  const players = rawPlayers.map((entry: unknown, index: number) => {
    if (!isRecord(entry) || !Array.isArray(entry.mappings))
      fail(`Плеер ${index + 1}: ожидаются настройки и массив mappings`);
    const rawMappings: unknown[] = entry.mappings;
    mappingCount += rawMappings.length;
    if (mappingCount > MAX_MAPPINGS)
      fail(`Нельзя импортировать более ${MAX_MAPPINGS} областей вывода`);
    return {
      settings: projectPlayerSettings(entry.settings, index),
      mappings: rawMappings.map((mapping: unknown, mappingIndex: number) =>
        projectMapping(mapping, mappingIndex),
      ),
    };
  });
  const rawWarnings: unknown[] | undefined = Array.isArray(value.warnings)
    ? value.warnings
    : undefined;
  const warnings =
    rawWarnings && rawWarnings.every((item: unknown) => typeof item === 'string')
      ? (value.warnings as string[])
      : undefined;
  return {
    format: 'gmib-player-configuration',
    version: 1,
    players,
    ...(warnings?.length ? { warnings } : {}),
  };
};
