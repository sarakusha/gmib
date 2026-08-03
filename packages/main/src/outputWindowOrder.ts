export type OutputWindowOrder = {
  alwaysOnTop: boolean;
  id: number;
  zIndex: number;
  zOrder: number;
};

export const compareOutputWindowOrder = (a: OutputWindowOrder, b: OutputWindowOrder): number =>
  Number(a.alwaysOnTop) - Number(b.alwaysOnTop) ||
  a.zIndex - b.zIndex ||
  a.zOrder - b.zOrder ||
  a.id - b.id;
