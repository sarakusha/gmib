export const FlashKinds = ['fpga', 'mcu', 'rbf', 'ttc', 'ctrl', 'tca', 'tcc'] as const;

export type Kind = (typeof FlashKinds)[number];
export type Ext = 'rbf' | 'tcc' | 'tca' | 'xml' | 'hex' | 'txt';

export const KindMap: Record<Kind, readonly [ext: Ext, isModule: boolean, legacy: boolean]> = {
  fpga: ['rbf', false, false],
  mcu: ['hex', false, false],
  rbf: ['rbf', true, false],
  ctrl: ['txt', true, false],
  ttc: ['xml', true, false],
  tcc: ['tcc', true, true],
  tca: ['tca', true, true],
} as const;
