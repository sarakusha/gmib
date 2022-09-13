export type Tile = {
  id: number;
  name?: string;
  player: number;
  sWidth: number;
  sHeight: number;
  sx: number;
  sy: number;
  output: number;
  dWidth: number;
  dHeight: number;
  dx: number;
  dy: number;
};

export type Player = {
  id: number;
  name?: string;
  // screenId: string;
  playlistId?: number | null;
  current: number;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  disableFadeIn?: boolean;
  disableFadeOut?: boolean;
  hidden?: boolean;
};

export type VideoOutput = {
  id: number;
  name?: string;
  minWidth?: number;
  minHeight?: number;
  left?: number;
  top?: number;
  display: boolean | number;
  kiosk?: boolean;
  transparent?: boolean;
};

export type Screen = {
  id: number;
  name: string;
  width?: number;
  height?: number;
  moduleWidth?: number;
  moduleHeight?: number;
  left: number;
  top: number;
  // display?: boolean | string;
  addresses?: string[];
  downToTop?: boolean;
  rightToLeft?: boolean;
  borderTop?: number;
  borderBottom?: number;
  borderLeft?: number;
  borderRight?: number;
  brightnessFactor?: number;
  output?: number;
  test?: string;
  // transparent?: boolean;
  // kiosk?: boolean;
};
