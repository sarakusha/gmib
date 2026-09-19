import type { BrowserWindow, Rectangle } from 'electron';

type OutputWindow = Pick<
  BrowserWindow,
  | 'isVisible'
  | 'isMinimized'
  | 'restore'
  | 'hide'
  | 'showInactive'
  | 'getBounds'
  | 'getContentBounds'
  | 'setBounds'
  | 'setContentBounds'
  | 'isFullScreen'
  | 'setFullScreen'
  | 'isKiosk'
  | 'setKiosk'
  | 'isAlwaysOnTop'
  | 'setAlwaysOnTop'
>;

export type OutputPlacement = {
  bounds: Pick<Rectangle, 'x' | 'y'> & Partial<Pick<Rectangle, 'width' | 'height'>>;
  useNativeKiosk: boolean;
  alwaysOnTop: boolean;
};

// No focus or stacking mutations on healthy probes. The supplied bounds describe
// the complete native window (including transparent regions of a kiosk output).
export const reconcileOutputWindow = (
  window: OutputWindow,
  placement: OutputPlacement | undefined,
  hidden: boolean,
): string[] => {
  const repairs: string[] = [];
  if (!placement || hidden) {
    if (window.isVisible()) {
      window.hide();
      repairs.push(placement ? 'hide' : 'display-unavailable');
    }
    return repairs;
  }
  if (window.isMinimized()) {
    window.restore();
    repairs.push('restore');
  }
  const { bounds, useNativeKiosk, alwaysOnTop } = placement;
  const current = useNativeKiosk ? window.getBounds() : window.getContentBounds();
  if (
    (['x', 'y', 'width', 'height'] as const).some(
      key => bounds[key] != null && bounds[key] !== current[key],
    )
  ) {
    if (useNativeKiosk) window.setBounds(bounds, false);
    else
      window.setContentBounds(
        {
          ...bounds,
          width: bounds.width ?? current.width,
          height: bounds.height ?? current.height,
        },
        false,
      );
    repairs.push('bounds');
  }
  if (useNativeKiosk && !window.isFullScreen()) {
    window.setFullScreen(true);
    repairs.push('fullscreen');
  }
  if (useNativeKiosk && !window.isKiosk()) {
    window.setKiosk(true);
    repairs.push('kiosk');
  }
  if (!window.isVisible()) {
    window.showInactive();
    repairs.push('show');
  }
  if (alwaysOnTop && !window.isAlwaysOnTop()) {
    window.setAlwaysOnTop(true, 'screen-saver');
    repairs.push('topmost');
  }
  return repairs;
};
