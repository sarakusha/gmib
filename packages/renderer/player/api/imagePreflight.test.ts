import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IMAGE_HEADER_BYTES, readImageDimensions } from '/@common/imageDimensions';

import { preflightImage } from './imagePreflight';

const png = (width: number, height: number) => {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([73, 72, 68, 82], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
};
const jpeg = (width: number, height: number) => {
  const bytes = new Uint8Array([255, 216, 255, 224, 0, 4, 0, 0, 255, 192, 0, 7, 8, 0, 0, 0, 0]);
  const view = new DataView(bytes.buffer);
  view.setUint16(13, height);
  view.setUint16(15, width);
  return bytes;
};
const webp = (width: number, height: number) => {
  const bytes = new Uint8Array(30);
  bytes.set(Array.from('RIFF', char => char.charCodeAt(0)));
  bytes.set(
    Array.from('WEBPVP8X', char => char.charCodeAt(0)),
    8,
  );
  for (let i = 0; i < 3; i++) {
    bytes[24 + i] = ((width - 1) >>> (i * 8)) & 255;
    bytes[27 + i] = ((height - 1) >>> (i * 8)) & 255;
  }
  return bytes;
};
const gif = (width: number, height: number) => {
  const bytes = new Uint8Array(10);
  bytes.set(Array.from('GIF89a', char => char.charCodeAt(0)));
  const view = new DataView(bytes.buffer);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  return bytes;
};
const bmp = (width: number, height: number) => {
  const bytes = new Uint8Array(26);
  bytes.set([66, 77]);
  const view = new DataView(bytes.buffer);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  return bytes;
};
const bmpCore = (width: number, height: number) => {
  const bytes = bmp(width, height);
  const view = new DataView(bytes.buffer);
  view.setUint32(14, 12, true);
  view.setUint16(18, width, true);
  view.setUint16(20, height, true);
  return bytes;
};
const webpLossy = (width: number, height: number) => {
  const bytes = webp(width, height);
  bytes[15] = 32;
  bytes.set([157, 1, 42], 23);
  const view = new DataView(bytes.buffer);
  view.setUint16(26, width, true);
  view.setUint16(28, height, true);
  return bytes;
};
const webpLossless = (width: number, height: number) => {
  const bytes = webp(width, height);
  bytes[15] = 76;
  bytes[20] = 47;
  new DataView(bytes.buffer).setUint32(21, (width - 1) | ((height - 1) << 14), true);
  return bytes;
};
const headers = [png, jpeg, webp, gif, bmp, bmpCore, webpLossy, webpLossless];
const file = (bytes: Uint8Array) => new NodeBlob([bytes]) as unknown as File;
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('image upload preflight', () => {
  it.each([png, jpeg, webp])('rejects huge image headers without decoding', async makeHeader => {
    const header = makeHeader(30000, 20000);
    expect(readImageDimensions(header)).toEqual({ width: 30000, height: 20000 });
    await expect(preflightImage(file(header))).rejects.toThrow(/30000/);
  });
  it.each([png, jpeg, webp])('accepts small image headers', async makeHeader => {
    await expect(preflightImage(file(makeHeader(1920, 1080)))).resolves.toBeUndefined();
  });
  it.each(headers)(
    'reads each supported format and rejects the incident dimensions',
    async makeHeader => {
      const header = makeHeader(10984, 3898);
      expect(readImageDimensions(header)).toEqual({ width: 10984, height: 3898 });
      await expect(preflightImage(file(header))).rejects.toThrow(/10984×3898.*164 МиБ/);
    },
  );
  it('reads a top-down BMP as positive dimensions', () => {
    expect(readImageDimensions(bmp(1920, -1080))).toEqual({ width: 1920, height: 1080 });
  });
  it.each(headers)('never throws when a supported header is truncated', makeHeader => {
    const header = makeHeader(1920, 1080);
    for (let length = 0; length < header.length; length++) {
      expect(() => readImageDimensions(header.subarray(0, length))).not.toThrow();
    }
  });
  it('handles a header inside a larger buffer', () => {
    const bytes = new Uint8Array(40);
    bytes.set(png(1920, 1080), 5);
    expect(readImageDimensions(bytes.subarray(5, 29))).toEqual({ width: 1920, height: 1080 });
  });
  it('delegates unknown and truncated formats to the server', async () => {
    await expect(preflightImage(file(new Uint8Array([255, 216, 255])))).resolves.toBeUndefined();
    await expect(preflightImage(file(new Uint8Array([1, 2, 3])))).resolves.toBeUndefined();
  });
  it('only reads the bounded header and observes cancellation after reading', async () => {
    const controller = new AbortController();
    const slice = vi.fn().mockReturnValue({
      arrayBuffer: async () => {
        controller.abort();
        return png(1920, 1080).buffer;
      },
    });
    await expect(
      preflightImage({ slice } as unknown as File, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(slice).toHaveBeenCalledWith(0, IMAGE_HEADER_BYTES);
  });
  it('does not read already canceled files', async () => {
    const slice = vi.fn();
    await expect(
      preflightImage({ slice } as unknown as File, AbortSignal.abort()),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(slice).not.toHaveBeenCalled();
  });
  it.each([
    ['/?host=old&version=5.7.3', false],
    ['/?host=remote&version=5.7.4', true],
    ['/?host=remote&version=5.8.0', true],
    ['/?host=remote', true],
    ['/?version=5.7.3', true],
  ])(
    'uses server validation policy for unrecognized image headers at %s',
    async (url, supported) => {
      window.history.replaceState({}, '', url);
      vi.resetModules();
      const { preflightImage: preflight } = await import('./imagePreflight');
      const unknownImage = new NodeBlob(['unknown image header'], {
        type: 'image/avif',
      }) as unknown as File;
      if (supported) await expect(preflight(unknownImage)).resolves.toBeUndefined();
      else await expect(preflight(unknownImage)).rejects.toThrow(/Обновите GMIB/);
      // Video and other unknown non-image formats can still use older hosts.
      await expect(preflight(file(new Uint8Array([1, 2])))).resolves.toBeUndefined();
    },
  );
  it('keeps the latest complete library from multiple 207 mutation responses', async () => {
    Object.defineProperty(window, 'identify', {
      configurable: true,
      value: { getSecret: () => 'test' },
    });
    const media = [{ md5: 'accepted' }];
    let requests = 0;
    const send = vi.fn();
    class UploadRequest {
      upload = {};
      status = 207;
      responseText = JSON.stringify({
        media: ++requests === 1 ? [{ md5: 'previous' }] : media,
        errors: [],
      });
      onload?: () => void;
      open = vi.fn();
      setRequestHeader = vi.fn();
      send() {
        send();
        this.onload?.();
      }
    }
    vi.stubGlobal('XMLHttpRequest', UploadRequest);
    const uploadFile = new File(['test'], 'small.png');
    Object.defineProperty(uploadFile, 'slice', { value: () => new NodeBlob([png(1920, 1080)]) });
    const { configureStore } = await import('@reduxjs/toolkit');
    const { default: api } = await import('./media');
    const store = configureStore({
      reducer: { [api.reducerPath]: api.reducer },
      middleware: getDefault => getDefault().concat(api.middleware),
    });
    await expect(
      store.dispatch(api.endpoints.uploadMedia.initiate([uploadFile, uploadFile])).unwrap(),
    ).resolves.toEqual(media);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('does not create an upload request when rejected or canceled', async () => {
    const xhr = vi.fn();
    vi.stubGlobal('XMLHttpRequest', xhr);
    Object.defineProperty(window, 'identify', {
      configurable: true,
      value: { getSecret: () => 'test' },
    });
    const { uploadMediaFile } = await import('./media');
    await expect(uploadMediaFile(file(png(30000, 20000)))).rejects.toThrow(/30000/);
    await expect(
      uploadMediaFile(file(png(1920, 1080)), undefined, AbortSignal.abort()),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(xhr).not.toHaveBeenCalled();
  });
});
