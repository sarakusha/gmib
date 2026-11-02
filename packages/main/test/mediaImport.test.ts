import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { File } from 'formidable';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { getImageImportError, MAX_IMAGE_PIXELS } from '/@common/imageImportLimits';

const mocks = vi.hoisted(() => ({
  readFileMeta: vi.fn(),
  generateFromImage: vi.fn(),
  renderThumbnailFromImage: vi.fn(),
  insertMedia: vi.fn(),
  getMediaByOriginalMD5: vi.fn(),
  freemem: vi.fn(() => 8 * 1024 ** 3),
}));
vi.mock('node:os', async importOriginal => ({
  default: {
    ...(await importOriginal<typeof import('node:os')>()),
    platform: () => 'darwin',
    freemem: mocks.freemem,
  },
}));
vi.mock('../src/db', () => ({ incrementCounterString: (name: string) => `${name}1` }));
vi.mock('../src/media', () => ({
  insertMedia: mocks.insertMedia,
  getMediaByOriginalMD5: mocks.getMediaByOriginalMD5,
}));
vi.mock('../src/ffmpeg', () => ({
  outExt: 'mkv',
  readFileMeta: mocks.readFileMeta,
  generateFromImage: mocks.generateFromImage,
  renderThumbnailFromImage: mocks.renderThumbnailFromImage,
  renderThumbnail: (input: string, _timestamp: number, output: string) =>
    mocks.renderThumbnailFromImage(input, output),
  getSmarterOutFormat: async () => 'matroska',
  doesPlayerSupportFile: () => true,
  isDurationValid: (value: number) => value > 0,
  getTimecodeFromStreams: () => undefined,
  getRealVideoStreams: (streams: unknown[]) => streams,
  getAudioStreams: () => [],
  getStreamFps: () => 25,
}));

import { loadMedia } from '../src/mediaImport';
import { getMediaImportError } from '../src/mediaImportSafety';

let directory: string;
const pngHeader = (width: number, height: number): Buffer => {
  const header = Buffer.alloc(45);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(header);
  header.writeUInt32BE(13, 8);
  header.write('IHDR', 12);
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  header[24] = 8;
  header[25] = 2;
  header.write('IEND', 37);
  return header;
};
const upload = async (name: string, width = 1920, height = 1080, mimetype = 'image/png') => {
  const filepath = path.join(directory, name);
  await fs.writeFile(filepath, pngHeader(width, height));
  return { filepath, originalFilename: name, newFilename: name, mimetype, hash: name } as File;
};
const meta = {
  format: { duration: '5', size: '100' },
  streams: [{ index: 0, codec_type: 'video', width: 1920, height: 1080 }],
};

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.freemem.mockReturnValue(8 * 1024 ** 3);
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gmib-import-'));
  mocks.getMediaByOriginalMD5.mockResolvedValue(undefined);
  mocks.insertMedia.mockResolvedValue(undefined);
  mocks.readFileMeta.mockResolvedValue(meta);
  mocks.generateFromImage.mockImplementation(async ({ outPath }: { outPath: string }) =>
    fs.writeFile(outPath, 'converted'),
  );
  mocks.renderThumbnailFromImage.mockImplementation(async (_input: string, output: string) => {
    await fs.writeFile(output, 'thumbnail');
    return output;
  });
});
afterEach(async () => fs.rm(directory, { recursive: true, force: true }));

it('rejects the incident image before probing, conversion or thumbnails, even with video MIME', async () => {
  const file = await upload('huge.png', 10984, 3898, 'video/mp4');
  await expect(loadMedia(file, directory)).rejects.toThrow('10984×3898');
  expect(mocks.readFileMeta).not.toHaveBeenCalled();
  expect(mocks.generateFromImage).not.toHaveBeenCalled();
  expect(mocks.renderThumbnailFromImage).not.toHaveBeenCalled();
  expect(mocks.insertMedia).not.toHaveBeenCalled();
});

it('checks both area and side limits, and accepts the exact pixel boundary', () => {
  expect(getImageImportError(4096, 4096)).toBeUndefined();
  expect(4096 * 4096).toBe(MAX_IMAGE_PIXELS);
  expect(getImageImportError(4097, 4096)).toContain('слишком большое');
  expect(getImageImportError(8193, 2)).toContain('слишком большое');
  expect(getImageImportError(undefined, 400)).toContain('Не удалось');
  expect(getImageImportError(1, 400)).toContain('Не удалось');
});

it('rejects unknown or malformed image headers before ffprobe', async () => {
  const file = await upload('broken.png');
  await fs.writeFile(file.filepath, 'not an image');
  await expect(loadMedia(file, directory)).rejects.toThrow('Не удалось безопасно определить');
  expect(mocks.readFileMeta).not.toHaveBeenCalled();
});

it('rejects a supported-size image when the available memory budget is insufficient', async () => {
  mocks.freemem.mockReturnValue(100 * 1024 ** 2);
  await expect(loadMedia(await upload('low-memory.png'), directory)).rejects.toThrow(
    'Недостаточно свободной памяти',
  );
  expect(mocks.readFileMeta).not.toHaveBeenCalled();
});

