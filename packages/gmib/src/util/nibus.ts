/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { getNibusSession, INibusSession } from '@nibus/core';

if (!window) throw new Error('only renderer process');

const query = new URLSearchParams(window.location.search);

export const isRemoteSession = (query?.get('host') ?? 'localhost') !== 'localhost';

export const getCurrentNibusSession = (): INibusSession => {
  const port = +(query.get('port') ?? process.env.NIBUS_PORT ?? 9001);
  const host = query.get('host') ?? 'localhost';
  return getNibusSession(+port, host);
};
