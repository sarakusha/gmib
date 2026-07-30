import fs from 'node:fs';
import path from 'node:path';

import AdmZip from 'adm-zip';

import type { PluginManifest } from '/@common/plugins';

import { parsePluginManifest } from './pluginManifest';

const MAX_ARCHIVE_SIZE = 50 * 1024 * 1024;
const MAX_EXTRACTED_SIZE = 200 * 1024 * 1024;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 2_000;

const entryPath = (name: string): string => {
  const normalized = path.posix.normalize(name.replaceAll('\\', '/'));
  if (
    normalized === '.' ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    path.posix.isAbsolute(normalized) ||
    /^[a-zA-Z]:/.test(normalized) ||
    normalized.includes('\0')
  ) {
    throw new Error(`Архив содержит недопустимый путь: ${name}`);
  }
  return normalized.replace(/\/$/, '');
};

const isSymbolicLink = (attr: number): boolean => ((attr >>> 16) & 0xf000) === 0xa000;

const insideDirectory = (root: string, relative: string): string => {
  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Архив пытается записать файл вне каталога плагина: ${relative}`);
  }
  return resolved;
};

export const extractPluginArchive = async (
  archivePath: string,
  destination: string,
): Promise<PluginManifest> => {
  const archiveStats = await fs.promises.stat(archivePath);
  if (!archiveStats.isFile()) throw new Error('Выбранный путь не является файлом');
  if (archiveStats.size > MAX_ARCHIVE_SIZE) {
    throw new Error('Размер архива плагина превышает 50 МБ');
  }

  const archive = new AdmZip(archivePath);
  const entries = archive.getEntries();
  if (entries.length === 0) throw new Error('Архив плагина пуст');
  if (entries.length > MAX_FILES) throw new Error('Архив плагина содержит слишком много файлов');

  let extractedSize = 0;
  const names = new Set<string>();
  for (const entry of entries) {
    const relative = entryPath(entry.entryName);
    if (!relative) continue;
    if (names.has(relative)) throw new Error(`Архив содержит повторяющийся путь: ${relative}`);
    names.add(relative);
    if (isSymbolicLink(entry.attr)) {
      throw new Error(`Символические ссылки в плагинах запрещены: ${relative}`);
    }
    if (!entry.isDirectory) {
      if (entry.header.size > MAX_FILE_SIZE) {
        throw new Error(`Файл плагина превышает 50 МБ: ${relative}`);
      }
      extractedSize += entry.header.size;
      if (extractedSize > MAX_EXTRACTED_SIZE) {
        throw new Error('Общий распакованный размер плагина превышает 200 МБ');
      }
    }
  }

  await fs.promises.mkdir(destination, { recursive: true });
  for (const entry of entries) {
    const relative = entryPath(entry.entryName);
    if (!relative) continue;
    const target = insideDirectory(destination, relative);
    if (entry.isDirectory) {
      await fs.promises.mkdir(target, { recursive: true });
      continue;
    }
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    const data = entry.getData();
    if (data.length > MAX_FILE_SIZE || data.length !== entry.header.size) {
      throw new Error(`Некорректный распакованный размер файла: ${relative}`);
    }
    await fs.promises.writeFile(target, data, { flag: 'wx', mode: 0o600 });
  }

  const manifestPath = path.join(destination, 'manifest.json');
  let manifestValue: unknown;
  try {
    manifestValue = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(
      `Не удалось прочитать manifest.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return parsePluginManifest(manifestValue);
};
