/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { screen, Display } from 'electron';
import { Display as DisplayType } from '@nibus/core';

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
