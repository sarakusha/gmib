import { isDeepStrictEqual } from 'node:util';

import type {
  Config,
  Location,
  NightBrightnessMode,
  SplineItem,
  SunSplineItem,
} from '/@common/config';
import { configSchema } from '/@common/schema';

export const managementSettingsKeys = [
  'brightness',
  'autobrightness',
  'location',
  'spline',
  'sunSpline',
  'nightMode',
] as const;

export type ManagementSettingsKey = (typeof managementSettingsKeys)[number];

export type ManagementSettings = Pick<
  Config,
  'brightness' | 'autobrightness' | 'location' | 'spline' | 'sunSpline' | 'nightMode'
>;

export type ManagementSettingsPatch = Partial<{
  brightness: Config['brightness'];
  autobrightness: Config['autobrightness'];
  location: Location | null;
  spline: SplineItem[] | null;
  sunSpline: SunSplineItem[] | null;
  nightMode: NightBrightnessMode | null;
}>;

export type ManagementSettingsAdapter = {
  getConfig: () => Config;
  updateConfigStore: (update: (current: Config) => Config) => Config | Promise<Config>;
};

export class ManagementSettingsValidationError extends Error {
  readonly code = 'invalid_settings';

  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'ManagementSettingsValidationError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ownKeys = (value: Record<string, unknown>): string[] => Object.keys(value);

const assertFiniteNumber: (value: unknown, field: string) => asserts value is number = (
  value,
  field,
) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ManagementSettingsValidationError(`${field} must be a finite number`, field);
  }
};

const assertRange: (value: unknown, min: number, max: number, field: string) => void = (
  value,
  min,
  max,
  field,
) => {
  assertFiniteNumber(value, field);
  if (value < min || value > max) {
    throw new ManagementSettingsValidationError(
      `${field} must be between ${min} and ${max}`,
      field,
    );
  }
};

const assertAllowedKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string,
): void => {
  const unknown = ownKeys(value).find(key => !allowed.includes(key));
  if (unknown) {
    throw new ManagementSettingsValidationError(
      `${field}.${unknown} is not supported`,
      `${field}.${unknown}`,
    );
  }
};

const validateLocation: (value: unknown, field?: string) => asserts value is Location = (
  value,
  field = 'location',
) => {
  if (!isRecord(value)) {
    throw new ManagementSettingsValidationError(`${field} must be an object or null`, field);
  }
  assertAllowedKeys(value, ['latitude', 'longitude'], field);
  if ('latitude' in value) assertRange(value.latitude, -90, 90, `${field}.latitude`);
  if ('longitude' in value) assertRange(value.longitude, -180, 180, `${field}.longitude`);
};

const validateSpline: (value: unknown, field: string) => asserts value is SplineItem[] = (
  value,
  field,
) => {
  if (!Array.isArray(value) || value.length < 2 || value.length > 4) {
    throw new ManagementSettingsValidationError(`${field} must contain 2 to 4 points`, field);
  }
  let previousLux = -1;
  let previousBrightness = -1;
  value.forEach((point, index) => {
    const pointField = `${field}[${index}]`;
    if (!Array.isArray(point) || point.length !== 2) {
      throw new ManagementSettingsValidationError(
        `${pointField} must be [lux, brightness]`,
        pointField,
      );
    }
    assertRange(point[0], 0, 65535, `${pointField}[0]`);
    assertRange(point[1], 0, 100, `${pointField}[1]`);
    if (point[0] <= previousLux) {
      throw new ManagementSettingsValidationError(
        `${field} lux values must be strictly increasing`,
        `${pointField}[0]`,
      );
    }
    if (point[1] < previousBrightness) {
      throw new ManagementSettingsValidationError(
        `${field} brightness values must not decrease`,
        `${pointField}[1]`,
      );
    }
    previousLux = point[0];
    previousBrightness = point[1];
  });
};

const sunReferencePattern =
  /^(event:(dawn|sunrise|sunriseEnd|goldenHourEnd|solarNoon|goldenHour|sunsetStart|sunset|dusk|nadir)|time:([01]\d|2[0-3]):[0-5]\d)$/;

const validateSunSpline: (value: unknown, field: string) => asserts value is SunSplineItem[] = (
  value,
  field,
) => {
  if (!Array.isArray(value) || value.length > 10) {
    throw new ManagementSettingsValidationError(`${field} must contain 0 to 10 points`, field);
  }
  const references = new Set<string>();
  value.forEach((point, index) => {
    const pointField = `${field}[${index}]`;
    if (!Array.isArray(point) || point.length !== 2) {
      throw new ManagementSettingsValidationError(
        `${pointField} must be [reference, brightness]`,
        pointField,
      );
    }
    if (typeof point[0] !== 'string' || !sunReferencePattern.test(point[0])) {
      throw new ManagementSettingsValidationError(
        `${pointField}[0] is not a valid sun reference`,
        `${pointField}[0]`,
      );
    }
    if (references.has(point[0])) {
      throw new ManagementSettingsValidationError(
        `${field} references must be unique`,
        `${pointField}[0]`,
      );
    }
    references.add(point[0]);
    assertRange(point[1], 0, 100, `${pointField}[1]`);
  });
};

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const validateNightMode: (value: unknown, field: string) => asserts value is NightBrightnessMode = (
  value,
  field,
) => {
  if (!isRecord(value)) {
    throw new ManagementSettingsValidationError(`${field} must be an object or null`, field);
  }
  assertAllowedKeys(value, ['start', 'end', 'brightness'], field);
  for (const key of ['start', 'end'] as const) {
    if (key in value && (typeof value[key] !== 'string' || !timePattern.test(value[key]))) {
      throw new ManagementSettingsValidationError(
        `${field}.${key} must be HH:MM`,
        `${field}.${key}`,
      );
    }
  }
  if ('brightness' in value) assertRange(value.brightness, 0, 100, `${field}.brightness`);
};

