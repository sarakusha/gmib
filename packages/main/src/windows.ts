import type { BrowserWindow } from 'electron';

const windows = new Set<BrowserWindow>();

export const screenWindows = new Map<number, BrowserWindow>();
export const playerWindows = new Map<number, BrowserWindow>();

export const showAll = (): void =>
  [...windows].forEach(window => {
    if (window.isMinimized()) window.restore();
    window.show();
  });

export const hideAll = (): void => {
  [...windows].forEach(window => {
    window.hide();
  });
};

export const closeScreens = (): void => {
  [...screenWindows.values()].forEach(window => window.destroy());
  screenWindows.clear();
};

export default windows;
