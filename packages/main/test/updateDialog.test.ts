import type { BaseWindow, MessageBoxReturnValue } from 'electron';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  focused: vi.fn(),
  all: vi.fn(),
  show: vi.fn(),
  warn: vi.fn(),
}));
vi.mock('electron', () => ({
  BaseWindow: { getFocusedWindow: mocks.focused, getAllWindows: mocks.all },
  dialog: { showMessageBox: mocks.show },
}));
vi.mock('../src/initlog', () => ({ default: { warn: mocks.warn } }));
import { showUpdateDialog } from '../src/updateDialog';

const platform = process.platform;
const setPlatform = (value: string) => Object.defineProperty(process, 'platform', { value });
const makeWindow = (visible = true, minimized = false, destroyed = false) => {
  const window = {
    isDestroyed: () => destroyed,
    isVisible: () => visible,
    isMinimized: () => minimized,
    restore: vi.fn(() => {
      minimized = false;
    }),
    show: vi.fn(() => {
      visible = true;
    }),
  };
  return window;
};
const options = {
  title: 'Update',
  message: 'Install?',
  buttons: ['Install', 'Later'],
  cancelId: 1,
};
beforeEach(() => {
  vi.clearAllMocks();
  setPlatform('darwin');
  mocks.focused.mockReturnValue(undefined);
  mocks.all.mockReturnValue([]);
  mocks.show.mockResolvedValue({ response: 0, checkboxChecked: false });
});
afterEach(() => setPlatform(platform));

it('attaches confirmation to the supplied window and restores its visibility', async () => {
  const owner = makeWindow(false, true);
  mocks.focused.mockReturnValue(makeWindow());
  await showUpdateDialog(options, owner as unknown as BaseWindow);
  expect(owner.restore).toHaveBeenCalledOnce();
  expect(owner.show).toHaveBeenCalledOnce();
  expect(mocks.show).toHaveBeenCalledExactlyOnceWith(owner, options);
});

it('uses the focused window when no parent was supplied', async () => {
  const owner = makeWindow();
  mocks.focused.mockReturnValue(owner);
  await showUpdateDialog(options);
  expect(mocks.show).toHaveBeenCalledExactlyOnceWith(owner, options);
});

it('ignores destroyed parents and attaches to an available visible window', async () => {
  const destroyed = makeWindow(true, false, true);
  const owner = makeWindow();
  mocks.focused.mockReturnValue(destroyed);
  mocks.all.mockReturnValue([destroyed, makeWindow(false), owner]);
  await showUpdateDialog(options, destroyed as unknown as BaseWindow);
  expect(mocks.show).toHaveBeenCalledExactlyOnceWith(owner, options);
});

it('cancels without opening a blocking macOS dialog when no visible parent exists', async () => {
  mocks.all.mockReturnValue([makeWindow(false)]);
  await expect(showUpdateDialog(options)).resolves.toEqual({ response: 1, checkboxChecked: false });
  await expect(showUpdateDialog({ message: 'Install?' })).resolves.toEqual({
    response: -1,
    checkboxChecked: false,
  });
  expect(mocks.show).not.toHaveBeenCalled();
  expect(mocks.warn).toHaveBeenCalledTimes(2);
});

it('preserves parentless dialogs on non-macOS platforms', async () => {
  setPlatform('win32');
  await showUpdateDialog(options);
  expect(mocks.show).toHaveBeenCalledExactlyOnceWith(options);
});

it('keeps the caller pending without blocking other work while its attached sheet is open', async () => {
  const owner = makeWindow();
  mocks.focused.mockReturnValue(owner);
  let answer!: (result: MessageBoxReturnValue) => void;
  mocks.show.mockReturnValue(
    new Promise<MessageBoxReturnValue>(resolve => {
      answer = resolve;
    }),
  );
  const settled = vi.fn();
  const pending = showUpdateDialog(options).then(settled);
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(settled).not.toHaveBeenCalled();
  expect(mocks.show).toHaveBeenCalledWith(owner, options);
  answer({ response: 1, checkboxChecked: false });
  await pending;
  expect(settled).toHaveBeenCalledWith({ response: 1, checkboxChecked: false });
});
