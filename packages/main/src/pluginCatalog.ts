import { createHash, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';
import debugFactory from 'debug';
import { nanoid } from 'nanoid';
import semver from 'semver';

import type {
  PluginCatalogEntry,
  PluginCatalogPublisher,
  PluginCatalogRelease,
  PluginInstallResult,
} from '/@common/plugins';
import { GMIB_PLUGIN_API_VERSION } from '/@common/plugins';

import { MAX_PLUGIN_ARCHIVE_SIZE } from './pluginArchive';
import { installPluginFromArchive, listPlugins } from './pluginHost';
import { parsePluginManifest } from './pluginManifest';

export const OFFICIAL_PLUGIN_CATALOG_URL =
  'https://raw.githubusercontent.com/sarakusha/gmib-plugins/main/catalog.json';
const OFFICIAL_PLUGIN_REPOSITORY_URL = 'https://github.com/sarakusha/gmib-plugins';
const OFFICIAL_PLUGIN_RELEASE_PREFIX = `${OFFICIAL_PLUGIN_REPOSITORY_URL}/releases/download/`;

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:plugin-catalog`);
const MAX_CATALOG_SIZE = 1024 * 1024;
const MAX_CATALOG_ENTRIES = 500;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CATALOG_TIMEOUT = 15_000;
const DOWNLOAD_TIMEOUT = 120_000;

type CatalogDocument = {
  schemaVersion: 1;
  generatedAt: string;
  source: string;
  plugins: PluginCatalogEntry[];
};

let cachedCatalog: PluginCatalogEntry[] | undefined;

const recordValue = (value: unknown, field: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Поле "${field}" должно содержать объект`);
  }
  return value as Record<string, unknown>;
};

