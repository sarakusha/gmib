import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  downloads: '',
  userData: '',
  saveDialog: vi.fn(),
  fetch: vi.fn(),
  feature: vi.fn(() => true),
}));
vi.mock('electron', () => ({
  app: {
    whenReady: () => Promise.resolve(),
    getPath: (key: string) => (key === 'downloads' ? mocks.downloads : mocks.userData),
  },
  BrowserWindow: { fromWebContents: () => undefined },
  dialog: { showSaveDialog: mocks.saveDialog },
  ipcMain: { handle: vi.fn() },
}));
vi.mock('/@common/capabilities', () => ({ supportsFeature: mocks.feature }));
vi.mock('../src/windowStore', () => ({ findParamsByWebContentsId: vi.fn() }));

import { downloadMedia } from '../src/mediaDownload';

let root: string;
let sender: EventEmitter & { session: { fetch: typeof mocks.fetch }; isDestroyed: () => boolean };
const local = { host: 'localhost', nibusPort: 9010 };
const remote = { host: '192.0.2.4', nibusPort: 9010, info: { version: '3.6.5' } };

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'gmib-media-download-'));
  mocks.downloads = root;
  mocks.userData = path.join(root, 'userdata');
  await import('node:fs/promises').then(fs =>
    fs.mkdir(path.join(mocks.userData, 'media'), { recursive: true }),
  );
  mocks.saveDialog.mockReset();
  mocks.fetch.mockReset();
  mocks.feature.mockReset().mockReturnValue(true);
  sender = Object.assign(new EventEmitter(), {
    session: { fetch: mocks.fetch },
    isDestroyed: () => false,
  });
});
afterEach(async () => rm(root, { recursive: true, force: true }));

describe('downloadMedia', () => {
  it('copies a local media file into the selected destination', async () => {
    const source = path.join(mocks.userData, 'media', 'clip.mp4');
    const destination = path.join(root, 'saved.mp4');
    await writeFile(source, 'local bytes');
    mocks.saveDialog.mockResolvedValue({ canceled: false, filePath: destination });
    await expect(downloadMedia('clip.mp4', sender as never, local)).resolves.toBe(true);
    await expect(readFile(destination, 'utf8')).resolves.toBe('local bytes');
  });

  it('fetches remote bytes from the selected host and port', async () => {
    const destination = path.join(root, 'remote.mp4');
    mocks.saveDialog.mockResolvedValue({ canceled: false, filePath: destination });
    mocks.fetch.mockResolvedValue(new Response('remote bytes'));
    await expect(downloadMedia('clip.mp4', sender as never, remote)).resolves.toBe(true);
    expect(mocks.fetch).toHaveBeenCalledWith(
      'http://192.0.2.4:9011/public/clip.mp4',
      expect.objectContaining({ redirect: 'manual', signal: expect.any(AbortSignal) }),
    );
    await expect(readFile(destination, 'utf8')).resolves.toBe('remote bytes');
  });

  it('URL-encodes special characters in a remote filename', async () => {
    mocks.saveDialog.mockResolvedValue({
      canceled: false,
      filePath: path.join(root, 'special.mp4'),
    });
    mocks.fetch.mockResolvedValue(new Response('bytes'));
    await expect(downloadMedia('résumé #1.mp4', sender as never, remote)).resolves.toBe(true);
    expect(mocks.fetch).toHaveBeenCalledWith(
      'http://192.0.2.4:9011/public/r%C3%A9sum%C3%A9%20%231.mp4',
      expect.any(Object),
    );
  });

  it('returns false when the save dialog is canceled', async () => {
    mocks.saveDialog.mockResolvedValue({ canceled: true });
    await expect(downloadMedia('clip.mp4', sender as never, local)).resolves.toBe(false);
  });

  it('preserves an existing destination when the remote request fails', async () => {
    const destination = path.join(root, 'keep.mp4');
    await writeFile(destination, 'old file');
    mocks.saveDialog.mockResolvedValue({ canceled: false, filePath: destination });
    mocks.fetch.mockResolvedValue(new Response(null, { status: 404 }));
    await expect(downloadMedia('clip.mp4', sender as never, remote)).rejects.toThrow(/не найден/);
    await expect(readFile(destination, 'utf8')).resolves.toBe('old file');
  });

  it('preserves destination and removes the temporary file after a mid-stream failure', async () => {
    const destination = path.join(root, 'keep-after-stream-error.mp4');
    await writeFile(destination, 'old file');
    mocks.saveDialog.mockResolvedValue({ canceled: false, filePath: destination });
    let bodyController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        bodyController = controller;
        controller.enqueue(new TextEncoder().encode('partial new bytes'));
      },
    });
    mocks.fetch.mockResolvedValue(new Response(body));
    const pending = downloadMedia('clip.mp4', sender as never, remote);
    await vi.waitFor(async () => {
      expect((await readdir(root)).some(name => name.endsWith('.download'))).toBe(true);
    });
    bodyController?.error(new Error('connection interrupted'));
    await expect(pending).rejects.toThrow('connection interrupted');
    await expect(readFile(destination, 'utf8')).resolves.toBe('old file');
    await expect(readdir(root)).resolves.toEqual(
      expect.not.arrayContaining([expect.stringMatching(/\.download$/)]),
    );
  });

  it('aborts and removes the temporary file if the sender closes during transfer', async () => {
    const destination = path.join(root, 'closed-window.mp4');
    mocks.saveDialog.mockResolvedValue({ canceled: false, filePath: destination });
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('partial bytes'));
      },
    });
    mocks.fetch.mockResolvedValue(new Response(body));
    const pending = downloadMedia('clip.mp4', sender as never, remote);
    await vi.waitFor(async () => {
      expect((await readdir(root)).some(name => name.endsWith('.download'))).toBe(true);
    });
    sender.emit('destroyed');
    await expect(pending).rejects.toThrow();
    await expect(readdir(root)).resolves.toEqual(
      expect.not.arrayContaining([expect.stringMatching(/\.download$/)]),
    );
    await expect(readFile(destination)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not allow saving a local media file over its source', async () => {
    const source = path.join(mocks.userData, 'media', 'clip.mp4');
    await writeFile(source, 'original bytes');
    mocks.saveDialog.mockResolvedValue({ canceled: false, filePath: source });
    await expect(downloadMedia('clip.mp4', sender as never, local)).rejects.toThrow(/оригинал/);
    await expect(readFile(source, 'utf8')).resolves.toBe('original bytes');
  });

  it.each(['../clip.mp4', 'folder\\clip.mp4', '.', '..', 'a\0b'])(
    'rejects unsafe filename %s',
    async filename => {
      await expect(downloadMedia(filename, sender as never, local)).rejects.toThrow();
      expect(mocks.saveDialog).not.toHaveBeenCalled();
    },
  );

  it('rejects unsupported remote versions before opening the dialog', async () => {
    mocks.feature.mockReturnValue(false);
    await expect(
      downloadMedia('clip.mp4', sender as never, { ...remote, info: { version: '3.6.4' } }),
    ).rejects.toThrow(/версии/);
    expect(mocks.saveDialog).not.toHaveBeenCalled();
  });
});
