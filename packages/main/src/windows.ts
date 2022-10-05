import type { BrowserWindow } from 'electron';

import type { Screen } from '/@common/video';

const windows = new Set<BrowserWindow>();

const impScreenProps = [
  'test',
  'borderTop',
  'borderBottom',
  'borderLeft',
  'borderRight',
  'width',
  'height',
  'moduleWidth',
  'moduleHeight',
] as const;

type ScreenOptions = Readonly<Pick<Screen, typeof impScreenProps[number]>>;

export const isEqualOptions = <T extends ScreenOptions>(a: T, b: T): boolean =>
  impScreenProps.reduce((res, key) => res && a[key] === b[key], true);

export const createSearchParams = <T extends ScreenOptions>(options: T): URLSearchParams =>
  new URLSearchParams(
    impScreenProps.reduce<[string, string][]>((res, key) => {
      const value = options[key];
      return value != null ? [...res, [key, value.toString()]] : res;
    }, []),
  );

export const screenWindows = new Map<number, [BrowserWindow, ScreenOptions | undefined]>();
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
  [...screenWindows.values()].forEach(([window]) => window.destroy());
  screenWindows.clear();
};

export default windows;
