import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

import type { Request, RequestHandler, Response } from 'express';
import express from 'express';
import { app, dialog, shell } from 'electron';
import debugFactory from 'debug';
import { nanoid } from 'nanoid';

import type {
  PluginInstallResult,
  PluginManifest,
  PluginPermission,
  PluginStatus,
} from '/@common/plugins';

import { port, testsDeferred } from './config';
import { dbReady } from './db';
import { deletePage, getPages, uniquePageTitle, upsertPermanentPage } from './page';
import { extractPluginArchive } from './pluginArchive';
import { normalizePluginRelativePath, parsePluginManifest } from './pluginManifest';
import { getScreens } from './screen';
import { updateTest } from './screenOutput';
import { broadcast } from './server';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:plugins`);
const PLUGIN_PAGE_PREFIX = 'plugin:';
const REGISTRY_FILENAME = '.registry.json';
const STAGING_DIRECTORY = '.staging';
const DATA_DIRECTORY = '.data';

type PluginRegistry = {
  disabled?: string[];
};

type PluginHttpAccess = 'local' | 'authenticated';
type PluginHttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
type PluginHttpRequest = {
  method: PluginHttpMethod;
  path: string;
  query: Record<string, string | string[]>;
  body: unknown;
};
type PluginHttpResponse = {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
};
type PluginHttpHandler = (request: PluginHttpRequest) => unknown;

type PluginContext = {
  apiVersion: string;
  plugin: Readonly<PluginManifest>;
  logger: {
    debug: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  };
  http: {
    delete: (
      route: string,
      handler: PluginHttpHandler,
      options?: { access?: PluginHttpAccess },
    ) => void;
    get: (
      route: string,
      handler: PluginHttpHandler,
      options?: { access?: PluginHttpAccess },
    ) => void;
    patch: (
      route: string,
      handler: PluginHttpHandler,
      options?: { access?: PluginHttpAccess },
    ) => void;
    post: (
      route: string,
      handler: PluginHttpHandler,
      options?: { access?: PluginHttpAccess },
    ) => void;
    put: (
      route: string,
      handler: PluginHttpHandler,
      options?: { access?: PluginHttpAccess },
    ) => void;
    response: (
      status: number,
      body?: unknown,
      headers?: Record<string, string>,
    ) => PluginHttpResponse;
  };
  storage: {
    get: <T = unknown>(key: string, defaultValue?: T) => Promise<T | undefined>;
    set: (key: string, value: unknown) => Promise<void>;
    update: <T = unknown>(key: string, updater: (value: T | undefined) => T) => Promise<T>;
  };
  events: {
    publish: (event: string, data?: unknown) => void;
  };
  output: {
    registerPage: (page: { id: string; title: string; path: string }) => Promise<void>;
  };
};

type PluginModule = {
  activate?: (context: PluginContext) => void | Promise<void>;
  default?: {
    activate?: (context: PluginContext) => void | Promise<void>;
  };
};

type RegisteredRoute = {
  access: PluginHttpAccess;
  handler: PluginHttpHandler;
  method: PluginHttpMethod;
  path: string;
};

type RuntimePlugin = {
  directory: string;
  manifest: PluginManifest;
  publicRoot?: string;
  routes: RegisteredRoute[];
};

let pluginsRoot: string | undefined;
let registry: PluginRegistry = {};
let started = false;
const runtimePlugins = new Map<string, RuntimePlugin>();
const runtimeErrors = new Map<string, string>();
const desiredPageIds = new Set<string>();

const rootDirectory = (): string => {
  pluginsRoot ??= path.join(app.getPath('userData'), 'plugins');
  return pluginsRoot;
};

const registryPath = (): string => path.join(rootDirectory(), REGISTRY_FILENAME);

const isInside = (root: string, candidate: string): boolean =>
  candidate === root || candidate.startsWith(`${root}${path.sep}`);

const resolveInstalledPath = async (
  pluginDirectory: string,
  relativePath: string,
  expected: 'directory' | 'file',
): Promise<string> => {
  const root = await fs.promises.realpath(pluginDirectory);
  const resolved = path.resolve(root, relativePath);
  if (!isInside(root, resolved))
    throw new Error(`Путь выходит за каталог плагина: ${relativePath}`);
  let current = root;
  for (const segment of relativePath.replaceAll('\\', '/').split('/')) {
    current = path.join(current, segment);
    if ((await fs.promises.lstat(current)).isSymbolicLink()) {
      throw new Error(`Символическая ссылка запрещена: ${relativePath}`);
    }
  }
  const real = await fs.promises.realpath(resolved);
  if (!isInside(root, real)) throw new Error(`Путь выходит за каталог плагина: ${relativePath}`);
  const stats = await fs.promises.lstat(real);
  if (expected === 'file' ? !stats.isFile() : !stats.isDirectory()) {
    throw new Error(
      `${expected === 'file' ? 'Файл' : 'Каталог'} плагина не найден: ${relativePath}`,
    );
  }
  return real;
};

const validatePluginFiles = async (
  pluginDirectory: string,
  manifest: PluginManifest,
): Promise<void> => {
  const publicRoot = manifest.public
    ? await resolveInstalledPath(pluginDirectory, manifest.public, 'directory')
    : undefined;
  if (manifest.main) await resolveInstalledPath(pluginDirectory, manifest.main, 'file');
  if (publicRoot) {
    await Promise.all([
      ...(manifest.pages ?? []).map(page => resolveInstalledPath(publicRoot, page.path, 'file')),
      ...(manifest.control
        ? [resolveInstalledPath(publicRoot, manifest.control.path, 'file')]
        : []),
    ]);
  }
};

const readManifest = async (directory: string): Promise<PluginManifest> => {
  const contents = await fs.promises.readFile(path.join(directory, 'manifest.json'), 'utf8');
  const manifest = parsePluginManifest(JSON.parse(contents) as unknown);
  if (path.basename(directory) !== manifest.id) {
    throw new Error(`Каталог плагина должен называться "${manifest.id}"`);
  }
  await validatePluginFiles(directory, manifest);
  return manifest;
};

const loadRegistry = async (): Promise<void> => {
  try {
    const value = JSON.parse(await fs.promises.readFile(registryPath(), 'utf8')) as PluginRegistry;
    registry = {
      disabled: Array.isArray(value.disabled)
        ? value.disabled.filter(item => typeof item === 'string')
        : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      debug(`Failed to read plugin registry: ${(error as Error).message}`);
    }
    registry = { disabled: [] };
  }
};

const saveRegistry = async (): Promise<void> => {
  const target = registryPath();
  const temporary = `${target}.${nanoid()}.tmp`;
  await fs.promises.writeFile(temporary, JSON.stringify(registry, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
  await fs.promises.rename(temporary, target);
};

const isEnabled = (id: string): boolean => !(registry.disabled ?? []).includes(id);

const pluginDirectories = async (): Promise<string[]> => {
  await fs.promises.mkdir(rootDirectory(), { recursive: true });
  const entries = await fs.promises.readdir(rootDirectory(), { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => path.join(rootDirectory(), entry.name));
};

const scanInstalled = async (): Promise<Array<{ directory: string; manifest: PluginManifest }>> => {
  const result: Array<{ directory: string; manifest: PluginManifest }> = [];
  for (const directory of await pluginDirectories()) {
    try {
      result.push({ directory, manifest: await readManifest(directory) });
    } catch (error) {
      debug(`Invalid plugin at ${directory}: ${(error as Error).message}`);
    }
  }
  return result;
};

const normalizeRoute = (route: string): string => {
  if (!route.startsWith('/') || route.includes('?') || route.includes('#')) {
    throw new Error(`Маршрут плагина должен начинаться с "/" и не содержать ? или #: ${route}`);
  }
  const normalized = path.posix.normalize(route);
  if (normalized.includes('..')) throw new Error(`Недопустимый маршрут плагина: ${route}`);
  return normalized.length > 1 ? normalized.replace(/\/$/, '') : normalized;
};