it('rechecks dimensions reported by ffprobe before conversion', async () => {
  mocks.readFileMeta.mockResolvedValueOnce({
    ...meta,
    streams: [{ index: 0, codec_type: 'video', width: 20000, height: 20000 }],
  });
  await expect(loadMedia(await upload('mismatch.png'), directory)).rejects.toThrow('20000×20000');
  expect(mocks.generateFromImage).not.toHaveBeenCalled();
});

it('serializes separate requests, cleans SIGKILL partial output and continues with the next upload', async () => {
  let rejectConversion!: (reason: unknown) => void;
  let started!: () => void;
  const entered = new Promise<void>(resolve => {
    started = resolve;
  });
  mocks.generateFromImage.mockImplementationOnce(async ({ outPath }: { outPath: string }) => {
    await fs.writeFile(outPath, 'incomplete');
    started();
    await new Promise<void>((_resolve, reject) => {
      rejectConversion = reject;
    });
  });
  const first = loadMedia(await upload('first.png'), directory);
  const failed = expect(first).rejects.toMatchObject({ signal: 'SIGKILL' });
  await entered;
  const next = loadMedia(await upload('second.png'), directory);
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(mocks.generateFromImage).toHaveBeenCalledTimes(1);
  rejectConversion(Object.assign(new Error('secret ffmpeg full command'), { signal: 'SIGKILL' }));
  await failed;
  await expect(next).resolves.toMatchObject({ filename: 'second.mkv' });
  await expect(fs.stat(path.join(directory, 'first.mkv'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
  expect(mocks.insertMedia).toHaveBeenCalledTimes(1);
});

it('cleans both converted output and a failed thumbnail without inserting media', async () => {
  mocks.renderThumbnailFromImage.mockImplementationOnce(async (_input: string, output: string) => {
    await fs.writeFile(output, 'partial thumbnail');
    throw new Error('thumbnail failure');
  });
  await expect(loadMedia(await upload('thumb.png'), directory)).rejects.toThrow(
    'thumbnail failure',
  );
  expect(await fs.readdir(directory)).toEqual(['thumb.png']);
  expect(mocks.insertMedia).not.toHaveBeenCalled();
});

it('returns safe actionable errors for killed, timed out and failed subprocesses', () => {
  expect(getMediaImportError({ signal: 'SIGKILL', message: 'ffmpeg secret command' })).toContain(
    'возможно',
  );
  expect(getMediaImportError({ timedOut: true })).toContain('слишком много времени');
  expect(getMediaImportError({ isMaxBuffer: true })).toContain('диагностических сообщений');
  expect(getMediaImportError({ exitCode: 1, message: 'ffmpeg secret command' })).not.toContain(
    'secret',
  );
  expect(getMediaImportError(new Error('Размер 10000×10000'))).toBe('Размер 10000×10000');
});

it('preserves an existing thumbnail by selecting a different output filename', async () => {
  await fs.writeFile(path.join(directory, 'reserved.mkv.png'), 'existing unrelated upload');
  mocks.generateFromImage.mockImplementationOnce(async ({ outPath }: { outPath: string }) => {
    await fs.writeFile(outPath, 'partial');
    throw new Error('conversion failed');
  });
  await expect(loadMedia(await upload('reserved.png'), directory)).rejects.toThrow(
    'conversion failed',
  );
  expect(await fs.readFile(path.join(directory, 'reserved.mkv.png'), 'utf8')).toBe(
    'existing unrelated upload',
  );
  expect(await fs.readdir(directory)).toEqual(['reserved.mkv.png', 'reserved.png']);
});

it('publishes supported video from staging before the request staging directory is removed', async () => {
  const staging = path.join(directory, '.upload-test');
  await fs.mkdir(staging);
  const filepath = path.join(staging, 'random-upload.mkv');
  await fs.writeFile(
    filepath,
    Buffer.from('000000186674797069736f6d0000000069736f6d6d703432', 'hex'),
  );
  const file = {
    filepath,
    originalFilename: 'clip.mkv',
    newFilename: 'random-upload.mkv',
    hash: 'video-hash',
    mimetype: 'video/mp4',
  } as File;
  await expect(loadMedia(file, directory)).resolves.toMatchObject({ filename: 'clip.mkv' });
  await fs.rm(staging, { recursive: true, force: true });
  expect((await fs.stat(path.join(directory, 'clip.mkv'))).size).toBe(24);
  expect(await fs.readFile(path.join(directory, 'clip.mkv.png'), 'utf8')).toBe('thumbnail');
  expect(mocks.generateFromImage).not.toHaveBeenCalled();
});

it('rejects conflicting metadata even when both dimensions are within the hard limit', async () => {
  mocks.readFileMeta.mockResolvedValueOnce({
    ...meta,
    streams: [{ index: 0, codec_type: 'video', width: 4096, height: 4096 }],
  });
  await expect(loadMedia(await upload('conflicting.png'), directory)).rejects.toThrow(
    'не совпадают',
  );
  expect(mocks.generateFromImage).not.toHaveBeenCalled();
});

it('reports a truncated format header in Russian before launching ffprobe', async () => {
  const file = await upload('truncated.png');
  await fs.writeFile(file.filepath, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  await expect(loadMedia(file, directory)).rejects.toThrow('Не удалось');
  expect(mocks.readFileMeta).not.toHaveBeenCalled();
});
