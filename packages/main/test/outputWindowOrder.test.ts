import { describe, expect, it } from 'vitest';

import { compareOutputWindowOrder, type OutputWindowOrder } from '../src/outputWindowOrder';

const orderedIds = (windows: OutputWindowOrder[]): number[] =>
  [...windows].sort(compareOutputWindowOrder).map(({ id }) => id);

describe('compareOutputWindowOrder', () => {
  it('orders test and player outputs together by zIndex', () => {
    expect(
      orderedIds([
        { alwaysOnTop: true, id: 11, zIndex: 20 },
        { alwaysOnTop: true, id: 12, zIndex: -10 },
        { alwaysOnTop: true, id: 13, zIndex: 5 },
      ]),
    ).toEqual([12, 13, 11]);
  });

  it('keeps topmost outputs above regular outputs', () => {
    expect(
      orderedIds([
        { alwaysOnTop: true, id: 31, zIndex: -100 },
        { alwaysOnTop: false, id: 32, zIndex: 100 },
      ]),
    ).toEqual([32, 31]);
  });

  it('uses the stable window id as the final tie breaker', () => {
    expect(
      orderedIds([
        { alwaysOnTop: true, id: 42, zIndex: 0 },
        { alwaysOnTop: true, id: 41, zIndex: 0 },
      ]),
    ).toEqual([41, 42]);
  });
});
