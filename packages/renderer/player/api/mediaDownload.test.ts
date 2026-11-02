import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canDownloadMedia, downloadMedia } from './mediaDownload';

const state = vi.hoisted(() => ({ remote: true, version: '3.6.5' as string | undefined }));
vi.mock('/@common/remote', () => ({
  get isRemoteSession() {
    return state.remote;
  },
  get version() {
    return state.version;
  },
}));
const save = vi.fn();
beforeEach(() => {
  state.remote = true;
  state.version = '3.6.5';
  save.mockReset().mockResolvedValue(true);
  Object.defineProperty(window, 'media', { configurable: true, value: { download: save } });
});

describe('media downloads compatibility and local destination', () => {
  it.each([
    ['3.6.4', false],
    ['3.6.5', true],
    ['5.7.5', true],
    [undefined, true],
  ])('checks remote host %s before calling local IPC', async (version, supported) => {
    state.version = version;
    expect(canDownloadMedia()).toBe(supported);
    if (supported) {
      await expect(downloadMedia('Тест #1.mkv')).resolves.toBe(true);
      expect(save).toHaveBeenCalledWith('Тест #1.mkv');
    } else {
      await expect(downloadMedia('test.mkv')).rejects.toThrow('не поддерживается');
      expect(save).not.toHaveBeenCalled();
    }
  });
  it('allows local downloads regardless of version', async () => {
    state.remote = false;
    state.version = '3.6.4';
    await expect(downloadMedia('test.mkv')).resolves.toBe(true);
  });
  it('preserves cancellation', async () => {
    save.mockResolvedValue(false);
    await expect(downloadMedia('test.mkv')).resolves.toBe(false);
  });
  it('propagates download errors for the UI to display', async () => {
    save.mockRejectedValue(new Error('HTTP 404'));
    await expect(downloadMedia('test.mkv')).rejects.toThrow('404');
  });
});
