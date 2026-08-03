import { describe, expect, it } from 'vitest';

import { compareOutputWindowOrder, type OutputWindowOrder } from '../src/outputWindowOrder';

const orderedIds = (windows: OutputWindowOrder[]): number[] =>
  [...windows].sort(compareOutputWindowOrder).map(({ id }) => id);

describe('compareOutputWindowOrder', () => {
  it('orders test and player outputs together by zIndex', () => {
    expect(
      orderedIds([
        { alwaysOnTop: true, id: 11, zIndex: 20, zOrder: 0 },
        { alwaysOnTop: true, id: 12, zIndex: -10, zOrder: 100 },
        { alwaysOnTop: true, id: 13, zIndex: 5, zOrder: 0 },
      ]),
    ).toEqual([12, 13, 11]);
  });

  it('uses player zOrder only when zIndex is equal', () => {
    expect(
      orderedIds([
        { alwaysOnTop: true, id: 21, zIndex: 3, zOrder: 10 },
        { alwaysOnTop: true, id: 22, zIndex: 3, zOrder: -2 },
        { alwaysOnTop: true, id: 23, zIndex: 2, zOrder: 100 },
      ]),
    ).toEqual([23, 22, 21]);
  });

  it('keeps topmost outputs above regular outputs', () => {
    expect(
      orderedIds([
        { alwaysOnTop: true, id: 31, zIndex: -100, zOrder: 0 },
        { alwaysOnTop: false, id: 32, zIndex: 100, zOrder: 0 },
      ]),
    ).toEqual([32, 31]);
  });

  it('uses the stable window id as the final tie breaker', () => {
    expect(
      orderedIds([
        { alwaysOnTop: true, id: 42, zIndex: 0, zOrder: 0 },
        { alwaysOnTop: true, id: 41, zIndex: 0, zOrder: 0 },
      ]),
    ).toEqual([41, 42]);
  });
});
