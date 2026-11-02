import { beforeEach, expect, it, vi } from 'vitest';

import { MAX_IMAGE_PIXELS } from '/@common/imageImportLimits';

const mocks = vi.hoisted(() => ({ execa: vi.fn() }));
vi.mock('execa', () => ({ execa: mocks.execa }));

import { generateFromImage, readFileMeta, renderThumbnailFromImage } from '../src/ffmpeg';
import { getMediaImportError } from '../src/mediaImportSafety';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.execa.mockResolvedValue({ stdout: '{}' });
});

it('bounds image decoder pixels, encoder buffering, duration and captured output', async () => {
  await generateFromImage({ filePath: 'input.png', outPath: 'output.mkv' });
  const [, args, options] = mocks.execa.mock.calls[0];
  expect(args.slice(0, args.indexOf('-i'))).toEqual(
    expect.arrayContaining([
      '-max_pixels',
      String(MAX_IMAGE_PIXELS),
      '-threads',
      '1',
      '-filter_threads',
    ]),
  );
  expect(args.slice(args.indexOf('-i') + 2)).toEqual(
    expect.arrayContaining(['-threads', '1', '-tune', 'zerolatency', '-refs', '1']),
  );
  expect(options).toMatchObject({
    timeout: 120_000,
    maxBuffer: 512 * 1024,
    forceKillAfterDelay: 1000,
  });
});

it('bounds thumbnail decoding and stops stuck image jobs', async () => {
  await renderThumbnailFromImage('input.png', 'thumb.png');
  const [, args, options] = mocks.execa.mock.calls[0];
  expect(args.slice(0, args.indexOf('-i'))).toEqual(
    expect.arrayContaining(['-max_pixels', String(MAX_IMAGE_PIXELS), '-threads', '1']),
  );
  expect(options).toMatchObject({ timeout: 30_000, maxBuffer: 512 * 1024 });
});

it('enforces image probe pixel limits without restricting normal video probes', async () => {
  await readFileMeta('input.png', MAX_IMAGE_PIXELS);
  expect(mocks.execa.mock.calls[0][1]).toEqual(
    expect.arrayContaining(['-max_pixels', String(MAX_IMAGE_PIXELS)]),
  );
  expect(mocks.execa.mock.calls[0][2]).toMatchObject({
    maxBuffer: 2 * 1024 ** 2,
    forceKillAfterDelay: 1000,
  });
  await readFileMeta('video.mkv');
  expect(mocks.execa.mock.calls[1][1]).not.toContain('-max_pixels');
});

it('does not expose a failed probe command or its large stderr as an upload error', async () => {
  mocks.execa.mockRejectedValue(
    Object.assign(new Error('ffprobe private path and stderr'), { exitCode: 1 }),
  );
  const error = await readFileMeta('bad.png', MAX_IMAGE_PIXELS).catch(reason => reason);
  expect(getMediaImportError(error)).toContain('Не удалось прочитать');
  expect(getMediaImportError(error)).not.toContain('private');
  expect(error.cause).toMatchObject({ exitCode: 1 });
});
