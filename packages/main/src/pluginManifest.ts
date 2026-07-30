import path from 'node:path';

import semver from 'semver';

import {
  GMIB_PLUGIN_API_VERSION,
  type PluginControlPage,
  type PluginManifest,
  type PluginOutputPage,
  type PluginPermission,
  pluginPermissions,
} from '/@common/plugins';

const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const PAGE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const allowedPermissions = new Set<string>(pluginPermissions);

const requiredString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Поле "${field}" должно быть непустой строкой`);
  }
  return value.trim();
};

export const normalizePluginRelativePath = (value: unknown, field: string): string => {
  const input = requiredString(value, field).replaceAll('\\', '/');
  const normalized = path.posix.normalize(input);
  if (
    normalized === '.' ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    path.posix.isAbsolute(normalized) ||
    /^[a-zA-Z]:/.test(normalized)
  ) {
    throw new Error(`Поле "${field}" содержит недопустимый путь`);
  }
  return normalized.replace(/^\.\//, '');
};

const parseOutputPage = (value: unknown, index: number): PluginOutputPage => {
  if (!value || typeof value !== 'object') {
    throw new Error(`Элемент pages[${index}] должен быть объектом`);
  }
  const page = value as Record<string, unknown>;
  const id = requiredString(page.id, `pages[${index}].id`);
  if (!PAGE_ID_PATTERN.test(id)) {
    throw new Error(`Поле "pages[${index}].id" содержит недопустимый идентификатор`);
  }
  return {
    id,
    title: requiredString(page.title, `pages[${index}].title`),
    path: normalizePluginRelativePath(page.path, `pages[${index}].path`),
  };
};

const parseControlPage = (value: unknown): PluginControlPage | undefined => {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object') {
    throw new Error('Поле "control" должно быть объектом');
  }
  const control = value as Record<string, unknown>;
  return {
    ...(control.title === undefined
      ? {}
      : { title: requiredString(control.title, 'control.title') }),
    path: normalizePluginRelativePath(control.path, 'control.path'),
  };
};

export const parsePluginManifest = (value: unknown): PluginManifest => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('manifest.json должен содержать объект');
  }

  const raw = value as Record<string, unknown>;
  const id = requiredString(raw.id, 'id');
  if (!ID_PATTERN.test(id)) {
    throw new Error(
      'Поле "id" должно содержать строчные латинские буквы, цифры и дефисы (до 64 символов)',
    );
  }

  const version = requiredString(raw.version, 'version');
  if (!semver.valid(version)) throw new Error('Поле "version" должно содержать SemVer-версию');

  const gmibApi = requiredString(raw.gmibApi, 'gmibApi');
  if (!semver.validRange(gmibApi)) {
    throw new Error('Поле "gmibApi" должно содержать допустимый диапазон SemVer');
  }
  if (!semver.satisfies(GMIB_PLUGIN_API_VERSION, gmibApi)) {
    throw new Error(
      `Плагин требует gmib Plugin API ${gmibApi}, доступна версия ${GMIB_PLUGIN_API_VERSION}`,
    );
  }

  const permissions = raw.permissions ?? [];
  if (!Array.isArray(permissions)) throw new Error('Поле "permissions" должно быть массивом');
  const parsedPermissions = permissions.map((permission, index) => {
    const name = requiredString(permission, `permissions[${index}]`);
    if (!allowedPermissions.has(name)) {
      throw new Error(`Неизвестное разрешение плагина: ${name}`);
    }
    return name as PluginPermission;
  });
  if (new Set(parsedPermissions).size !== parsedPermissions.length) {
    throw new Error('Поле "permissions" содержит повторяющиеся разрешения');
  }

  const pages = raw.pages ?? [];
  if (!Array.isArray(pages)) throw new Error('Поле "pages" должно быть массивом');
  const parsedPages = pages.map(parseOutputPage);
  if (new Set(parsedPages.map(page => page.id)).size !== parsedPages.length) {
    throw new Error('Поле "pages" содержит повторяющиеся идентификаторы');
  }

  const publicRoot =
    raw.public === undefined ? undefined : normalizePluginRelativePath(raw.public, 'public');
  if ((parsedPages.length > 0 || raw.control !== undefined) && !publicRoot) {
    throw new Error('Для страниц плагина требуется поле "public"');
  }
  if (parsedPages.length > 0 && !parsedPermissions.includes('output.pages')) {
    throw new Error('Для поля "pages" требуется разрешение "output.pages"');
  }

  return {
    id,
    name: requiredString(raw.name, 'name'),
    version,
    gmibApi,
    ...(raw.description === undefined
      ? {}
      : { description: requiredString(raw.description, 'description') }),
    ...(raw.main === undefined ? {} : { main: normalizePluginRelativePath(raw.main, 'main') }),
    ...(publicRoot ? { public: publicRoot } : {}),
    ...(parsedPermissions.length > 0 ? { permissions: parsedPermissions } : {}),
    ...(parsedPages.length > 0 ? { pages: parsedPages } : {}),
    ...(raw.control === undefined ? {} : { control: parseControlPage(raw.control) }),
  };
};