const requirePermission = (manifest: PluginManifest, permission: PluginPermission): void => {
  if (!(manifest.permissions ?? []).includes(permission)) {
    throw new Error(`Плагин "${manifest.id}" не запросил разрешение "${permission}"`);
  }
};

const validateStorageKey = (key: string): void => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(key)) {
    throw new Error(`Недопустимый ключ хранилища: ${key}`);
  }
};

const pluginPageId = (pluginId: string, pageId: string): string =>
  `${PLUGIN_PAGE_PREFIX}${pluginId}:${pageId}`;

const pluginPublicUrl = (pluginId: string, relativePath: string): string => {
  const encodedPath = relativePath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return `http://127.0.0.1:${port}/plugins/${pluginId}/${encodedPath}`;
};

const registerOutputPage = async (
  plugin: RuntimePlugin,
  page: { id: string; title: string; path: string },
): Promise<void> => {
  requirePermission(plugin.manifest, 'output.pages');
  if (!plugin.publicRoot) throw new Error('Плагин не объявил каталог "public"');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(page.id)) {
    throw new Error(`Недопустимый идентификатор страницы: ${page.id}`);
  }
  if (typeof page.title !== 'string' || page.title.trim() === '') {
    throw new Error('Заголовок страницы плагина не задан');
  }
  const pagePath = normalizePluginRelativePath(page.path, 'page.path');
  await resolveInstalledPath(plugin.publicRoot, pagePath, 'file');
  const id = pluginPageId(plugin.manifest.id, page.id);
  desiredPageIds.add(id);
  await upsertPermanentPage(
    await uniquePageTitle({
      id,
      title: page.title.trim(),
      url: pluginPublicUrl(plugin.manifest.id, pagePath),
      permanent: true,
    }),
  );
  broadcast({ event: 'page', all: true });
};

