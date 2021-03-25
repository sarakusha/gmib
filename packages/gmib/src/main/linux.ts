/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import debugFactory from '../util/debug';

const debug = debugFactory('gmib:linux');

const iconSrc = path.resolve(__dirname, '../extraResources/icon64x64.png');
const iconDst = path.join(app.getPath('userData'), path.basename(iconSrc));

const getAutostartPath = (): string => {
  const dir = path.join(app.getPath('appData'), 'autostart');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  return path.join(dir, `${app.getName()}.desktop`);
};

const getApplicationsPath = (): string =>
  path.join(app.getPath('home'), '.local/share/applications', `${app.getName()}.desktop`);

const getEntry = (): string => {
  const exe = process.env.APPIMAGE;
  const name = app.getName();
  const version = app.getVersion();
  return `[Desktop Entry]
Type=Application
Version=${version}
Name=${name}
Exec=${exe}
Icon=${iconDst}
Categories=Utility;
StartupWMClass=${name}
X-GNOME-Autostart-enabled=true
StartupNotify=false
X-GNOME-Autostart-delay=10
X-MATE-Autostart-delay=10
X-KDE-autostart-after=panel
Terminal=false`;
};

export const linuxAutostart = (autostart: boolean): void => {
  if (process.platform !== 'linux') return;
  const file = getAutostartPath();
  debug(`autostart entry: ${file}`);
  if (!autostart) {
    fs.existsSync(file) && fs.unlinkSync(file);
  } else {
    fs.writeFileSync(file, getEntry());
    fs.chmodSync(file, '755');
  }
};

export const linuxMakeDesktop = (): void => {
  if (process.platform !== 'linux') return;
  const file = getApplicationsPath();
  debug(`desktop entry: ${file}`);
  fs.copyFileSync(iconSrc, iconDst);
  fs.writeFileSync(file, getEntry());
  fs.chmodSync(file, '755');
};

app.whenReady().then(linuxMakeDesktop);
