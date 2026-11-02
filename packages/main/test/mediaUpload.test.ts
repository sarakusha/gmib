import fs from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';

import express, { type ErrorRequestHandler } from 'express';
import type { File } from 'formidable';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ loadMedia: vi.fn(), getAllMedia: vi.fn(), onUploaded: vi.fn() }));
vi.mock('../src/mediaImport', () => ({ loadMedia: mocks.loadMedia }));
vi.mock('../src/media', () => ({ getAllMedia: mocks.getAllMedia }));

import { createMediaUploadHandler } from '../src/mediaUpload';

let root: string;
let server: Server;
let url: string;
const form = (...files: [string, string][]) => {
  const data = new FormData();
  for (const [filename, contents] of files)
    data.append('files', new Blob([contents], { type: 'image/png' }), filename);
  return data;
};
beforeEach(async () => {
  vi.clearAllMocks();
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'gmib-upload-'));
  mocks.getAllMedia.mockResolvedValue([]);
  mocks.loadMedia.mockResolvedValue({ filename: 'imported.mkv' });
  const app = express();
  app.post('/media', createMediaUploadHandler(root, mocks.onUploaded));
  const errors: ErrorRequestHandler = (error, _req, res, _next) =>
    res.status(500).json({ message: error.message });
  app.use(errors);
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test address');
  url = `http://127.0.0.1:${address.port}/media`;
});
afterEach(async () => {
  await new Promise<void>(resolve => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
  await fs.rm(root, { recursive: true, force: true });
});
const expectClean = async () => {
  await vi.waitFor(async () => expect(await fs.readdir(root)).toEqual([]));
};

it('returns a per-file error and processes remaining files in the same multipart field', async () => {
  mocks.loadMedia.mockImplementation(async (file: File) => {
    if (file.originalFilename === 'bad.png')
      throw Object.assign(new Error('command and stderr'), { signal: 'SIGKILL' });
    return { filename: 'imported.mkv' };
  });
  const response = await fetch(url, {
    method: 'POST',
    body: form(['bad.png', 'bad'], ['good.png', 'good']),
  });
  expect(response.status).toBe(207);
  expect(await response.json()).toMatchObject({
    media: [],
    errors: [{ filename: 'bad.png', message: expect.stringContaining('возможно') }],
  });
  expect(mocks.loadMedia).toHaveBeenCalledTimes(2);
  expect(mocks.onUploaded).toHaveBeenCalledOnce();
  await expectClean();
});

it('isolates simultaneous requests and repeated filenames from published files', async () => {
  await fs.writeFile(path.join(root, 'same.png'), 'published');
  const paths: string[] = [];
  const contents: string[] = [];
  mocks.loadMedia.mockImplementation(async (file: File) => {
    paths.push(file.filepath);
    contents.push(await fs.readFile(file.filepath, 'utf8'));
    return { filename: 'imported.mkv' };
  });
  const responses = await Promise.all([
    fetch(url, { method: 'POST', body: form(['same.png', 'one'], ['same.png', 'two']) }),
    fetch(url, { method: 'POST', body: form(['same.png', 'three']) }),
  ]);
  expect(responses.map(response => response.status)).toEqual([200, 200]);
  expect(new Set(paths).size).toBe(3);
  expect(new Set(paths.map(filepath => path.dirname(filepath))).size).toBe(2);
  expect(contents.sort()).toEqual(['one', 'three', 'two']);
  expect(await fs.readFile(path.join(root, 'same.png'), 'utf8')).toBe('published');
  await vi.waitFor(async () => expect(await fs.readdir(root)).toEqual(['same.png']));
});

it('routes unexpected response-query rejection to Express and cleans staging', async () => {
  mocks.getAllMedia.mockRejectedValueOnce(new Error('database unavailable'));
  const response = await fetch(url, { method: 'POST', body: form(['ok.png', 'ok']) });
  expect(response.status).toBe(500);
  expect(await response.json()).toMatchObject({ message: 'database unavailable' });
  expect(mocks.onUploaded).not.toHaveBeenCalled();
  await expectClean();
});

it('cleans staging after multipart parsing fails and accepts the next upload', async () => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'multipart/form-data' },
    body: 'invalid multipart',
  });
  expect(response.status).toBe(500);
  expect(mocks.loadMedia).not.toHaveBeenCalled();
  await expectClean();
  expect((await fetch(url, { method: 'POST', body: form(['ok.png', 'ok']) })).status).toBe(200);
  await expectClean();
});