export const validateManagementSettingsPatch = (value: unknown): ManagementSettingsPatch => {
  if (!isRecord(value)) {
    throw new ManagementSettingsValidationError('PATCH body must be a JSON object');
  }
  assertAllowedKeys(value, managementSettingsKeys, 'settings');
  if ('brightness' in value) assertRange(value.brightness, 0, 100, 'brightness');
  if ('autobrightness' in value && typeof value.autobrightness !== 'boolean') {
    throw new ManagementSettingsValidationError('autobrightness must be boolean', 'autobrightness');
  }
  if ('location' in value && value.location !== null) validateLocation(value.location);
  if ('spline' in value && value.spline !== null) validateSpline(value.spline, 'spline');
  if ('sunSpline' in value && value.sunSpline !== null)
    validateSunSpline(value.sunSpline, 'sunSpline');
  if ('nightMode' in value && value.nightMode !== null)
    validateNightMode(value.nightMode, 'nightMode');
  return value;
};

const clone = <T>(value: T): T => structuredClone(value);

const schemaDefault = (key: 'spline' | 'sunSpline'): unknown => {
  const schema: unknown = configSchema[key];
  if (isRecord(schema) && 'default' in schema) {
    return schema.default;
  }
  throw new Error(`Config schema has no default for ${key}`);
};

const defaultSpline = (): SplineItem[] => clone(schemaDefault('spline')) as SplineItem[];
const defaultSunSpline = (): SunSplineItem[] =>
  clone(schemaDefault('sunSpline')) as SunSplineItem[];

const settingsFromConfig = (config: Config): ManagementSettings => {
  const settings: ManagementSettings = {
    brightness: config.brightness,
    autobrightness: config.autobrightness,
    location: clone(config.location),
    spline: clone(config.spline ?? defaultSpline()),
    sunSpline: clone(config.sunSpline ?? defaultSunSpline()),
    nightMode: clone(config.nightMode),
  };
  return settings;
};

const mergeOptionalObject = <T extends Record<string, unknown>>(
  current: T | undefined,
  update: T | null | undefined,
): T | undefined =>
  update === null ? undefined : update === undefined ? current : { ...(current ?? {}), ...update };

const assertCompleteNightMode = (value: NightBrightnessMode | undefined): void => {
  if (!value || Object.keys(value).length === 0) {
    throw new ManagementSettingsValidationError(
      'nightMode must contain start, end and brightness when it is set',
      'nightMode',
    );
  }
  if (value.start === undefined || value.end === undefined || value.brightness === undefined) {
    throw new ManagementSettingsValidationError(
      'nightMode must contain start, end and brightness when it is set',
      'nightMode',
    );
  }
};

const applyPatch = (config: Config, patch: ManagementSettingsPatch): Config => {
  const next = { ...config };
  if ('brightness' in patch) next.brightness = patch.brightness as number;
  if ('autobrightness' in patch) next.autobrightness = patch.autobrightness as boolean;
  if ('location' in patch) {
    next.location = mergeOptionalObject(config.location, patch.location);
  }
  if ('spline' in patch) next.spline = clone(patch.spline ?? defaultSpline());
  if ('sunSpline' in patch) next.sunSpline = clone(patch.sunSpline ?? defaultSunSpline());
  if ('nightMode' in patch) {
    next.nightMode = mergeOptionalObject(config.nightMode, patch.nightMode);
  }
  return next;
};

export type ManagementSettingsPatchResult = {
  changed: boolean;
  dryRun: boolean;
  settings: ManagementSettings;
};

export class ManagementSettingsService {
  constructor(private readonly adapter: ManagementSettingsAdapter) {}

  get(): ManagementSettings {
    return settingsFromConfig(this.adapter.getConfig());
  }

  async patch(input: unknown, dryRun = false): Promise<ManagementSettingsPatchResult> {
    const patch = validateManagementSettingsPatch(input);
    const current = this.adapter.getConfig();
    const next = applyPatch(current, patch);
    if ('nightMode' in patch && patch.nightMode !== null) {
      assertCompleteNightMode(next.nightMode);
    }
    const currentSettings = settingsFromConfig(current);
    const nextSettings = settingsFromConfig(next);
    const changed = !isDeepStrictEqual(currentSettings, nextSettings);
    const stored =
      changed && !dryRun
        ? await this.adapter.updateConfigStore(currentConfig => applyPatch(currentConfig, patch))
        : next;
    return { changed, dryRun, settings: settingsFromConfig(stored) };
  }
}

export const createManagementSettingsService = (
  adapter: ManagementSettingsAdapter,
): ManagementSettingsService => new ManagementSettingsService(adapter);