class PluginStorage {
  private data: Record<string, unknown> = {};

  private writeQueue = Promise.resolve();

  private constructor(private readonly filename: string) {}

  static async create(pluginId: string): Promise<PluginStorage> {
    const directory = path.join(rootDirectory(), DATA_DIRECTORY, pluginId);
    await fs.promises.mkdir(directory, { recursive: true });
    const storage = new PluginStorage(path.join(directory, 'state.json'));
    try {
      const value = JSON.parse(await fs.promises.readFile(storage.filename, 'utf8')) as unknown;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        storage.data = value as Record<string, unknown>;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    return storage;
  }

  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    await this.writeQueue;
    return (key in this.data ? structuredClone(this.data[key]) : defaultValue) as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    const cloned = structuredClone(value);
    JSON.stringify(cloned);
    await this.enqueue(async () => {
      this.data[key] = cloned;
      await this.persist();
    });
  }

  async update<T>(key: string, updater: (value: T | undefined) => T): Promise<T> {
    let result: T | undefined;
    await this.enqueue(async () => {
      const current = (key in this.data ? structuredClone(this.data[key]) : undefined) as
        | T
        | undefined;
      result = structuredClone(updater(current));
      JSON.stringify(result);
      this.data[key] = result;
      await this.persist();
    });
    return structuredClone(result as T);
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    this.writeQueue = this.writeQueue.then(operation, operation);
    return this.writeQueue;
  }

  private async persist(): Promise<void> {
    const snapshot = JSON.stringify(this.data, null, 2);
    const temporary = `${this.filename}.${nanoid()}.tmp`;
    await fs.promises.writeFile(temporary, snapshot, { encoding: 'utf8', mode: 0o600 });
    await fs.promises.rename(temporary, this.filename);
  }
}

const createPluginContext = async (plugin: RuntimePlugin): Promise<PluginContext> => {
  const { manifest } = plugin;
  const storage = await PluginStorage.create(manifest.id);
  const logger = debugFactory(`${import.meta.env.VITE_APP_NAME}:plugin:${manifest.id}`);
  const addRoute =
    (method: PluginHttpMethod) =>
    (
      route: string,
      handler: PluginHttpHandler,
      { access = 'local' }: { access?: PluginHttpAccess } = {},
    ) => {
      requirePermission(manifest, 'http.routes');
      if (typeof handler !== 'function')
        throw new Error('Обработчик маршрута должен быть функцией');
      const normalized = normalizeRoute(route);
      const duplicate = plugin.routes.some(
        item => item.method === method && item.path === normalized && item.access === access,
      );
      if (duplicate) throw new Error(`Маршрут уже зарегистрирован: ${method} ${normalized}`);
      plugin.routes.push({ method, path: normalized, access, handler });
    };

  return Object.freeze({
    apiVersion: '1.0.0',
    plugin: Object.freeze(structuredClone(manifest)),
    logger: {
      debug: (...args: unknown[]) => logger(args.map(String).join(' ')),
      error: (...args: unknown[]) => logger(`ERROR ${args.map(String).join(' ')}`),
      info: (...args: unknown[]) => logger(args.map(String).join(' ')),
      warn: (...args: unknown[]) => logger(`WARN ${args.map(String).join(' ')}`),
    },
    http: {
      delete: addRoute('DELETE'),
      get: addRoute('GET'),
      patch: addRoute('PATCH'),
      post: addRoute('POST'),
      put: addRoute('PUT'),
      response: (status: number, body?: unknown, headers?: Record<string, string>) => ({
        status,
        body,
        headers,
      }),
    },
    storage: {
      get: <T>(key: string, defaultValue?: T) => {
        requirePermission(manifest, 'storage');
        validateStorageKey(key);
        return storage.get<T>(key, defaultValue);
      },
      set: (key: string, value: unknown) => {
        requirePermission(manifest, 'storage');
        validateStorageKey(key);
        return storage.set(key, value);
      },
      update: <T>(key: string, updater: (value: T | undefined) => T) => {
        requirePermission(manifest, 'storage');
        validateStorageKey(key);
        return storage.update<T>(key, updater);
      },
    },
    events: {
      publish: (event: string, data?: unknown) => {
        requirePermission(manifest, 'realtime');
        if (!/^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,127}$/.test(event)) {
          throw new Error(`Недопустимое имя события: ${event}`);
        }
        broadcast({
          event: `plugin:${manifest.id}:${event}`,
          data: [data],
          all: true,
        });
      },
    },
    output: {
      registerPage: (page: { id: string; title: string; path: string }) =>
        registerOutputPage(plugin, page),
    },
  });
};

