import { describe, expect, it } from 'vitest';

import {
  compareOutputWindowOrder,
  macOutputRelativeLevel,
  type OutputWindowOrder,
} from '../src/outputWindowOrder';

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

  it('keeps the old layout above new high-zIndex output only while held', () => {
    const old = { alwaysOnTop: true, id: 1, zIndex: 0, held: true };
    const next = { alwaysOnTop: true, id: 2, zIndex: 100 };
    expect(orderedIds([old, next])).toEqual([2, 1]);
    expect(orderedIds([{ ...old, held: false }, next])).toEqual([1, 2]);
    expect(old.zIndex).toBe(0);
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

describe('macOutputRelativeLevel', () => {
  it('assigns higher native levels to higher sorted outputs without exceeding screen-saver', () => {
    expect([0, 1, 2].map(index => macOutputRelativeLevel(index, 3))).toEqual([-2, -1, 0]);
    expect(macOutputRelativeLevel(0, 1)).toBe(0);
  });

  it('bounds the native level for unusually large output counts', () => {
    expect(macOutputRelativeLevel(0, 1000)).toBe(-900);
  });
});
