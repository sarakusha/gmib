import type { Display } from 'electron';
import { screen } from 'electron';

import type { Display as DisplayType } from '@nibus/core';

// type DisplayType = Pick<Display, 'id' | 'bounds' | 'workArea' | 'displayFrequency' | 'internal'>;

const fromDisplay = ({
  id,
  bounds,
  workArea,
  displayFrequency,
  internal,
}: Display): DisplayType => ({ id, bounds, workArea, displayFrequency, internal });

const getAllDisplays = (): DisplayType[] => {
  const primary = screen.getPrimaryDisplay();
  return screen
    .getAllDisplays()
    .map(display => ({ ...fromDisplay(display), primary: display.id === primary.id }));
};

export default getAllDisplays;