const loadPlugin = async (directory: string, manifest: PluginManifest): Promise<void> => {
  const plugin: RuntimePlugin = {
    directory,
    manifest,
    routes: [],
    ...(manifest.public
      ? { publicRoot: await resolveInstalledPath(directory, manifest.public, 'directory') }
      : {}),
  };
  runtimePlugins.set(manifest.id, plugin);

  try {
    for (const page of manifest.pages ?? []) await registerOutputPage(plugin, page);
    if (manifest.main) {
      const mainPath = await resolveInstalledPath(directory, manifest.main, 'file');
      const pluginRequire = createRequire(mainPath);
      const module = pluginRequire(mainPath) as PluginModule;
      const activate = module.activate ?? module.default?.activate;
      if (typeof activate !== 'function') {
        throw new Error('Backend плагина должен экспортировать функцию activate(context)');
      }
      await activate(await createPluginContext(plugin));
    }
  } catch (error) {
    runtimePlugins.delete(manifest.id);
    desiredPageIds.forEach(pageId => {
      if (pageId.startsWith(`${PLUGIN_PAGE_PREFIX}${manifest.id}:`)) {
        desiredPageIds.delete(pageId);
      }
    });
    throw error;
  }
};

const syncOutputPages = async (): Promise<void> => {
  const pages = await getPages();
  await Promise.all(
    pages
      .filter(page => page.id.startsWith(PLUGIN_PAGE_PREFIX) && !desiredPageIds.has(page.id))
      .map(page => deletePage(page.id)),
  );
  const screens = await getScreens();
  await Promise.all(
    screens
      .filter(screen => screen.test?.startsWith(PLUGIN_PAGE_PREFIX))
      .map(screen => updateTest(screen, true)),
  );
};

