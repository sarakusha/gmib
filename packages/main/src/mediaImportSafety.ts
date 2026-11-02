import fs from 'node:fs/promises';
import os from 'node:os';

import debugFactory from 'debug';
import { fileTypeFromFile } from 'file-type';
import type { File } from 'formidable';

import { IMAGE_HEADER_BYTES, readImageDimensions } from '/@common/imageDimensions';
import { getImageImportError } from '/@common/imageImportLimits';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:mediaImport`);
const MiB = 1024 ** 2;

export const removeImportFile = async (filename: string): Promise<void> => {
  try {
    await fs.rm(filename, { force: true });
  } catch (error) {
    // Cleanup must not replace the original conversion error or invalidate a committed import.
    debug('Unable to remove import file %s: %s', filename, error);
  }
};

export const getAvailableImportMemory = async (): Promise<number> => {
  if (os.platform() === 'linux') {
    try {
      // Unlike MemFree, MemAvailable includes reclaimable caches on Linux players.
      const info = await fs.readFile('/proc/meminfo', 'utf8');
      const available = /^MemAvailable:\s+(\d+)\s+kB$/m.exec(info);
      if (available) return Number(available[1]) * 1024;
    } catch {
      // Other platforms and systems without procfs use the portable conservative estimate.
    }
  }
  return os.freemem();
};

export const inspectImageImport = async (
  file: Pick<File, 'filepath' | 'mimetype'>,
): Promise<{ width: number; height: number } | undefined> => {
  const handle = await fs.open(file.filepath, 'r');
  let dimensions: ReturnType<typeof readImageDimensions>;
  try {
    const header = Buffer.alloc(IMAGE_HEADER_BYTES);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    dimensions = readImageDimensions(header.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
  // The browser's MIME is untrusted; recognize images sent as video/octet-stream too.
  const type = await fileTypeFromFile(file.filepath).catch(cause => {
    throw new Error(
      'Не удалось прочитать медиафайл. Проверьте, что файл не повреждён, и повторите загрузку.',
      { cause },
    );
  });
  const isImage =
    dimensions || file.mimetype?.startsWith('image/') || type?.mime.startsWith('image/');
  if (!isImage) return undefined;
  const error = getImageImportError(dimensions?.width, dimensions?.height);
  if (error) throw new Error(error);
  if (!dimensions) throw new Error('Не удалось определить размер изображения.');
  // Admission budget, not an OS memory limit: bounded encoder threads/lookahead are also required.
  const required = dimensions.width * dimensions.height * 32 + 256 * MiB;
  if ((await getAvailableImportMemory()) < required) {
    throw new Error(
      `Недостаточно свободной памяти для обработки изображения ${dimensions.width}×${dimensions.height}. Уменьшите изображение до разрешения экрана или освободите память и повторите загрузку.`,
    );
  }
  return dimensions;
};

export const getMediaImportError = (error: unknown): string => {
  if (error && typeof error === 'object') {
    if ('timedOut' in error && error.timedOut) {
      return 'Обработка файла заняла слишком много времени и остановлена. Уменьшите изображение или перекодируйте видео и повторите загрузку.';
    }
    if (
      ('signal' in error && error.signal === 'SIGKILL') ||
      ('code' in error && error.code === 'ENOMEM')
    ) {
      return 'Обработка файла принудительно остановлена; возможно, компьютеру не хватило памяти. Уменьшите изображение или перекодируйте видео и повторите загрузку.';
    }
    if ('isMaxBuffer' in error && error.isMaxBuffer) {
      return 'Обработка файла остановлена из-за слишком большого объёма диагностических сообщений. Проверьте файл или сохраните его в другом формате.';
    }
    if ('shortMessage' in error || 'escapedCommand' in error || 'exitCode' in error) {
      return 'Не удалось обработать медиафайл. Проверьте, что он не повреждён, или сохраните его в другом формате.';
    }
  }
  return error instanceof Error ? error.message : String(error);
};
