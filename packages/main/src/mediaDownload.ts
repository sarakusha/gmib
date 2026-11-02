import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { createReadStream, createWriteStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

import { isGmib } from '/@common/WindowParams';
import { supportsFeature } from '/@common/capabilities';
import { findParamsByWebContentsId } from './windowStore';

const validateFilename: (filename: unknown) => asserts filename is string = filename => {
  if (
    typeof filename !== 'string' ||
    !filename ||
    filename === '.' ||
    filename === '..' ||
    /[\\/\0]/.test(filename) ||
    path.basename(filename) !== filename
  ) {
    throw new Error('Некорректное имя файла');
  }
};

const copyToDestination = async (
  source: Readable,
  destination: string,
  sender: Electron.WebContents,
  parentSignal?: AbortSignal,
  onChunk?: () => void,
): Promise<void> => {
  const directory = path.dirname(destination);
  const temporary = path.join(directory, `.gmib-${randomUUID()}.download`);
  let complete = false;
  const abort = new AbortController();
  const onParentAbort = () => abort.abort(parentSignal?.reason);
  if (parentSignal?.aborted) abort.abort(parentSignal.reason);
  parentSignal?.addEventListener('abort', onParentAbort, { once: true });
  const onDestroyed = () => abort.abort(new Error('Окно закрыто'));
  sender.once('destroyed', onDestroyed);
  try {
    if (sender.isDestroyed()) abort.abort(new Error('Окно закрыто'));
    if (abort.signal.aborted) throw abort.signal.reason;
    // wx prevents collisions and never truncates an existing file during transfer.
    const output = createWriteStream(temporary, { flags: 'wx', mode: 0o600 });
    const chunkObserver = new Transform({
      transform(chunk, _encoding, callback) {
        onChunk?.();
        callback(null, chunk);
      },
    });
    await pipeline(source, chunkObserver, output, { signal: abort.signal });
    if (sender.isDestroyed() || abort.signal.aborted)
      throw abort.signal.reason ?? new Error('Окно закрыто');
    await fs.rename(temporary, destination);
    complete = true;
  } finally {
    sender.removeListener('destroyed', onDestroyed);
    parentSignal?.removeEventListener('abort', onParentAbort);
    if (!complete) {
      source.destroy();
      await fs.rm(temporary, { force: true }).catch(() => undefined);
    }
  }
};

const assertNotSource = async (source: string, destination: string): Promise<void> => {
  const sourceReal = await fs.realpath(source);
  if (path.resolve(source) === path.resolve(destination))
    throw new Error('Нельзя сохранить файл поверх оригинала');
  try {
    if ((await fs.realpath(destination)) === sourceReal)
      throw new Error('Нельзя сохранить файл поверх оригинала');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
};

export const downloadMedia = async (
  filename: string,
  sender: Electron.WebContents,
  params: { host: string; nibusPort: number; info?: { version?: string } },
): Promise<boolean> => {
  validateFilename(filename);
  const remote = params.host !== 'localhost';
  if (!supportsFeature('mediaFileDownload', params.info?.version, remote)) {
    throw new Error('Загрузка файлов недоступна на этой версии удаленного GMIB');
  }
  const parent = BrowserWindow.fromWebContents(sender) ?? undefined;
  const options: Electron.SaveDialogOptions = {
    defaultPath: path.join(app.getPath('downloads'), filename),
    properties: ['showOverwriteConfirmation', 'createDirectory'],
  };
  const { canceled, filePath } = parent
    ? await dialog.showSaveDialog(parent, options)
    : await dialog.showSaveDialog(options);
  if (canceled || !filePath) return false;
  if (sender.isDestroyed()) throw new Error('Окно закрыто');

  if (!remote) {
    const source = path.join(app.getPath('userData'), 'media', filename);
    const sourceStat = await fs.lstat(source);
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink())
      throw new Error('Локальный медиафайл не найден');
    await assertNotSource(source, filePath);
    await copyToDestination(createReadStream(source), filePath, sender);
    return true;
  }

  const controller = new AbortController();
  const inactivityTimeoutMs = 30_000;
  let timeout!: NodeJS.Timeout;
  const resetInactivityTimeout = () => {
    clearTimeout(timeout);
    timeout = setTimeout(
      () => controller.abort(new Error('Нет данных при загрузке файла в течение 30 секунд')),
      inactivityTimeoutMs,
    );
    timeout.unref();
  };
  // This also bounds waiting for response headers / the first body chunk.
  resetInactivityTimeout();
  const onDestroyed = () => controller.abort(new Error('Окно закрыто'));
  sender.once('destroyed', onDestroyed);
  try {
    const url = `http://${params.host}:${params.nibusPort + 1}/public/${encodeURIComponent(filename)}`;
    const response = await sender.session.fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
    });
    if (response.status < 200 || response.status >= 300 || !response.body) {
      await response.body?.cancel();
      throw new Error(
        response.status === 404
          ? 'Файл на удаленном компьютере не найден'
          : `Ошибка загрузки файла: HTTP ${response.status}`,
      );
    }
    const webContentsStream = Readable.fromWeb(response.body as WebReadableStream);
    await copyToDestination(
      webContentsStream,
      filePath,
      sender,
      controller.signal,
      resetInactivityTimeout,
    );
    return true;
  } finally {
    clearTimeout(timeout);
    sender.removeListener('destroyed', onDestroyed);
  }
};

void app.whenReady().then(() => {
  ipcMain.handle('downloadMedia', async (event, filename: string) => {
    const params = findParamsByWebContentsId(event.sender.id);
    if (!isGmib(params)) throw new Error('Загрузка доступна только из окна GMIB');
    return downloadMedia(filename, event.sender, params);
  });
});
