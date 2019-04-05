/*
 * @license
 * Copyright (c) 2019. OOO Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

export { default as Client  } from './Client';
export { IPortArg } from './events';

export function getSocketPath(path: string) {
  return `/tmp/nibus.${path.replace(/^(\/dev\/)/, '')}`;
}
