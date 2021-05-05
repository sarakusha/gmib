/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import http from 'http';
import fs from 'fs';
import { AddressInfo } from 'net';
import rangeParser from 'range-parser';
import pump from 'pump';
import { log } from '../util/debug';

type ReadStreamOptions = Parameters<typeof fs.createReadStream>[1];

const VIDEO = '/Users/sarakusha/Movies/tests/daschmi_video.mp4';
const createReadStream = (opts?: ReadStreamOptions): fs.ReadStream =>
  fs.createReadStream(VIDEO, opts);
const { size } = fs.statSync(VIDEO);

const server = http.createServer((req, res): void => {
  if (req.url !== '/video') {
    res.statusCode = 404;
    res.end();
    return;
  }
  if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', 'video/mp4');
  const range = req.headers.range && rangeParser(size, req.headers.range)[0];
  if (!range) {
    res.setHeader('Content-Length', size);
    if (req.method === 'HEAD') res.end();
    else pump(createReadStream(), res);
    return;
  }

  res.statusCode = 206;
  res.setHeader('Content-Length', range.end - range.start + 1);
  res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
  if (req.method === 'HEAD') res.end();
  else pump(createReadStream(range), res);
});

server.listen(0, () => {
  log.log(`Playback server running on port ${(server.address() as AddressInfo).port}`);
});

export default server;
