/* eslint-disable import/first */
/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
window.localStorage.debug = process.env.DEBUG;

import log from 'electron-log';
import debugFactory from 'debug';

log.transports.file.level = 'info';
log.transports.file.fileName = 'gmib.log';
log.transports.console.level = false;
debugFactory.log = log.log.bind(log);
