import { EventEmitter } from 'node:events';

import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  showMessageBox: vi.fn(() => new Promise(() => {})),
  showErrorBox: vi.fn(),
  error: vi.fn(),
}));

vi.mock('electron', () => ({ dialog: mocks }));
vi.mock('electron-updater', () => ({ autoUpdater: new EventEmitter() }));
vi.mock('../src/initlog', () => ({ default: { error: mocks.error } }));
vi.mock('../src/localConfig', () => ({
  default: { get: vi.fn(() => false), onDidChange: vi.fn() },
}));
vi.mock('../src/relaunch', () => ({ needRestart: vi.fn() }));

it('keeps the event loop available while an update error dialog remains open', async () => {
  const { autoUpdater } = await import('electron-updater');
  await import('../src/updater');

  autoUpdater.emit('error', new Error('EACCES: permission denied'));
  await new Promise<void>(resolve => setImmediate(resolve));

  expect(mocks.showMessageBox).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'error', message: expect.stringContaining('EACCES') }),
  );
  expect(mocks.showErrorBox).not.toHaveBeenCalled();
});

it('blocks automatic updates on Windows versions older than 10', async () => {
  const { automaticUpdatesSupported } = await import('../src/updater');

  expect(automaticUpdatesSupported('win32', '6.1.7601')).toBe(false);
  expect(automaticUpdatesSupported('win32', '6.3.9600')).toBe(false);
  expect(automaticUpdatesSupported('win32', '10.0.19045')).toBe(true);
  expect(automaticUpdatesSupported('linux', '6.1.0')).toBe(true);
});
