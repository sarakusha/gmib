import { beforeEach, describe, expect, it, vi } from 'vitest';

import { reconcileOutputWindow } from '../src/reconcileOutputWindow';
import {
  isPlayerOutputHidden,
  setOutputHidden,
  setPlayerOutputHidden,
} from '../src/outputVisibility';

const placement = {
  bounds: { x: 1920, y: 20, width: 800, height: 300 },
  useNativeKiosk: false,
  alwaysOnTop: true,
};
const createWindow = () => {
  let visible = true;
  let minimized = false;
  let bounds = { ...placement.bounds };
  return {
    isVisible: () => visible,
    isMinimized: () => minimized,
    minimize: () => {
      minimized = true;
    },
    restore: vi.fn(() => {
      minimized = false;
    }),
    hide: vi.fn(() => {
      visible = false;
    }),
    showInactive: vi.fn(() => {
      visible = true;
    }),
    getBounds: () => bounds,
    getContentBounds: () => bounds,
    setBounds: vi.fn(value => {
      bounds = { ...bounds, ...value };
    }),
    setContentBounds: vi.fn(value => {
      bounds = { ...bounds, ...value };
    }),
    isFullScreen: () => false,
    setFullScreen: vi.fn(),
    isKiosk: () => false,
    setKiosk: vi.fn(),
    isAlwaysOnTop: () => true,
    setAlwaysOnTop: vi.fn(),
  };
};

describe('native output reconciliation', () => {
  beforeEach(() => {
    setOutputHidden(false);
    setPlayerOutputHidden(false);
  });

  it('leaves a healthy output entirely untouched', () => {
    const window = createWindow();
    expect(reconcileOutputWindow(window, placement, false)).toEqual([]);
    expect(window.setContentBounds).not.toHaveBeenCalled();
    expect(window.showInactive).not.toHaveBeenCalled();
    expect(window.setAlwaysOnTop).not.toHaveBeenCalled();
  });

  it('repairs moved/resized content only once', () => {
    const window = createWindow();
    window.setContentBounds({ x: 0, width: 100 });
    window.setContentBounds.mockClear();
    expect(reconcileOutputWindow(window, placement, false)).toEqual(['bounds']);
    expect(window.getContentBounds()).toEqual(placement.bounds);
    expect(reconcileOutputWindow(window, placement, false)).toEqual([]);
    expect(window.setContentBounds).toHaveBeenCalledTimes(1);
  });

  it('restores an accidentally minimized and hidden output', () => {
    const window = createWindow();
    window.minimize();
    window.hide();
    expect(reconcileOutputWindow(window, placement, false)).toEqual(['restore', 'show']);
    expect(window.isVisible()).toBe(true);
  });

  it('suspends absent monitor without repeated mutations and shows after return', () => {
    const window = createWindow();
    expect(reconcileOutputWindow(window, undefined, false)).toEqual(['display-unavailable']);
    expect(reconcileOutputWindow(window, undefined, false)).toEqual([]);
    expect(reconcileOutputWindow(window, placement, false)).toEqual(['show']);
    expect(window.hide).toHaveBeenCalledTimes(1);
  });

  it('keeps manual hide across recreation, global hide/show and monitor return', () => {
    setPlayerOutputHidden(true, 7);
    setOutputHidden(true);
    setOutputHidden(false);
    const recreated = createWindow();
    expect(isPlayerOutputHidden(7)).toBe(true);
    expect(isPlayerOutputHidden(8)).toBe(false);
    expect(reconcileOutputWindow(recreated, placement, isPlayerOutputHidden(7))).toEqual(['hide']);
    reconcileOutputWindow(recreated, undefined, isPlayerOutputHidden(7));
    expect(reconcileOutputWindow(recreated, placement, isPlayerOutputHidden(7))).toEqual([]);
    expect(recreated.isVisible()).toBe(false);
    expect(recreated.restore).not.toHaveBeenCalled();
  });

  it('does not let player show override global hide', () => {
    setOutputHidden(true);
    setPlayerOutputHidden(false, 7);
    expect(isPlayerOutputHidden(7)).toBe(true);
    setOutputHidden(false);
    expect(isPlayerOutputHidden(7)).toBe(false);
  });

  it('retains an all-player command for players not yet created', () => {
    setPlayerOutputHidden(true);
    expect(isPlayerOutputHidden(99)).toBe(true);
    setPlayerOutputHidden(false, 99);
    expect(isPlayerOutputHidden(99)).toBe(false);
    expect(isPlayerOutputHidden(100)).toBe(true);
    setPlayerOutputHidden(false);
    expect(isPlayerOutputHidden(100)).toBe(false);
  });

  it('restores kiosk window using entire monitor bounds, including transparent regions', () => {
    const window = createWindow();
    const kiosk = {
      ...placement,
      useNativeKiosk: true,
      bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
    };
    expect(reconcileOutputWindow(window, kiosk, false)).toEqual(['bounds', 'fullscreen', 'kiosk']);
    expect(window.setBounds).toHaveBeenCalledWith(kiosk.bounds, false);
    expect(window.setContentBounds).not.toHaveBeenCalled();
  });
});
