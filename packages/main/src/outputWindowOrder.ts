export type OutputWindowOrder = {
  alwaysOnTop: boolean;
  id: number;
  zIndex: number;
  held?: boolean;
};

export const compareOutputWindowOrder = (a: OutputWindowOrder, b: OutputWindowOrder): number =>
  Number(Boolean(a.held)) - Number(Boolean(b.held)) ||
  Number(a.alwaysOnTop) - Number(b.alwaysOnTop) ||
  a.zIndex - b.zIndex ||
  a.id - b.id;

// Keep macOS output levels at or below screen-saver, while giving higher
// outputs a stable native level that cannot be changed merely by focusing one.
export const macOutputRelativeLevel = (index: number, count: number): number =>
  Math.max(index - count + 1, -900);
