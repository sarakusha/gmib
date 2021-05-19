/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { BrowserWindow } from 'electron';

const windows = new Set<BrowserWindow>();

export const screenWindows = new Map<string, BrowserWindow>();

export const showAll = (): void =>
  [...windows].forEach(window => {
    if (window.isMinimized()) window.restore();
    window.show();
  });

export const hideAll = (): void => {
  [...windows].forEach(window => {
    window.hide();
  });
};

export default windows;
