/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

let lastTimeid: number;

export default function timeid(): string {
  const time = Date.now();
  const last = lastTimeid || time;
  lastTimeid = time > last ? time : last + 1;
  return lastTimeid.toString(36);
}
