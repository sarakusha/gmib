import type { Display } from 'electron';

export type DisplayType = Pick<
  Display,
  'id' | 'bounds' | 'workArea' | 'displayFrequency' | 'internal'
> & {
  primary?: true;
};

// export type Tile = {
//   id: number;
//   name?: string;
//   player: number;
//   sWidth: number;
//   sHeight: number;
//   sx: number;
//   sy: number;
//   output: number;
//   dWidth: number;
//   dHeight: number;
//   dx: number;
//   dy: number;
// };

export type Player = {
  id: number;
  name?: string;
  // screenId: string;
  playlistId?: number | null;
  current?: string;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  disableFadeIn?: boolean;
  disableFadeOut?: boolean;
  hidden?: boolean;
};

// export type VideoOutput = {
//   id: number;
//   name?: string;
//   minWidth?: number;
//   minHeight?: number;
//   left?: number;
//   top?: number;
//   display: boolean | number;
//   kiosk?: boolean;
//   transparent?: boolean;
// };

export type Screen = {
  id: number;
  name: string;
  width?: number;
  height?: number;
  moduleWidth?: number;
  moduleHeight?: number;
  left: number;
  top: number;
  display?: number;
  addresses?: string[];
  downToTop?: boolean;
  rightToLeft?: boolean;
  borderTop?: number;
  borderBottom?: number;
  borderLeft?: number;
  borderRight?: number;
  brightnessFactor?: number;
  test?: string;
  brightness?: number;
};

export type PlayerMapping = {
  id: number;
  name: string;
  player: number;
  width?: number;
  height?: number;
  left: number;
  top: number;
  display?: number;
  kiosk: boolean;
  zOrder: number;
  shader?: string;
  transparent?: boolean;
};

export const enum DefaultDisplays {
  None = 0,
  Primary = -1,
  Secondary = -2,
}

export const getDisplayLabel = (display: DisplayType, index: number): string => {
  // if (display.primary) return 'Основной';
  if (display.internal) return 'Встроенный';
  return `Дисплей ${index + 1}`;
};