const stringValue = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Поле "${field}" должно содержать непустую строку`);
  }
  return value.trim();
};

const httpsUrl = (value: unknown, field: string): string => {
  const input = stringValue(value, field);
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`Поле "${field}" должно содержать URL`);
  }
  if (url.protocol !== 'https:') throw new Error(`Поле "${field}" должно использовать HTTPS`);
  return url.href;
};

const parsePublisher = (value: unknown, index: number): PluginCatalogPublisher => {
  const publisher = recordValue(value, `plugins[${index}].publisher`);
  if (publisher.verified !== true || publisher.id !== 'sarakusha') {
    throw new Error(`Поле "plugins[${index}].publisher" содержит неизвестного издателя`);
  }
  return {
    id: stringValue(publisher.id, `plugins[${index}].publisher.id`),
    name: stringValue(publisher.name, `plugins[${index}].publisher.name`),
    verified: publisher.verified,
  };
};

const parseRelease = (value: unknown, index: number): PluginCatalogRelease => {
  const release = recordValue(value, `plugins[${index}].release`);
  const sha256 = stringValue(release.sha256, `plugins[${index}].release.sha256`).toLowerCase();
  if (!SHA256_PATTERN.test(sha256)) {
    throw new Error(`Поле "plugins[${index}].release.sha256" должно содержать SHA-256`);
  }
  if (
    typeof release.size !== 'number' ||
    !Number.isSafeInteger(release.size) ||
    release.size <= 0 ||
    release.size > MAX_PLUGIN_ARCHIVE_SIZE
  ) {
    throw new Error(`Поле "plugins[${index}].release.size" содержит недопустимый размер`);
  }
  const url = httpsUrl(release.url, `plugins[${index}].release.url`);
  if (!url.startsWith(OFFICIAL_PLUGIN_RELEASE_PREFIX)) {
    throw new Error(`Поле "plugins[${index}].release.url" ведёт за пределы официального проекта`);
  }
  return {
    url,
    sha256,
    size: release.size,
  };
};

export const parsePluginCatalog = (value: unknown): PluginCatalogEntry[] => {
  const catalog = recordValue(value, 'catalog') as Partial<CatalogDocument>;
  if (catalog.schemaVersion !== 1) throw new Error('Неизвестная версия схемы каталога плагинов');
  stringValue(catalog.generatedAt, 'generatedAt');
  if (httpsUrl(catalog.source, 'source') !== OFFICIAL_PLUGIN_REPOSITORY_URL) {
    throw new Error('Каталог ссылается на неизвестный исходный проект');
  }
  if (!Array.isArray(catalog.plugins) || catalog.plugins.length > MAX_CATALOG_ENTRIES) {
    throw new Error('Поле "plugins" должно содержать допустимый массив');
  }

  const result: PluginCatalogEntry[] = [];
  const ids = new Set<string>();
  for (const [index, value] of catalog.plugins.entries()) {
    const entry = recordValue(value, `plugins[${index}]`);
    const rawManifest = recordValue(entry.manifest, `plugins[${index}].manifest`);
    const gmibApi = stringValue(rawManifest.gmibApi, `plugins[${index}].manifest.gmibApi`);
    if (semver.validRange(gmibApi) && !semver.satisfies(GMIB_PLUGIN_API_VERSION, gmibApi)) {
      continue;
    }
    const manifest = parsePluginManifest(rawManifest);
    if (ids.has(manifest.id)) throw new Error(`Каталог повторяет плагин "${manifest.id}"`);
    ids.add(manifest.id);
    const repository = httpsUrl(entry.repository, `plugins[${index}].repository`);
    if (repository !== OFFICIAL_PLUGIN_REPOSITORY_URL) {
      throw new Error(`Плагин "${manifest.id}" ссылается на неизвестный проект`);
    }
    result.push({
      manifest,
      publisher: parsePublisher(entry.publisher, index),
      repository,
      release: parseRelease(entry.release, index),
    });
  }
  return result.sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
};

const downloadBuffer = async (entry: PluginCatalogEntry): Promise<Buffer> => {
  let response: Response;
  try {
    response = await fetch(entry.release.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT),
    });
  } catch (error) {
    throw new Error(
      `Не удалось скачать плагин по адресу ${entry.release.url}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Не удалось скачать плагин по адресу ${entry.release.url}: HTTP ${response.status}`,
    );
  }
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_PLUGIN_ARCHIVE_SIZE) {
    throw new Error('Размер скачиваемого плагина превышает 50 МБ');
  }
  if (!response.body) throw new Error('Сервер вернул пустой файл плагина');

  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_PLUGIN_ARCHIVE_SIZE) {
      await reader.cancel();
      throw new Error('Размер скачиваемого плагина превышает 50 МБ');
    }
    chunks.push(value);
  }
  const archive = Buffer.concat(chunks, size);
  if (archive.byteLength !== entry.release.size) {
    throw new Error('Размер скачанного плагина не совпадает с официальным каталогом');
  }
  const actualHash = createHash('sha256').update(archive).digest();
  const expectedHash = Buffer.from(entry.release.sha256, 'hex');
  if (!timingSafeEqual(actualHash, expectedHash)) {
    throw new Error('SHA-256 скачанного плагина не совпадает с официальным каталогом');
  }
  return archive;
};

export const listOfficialPlugins = async (): Promise<PluginCatalogEntry[]> => {
  try {
    const response = await fetch(OFFICIAL_PLUGIN_CATALOG_URL, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(CATALOG_TIMEOUT),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_CATALOG_SIZE) {
      throw new Error('размер каталога превышает 1 МБ');
    }
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_CATALOG_SIZE) {
      throw new Error('размер каталога превышает 1 МБ');
    }
    cachedCatalog = parsePluginCatalog(JSON.parse(text) as unknown);
    return cachedCatalog;
  } catch (error) {
    if (cachedCatalog) {
      debug(`Failed to refresh official plugin catalog: ${(error as Error).message}`);
      return cachedCatalog;
    }
    throw new Error(
      `Не удалось загрузить официальный каталог плагинов (${OFFICIAL_PLUGIN_CATALOG_URL}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

export const installOfficialPlugin = async (id: string): Promise<PluginInstallResult> => {
  const entry = (await listOfficialPlugins()).find(plugin => plugin.manifest.id === id);
  if (!entry) throw new Error(`Официальный плагин не найден: ${id}`);
  const installed = (await listPlugins()).find(plugin => plugin.manifest.id === id);
  if (installed && !semver.gt(entry.manifest.version, installed.manifest.version)) {
    throw new Error(`Версия ${entry.manifest.version} уже установлена`);
  }

  const archive = await downloadBuffer(entry);
  const temporaryDirectory = await fs.promises.mkdtemp(
    path.join(app.getPath('temp'), `gmib-plugin-${nanoid()}-`),
  );
  const archivePath = path.join(temporaryDirectory, `${id}.gmib-plugin`);
  try {
    await fs.promises.writeFile(archivePath, archive, { mode: 0o600 });
    return await installPluginFromArchive(archivePath, entry.manifest);
  } finally {
    await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
  }
};
