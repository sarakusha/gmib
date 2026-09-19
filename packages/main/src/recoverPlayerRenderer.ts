import { webContents } from 'electron';

import type { ManagedWindow } from './managedWindow';

/** Never kill a process that also owns another player, output, or application page. */
const hasExclusiveRenderer = (window: ManagedWindow): boolean => {
  try {
    const target = window.webContents;
    const processId = target.getOSProcessId();
    if (!Number.isSafeInteger(processId) || processId <= 0) return false;
    const live = webContents.getAllWebContents().filter(contents => !contents.isDestroyed());
    return (
      live.some(contents => contents.id === target.id) &&
      live.every(contents => contents.id === target.id || contents.getOSProcessId() !== processId)
    );
  } catch {
    // An unavailable process inventory is not evidence that killing the renderer is safe.
    return false;
  }
};

export const recoverPlayerRenderer = async (
  window: ManagedWindow,
  url: string,
  unresponsive: boolean,
): Promise<void> => {
  if (window.isDestroyed() || window.webContents.isDestroyed()) return;
  if (unresponsive && hasExclusiveRenderer(window)) {
    try {
      window.webContents.forcefullyCrashRenderer();
    } catch {
      // Navigation can still recover a renderer that exited while its state was checked.
    }
  }
  if (!window.isDestroyed() && !window.webContents.isDestroyed()) await window.loadURL(url);
};