export const startPlugins = async (): Promise<void> => {
  if (started) return;
  started = true;
  await fs.promises.mkdir(path.join(rootDirectory(), STAGING_DIRECTORY), { recursive: true });
  await fs.promises.mkdir(path.join(rootDirectory(), DATA_DIRECTORY), { recursive: true });
  await loadRegistry();
  await Promise.all([dbReady, testsDeferred.promise]);

  for (const { directory, manifest } of await scanInstalled()) {
    if (!isEnabled(manifest.id)) continue;
    try {
      await loadPlugin(directory, manifest);
      debug(`Loaded plugin ${manifest.id}@${manifest.version}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runtimeErrors.set(manifest.id, message);
      debug(`Failed to load plugin ${manifest.id}: ${message}`);
    }
  }
  await syncOutputPages();
};

const queryRecord = (req: Request): Record<string, string | string[]> => {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') result[key] = value;
    else if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
      result[key] = value;
    }
  }
  return result;
};

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const sendPluginResult = (res: Response, value: unknown): void => {
  if (value === undefined) {
    res.sendStatus(204);
    return;
  }
  const response =
    value &&
    typeof value === 'object' &&
    ('status' in value || 'headers' in value || 'body' in value)
      ? (value as PluginHttpResponse)
      : undefined;
  if (response) {
    if (response.status) res.status(response.status);
    for (const [name, headerValue] of Object.entries(response.headers ?? {})) {
      res.setHeader(name, headerValue);
    }
    if (response.body === undefined) res.end();
    else if (Buffer.isBuffer(response.body) || typeof response.body === 'string')
      res.send(response.body);
    else res.json(response.body);
  } else {
    res.json(value);
  }
};

const dispatchPluginRoute =
  (access: PluginHttpAccess): RequestHandler =>
  (req, res, next) => {
    const pluginId = firstParam(req.params.pluginId);
    const plugin = pluginId ? runtimePlugins.get(pluginId) : undefined;
    const method = req.method.toUpperCase() as PluginHttpMethod;
    const requestPath = normalizeRoute(req.path || '/');
    const route = plugin?.routes.find(
      item => item.access === access && item.method === method && item.path === requestPath,
    );
    if (!route) {
      next();
      return;
    }
    Promise.resolve(
      route.handler({
        method,
        path: requestPath,
        query: queryRecord(req),
        body: req.body as unknown,
      }),
    ).then(value => sendPluginResult(res, value), next);
  };

const isLocalRequest = (req: Request): boolean => {
  const address = req.socket.remoteAddress?.replace(/^::ffff:/, '');
  return address === '127.0.0.1' || address === '::1';
};

export const localPluginApiHandler: RequestHandler = (req, res, next) => {
  if (!isLocalRequest(req)) {
    res.sendStatus(403);
    return;
  }
  dispatchPluginRoute('local')(req, res, next);
};

export const authenticatedPluginApiHandler: RequestHandler = dispatchPluginRoute('authenticated');

export const pluginStaticHandler: RequestHandler = (req, res, next) => {
  const pluginId = firstParam(req.params.pluginId);
  const plugin = pluginId ? runtimePlugins.get(pluginId) : undefined;
  if (!plugin?.publicRoot) {
    next();
    return;
  }
  express.static(plugin.publicRoot, {
    dotfiles: 'deny',
    fallthrough: true,
    index: false,
    redirect: false,
  })(req, res, next);
};

const installedStatus = (
  manifest: PluginManifest,
  runtime?: RuntimePlugin,
  error?: string,
): PluginStatus => ({
  manifest,
  enabled: isEnabled(manifest.id),
  loaded: runtime?.manifest.version === manifest.version,
  restartRequired:
    isEnabled(manifest.id) !== Boolean(runtime) || runtime?.manifest.version !== manifest.version,
  ...(error ? { error } : {}),
});

export const listPlugins = async (): Promise<PluginStatus[]> => {
  if (!pluginsRoot) {
    await fs.promises.mkdir(rootDirectory(), { recursive: true });
    await loadRegistry();
  }
  const installed = await scanInstalled();
  return installed
    .map(({ manifest }) =>
      installedStatus(manifest, runtimePlugins.get(manifest.id), runtimeErrors.get(manifest.id)),
    )
    .sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
};

const permissionLabels: Record<PluginPermission, string> = {
  'http.routes': 'локальные и авторизованные HTTP-маршруты',
  'output.pages': 'страницы в разделе «Вывод»',
  realtime: 'события реального времени',
  storage: 'постоянное хранилище',
};

const showMessage = async (options: Electron.MessageBoxOptions) => {
  return dialog.showMessageBox(options);
};

const installExtractedPlugin = async (
  staging: string,
  manifest: PluginManifest,
): Promise<{ updated: boolean }> => {
  const target = path.join(rootDirectory(), manifest.id);
  const backup = path.join(rootDirectory(), `.backup-${manifest.id}-${nanoid()}`);
  const targetExists = await fs.promises
    .stat(target)
    .then(() => true)
    .catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    });
  if (targetExists) await fs.promises.rename(target, backup);
  try {
    await fs.promises.rename(staging, target);
  } catch (error) {
    if (targetExists) await fs.promises.rename(backup, target).catch(() => undefined);
    throw error;
  }
  if (targetExists) {
    await fs.promises
      .rm(backup, { recursive: true, force: true })
      .catch(error =>
        debug(`Failed to remove plugin backup ${backup}: ${(error as Error).message}`),
      );
  }
  return { updated: targetExists };
};

export const installPluginFromDialog = async (): Promise<PluginInstallResult> => {
  const options: Electron.OpenDialogOptions = {
    title: 'Установить плагин gmib',
    filters: [{ name: 'Плагины gmib', extensions: ['gmib-plugin', 'zip'] }],
    properties: ['openFile'],
  };
  const result = await dialog.showOpenDialog(options);
  const [archivePath] = result.filePaths;
  if (result.canceled || !archivePath) return { status: 'cancelled' };

  const staging = path.join(rootDirectory(), STAGING_DIRECTORY, nanoid());
  await fs.promises.mkdir(path.dirname(staging), { recursive: true });
  try {
    const manifest = await extractPluginArchive(archivePath, staging);
    await validatePluginFiles(staging, manifest);
    const current = (await scanInstalled()).find(item => item.manifest.id === manifest.id);
    const permissionText =
      (manifest.permissions ?? [])
        .map(permission => `• ${permissionLabels[permission]}`)
        .join('\n') || 'Разрешения API не запрашиваются';
    const backendWarning = manifest.main
      ? '\n\nПлагин содержит доверенный backend-код. Он выполняется с правами gmib и должен быть получен из надёжного источника.'
      : '';
    const confirmation = await showMessage({
      type: manifest.main ? 'warning' : 'question',
      title: current ? 'Обновление плагина' : 'Установка плагина',
      message: `${current ? 'Обновить' : 'Установить'} «${manifest.name}» ${manifest.version}?`,
      detail: `${manifest.description ? `${manifest.description}\n\n` : ''}Разрешения:\n${permissionText}${backendWarning}`,
      buttons: [current ? 'Обновить' : 'Установить', 'Отмена'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    if (confirmation.response !== 0) return { status: 'cancelled' };
    const { updated } = await installExtractedPlugin(staging, manifest);
    registry.disabled = (registry.disabled ?? []).filter(id => id !== manifest.id);
    await saveRegistry();
    const plugin = installedStatus(manifest, runtimePlugins.get(manifest.id));
    return { status: 'installed', plugin, updated, restartRequired: true };
  } finally {
    await fs.promises.rm(staging, { recursive: true, force: true });
  }
};

export const setPluginEnabled = async (id: string, enabled: boolean): Promise<PluginStatus> => {
  const installed = (await scanInstalled()).find(item => item.manifest.id === id);
  if (!installed) throw new Error(`Плагин не найден: ${id}`);
  const disabled = new Set(registry.disabled ?? []);
  if (enabled) disabled.delete(id);
  else disabled.add(id);
  registry.disabled = [...disabled].sort();
  await saveRegistry();
  return installedStatus(installed.manifest, runtimePlugins.get(id), runtimeErrors.get(id));
};

export const uninstallPlugin = async (id: string): Promise<boolean> => {
  const installed = (await scanInstalled()).find(item => item.manifest.id === id);
  if (!installed) throw new Error(`Плагин не найден: ${id}`);
  const confirmation = await showMessage({
    type: 'warning',
    title: 'Удаление плагина',
    message: `Удалить «${installed.manifest.name}»?`,
    detail:
      'Файлы плагина будут удалены. Сохранённые данные останутся, чтобы их можно было восстановить при повторной установке.',
    buttons: ['Удалить', 'Отмена'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (confirmation.response !== 0) return false;
  await fs.promises.rm(installed.directory, { recursive: true, force: true });
  const pluginPages = (await getPages()).filter(page =>
    page.id.startsWith(`${PLUGIN_PAGE_PREFIX}${id}:`),
  );
  await Promise.all(pluginPages.map(page => deletePage(page.id)));
  desiredPageIds.forEach(pageId => {
    if (pageId.startsWith(`${PLUGIN_PAGE_PREFIX}${id}:`)) desiredPageIds.delete(pageId);
  });
  broadcast({ event: 'page', all: true });
  const screens = await getScreens();
  await Promise.all(
    screens
      .filter(screen => screen.test?.startsWith(`${PLUGIN_PAGE_PREFIX}${id}:`))
      .map(screen => updateTest(screen, true)),
  );
  registry.disabled = (registry.disabled ?? []).filter(item => item !== id);
  await saveRegistry();
  return true;
};

export const openPluginControl = async (id: string): Promise<void> => {
  const installed = (await scanInstalled()).find(item => item.manifest.id === id);
  const control = installed?.manifest.control;
  if (!installed || !control) throw new Error('Страница управления плагина не найдена');
  await shell.openExternal(pluginPublicUrl(id, control.path));
};
