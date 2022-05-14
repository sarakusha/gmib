import { app as electronApp } from 'electron';
import fs from 'fs';
import path from 'path';

import debugFactory from 'debug';
import express from 'express';
import formidable from 'formidable';
import helmet from 'helmet';

export const MEDIA = '/media';
export const UPLOAD = '/api/upload';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:express`);

const mediaRoot = path.join(electronApp.getPath('userData'), 'media');

fs.mkdir(mediaRoot, { recursive: true }, err => {
  if (err) {
    debug(`error while create "${mediaRoot}" directory`);
  } else {
    debug(`media store: ${mediaRoot}`);
  }
});

const nameCountRegexp = /(?:(?:-(\d+))?)?$/;
const nameCountFunc = (s: string, index: string): string => `-${(parseInt(index, 10) || 0) + 1}`;

export const incrementCounterString = (s: string): string =>
  s.replace(nameCountRegexp, nameCountFunc);

const app = express();
app.use(helmet());
app.use(MEDIA, express.static(mediaRoot));
app.post(UPLOAD, (req, res, next) => {
  const form = formidable({
    uploadDir: mediaRoot,
    keepExtensions: true,
    multiples: true,
    filename: (original, ext) => {
      let name = original;
      while (fs.existsSync(path.join(mediaRoot, `${name}.${ext}`))) {
        name = incrementCounterString(name);
      }
      return `${name}.${ext}`;
    },
    filter: ({ mimetype }) =>
      !!mimetype && (mimetype.startsWith('image/') || mimetype.startsWith('video/')),
  });
  form.parse(req, (err, fields, files) => {
    if (err) {
      next(err);
    } else {
      res.json({
        fields,
        files,
      });
    }
  });
});

const port = +(process.env['NIBUS_PORT'] ?? 9001) + 1;

const server = app.listen(port, () => {
  debug(`Playback server running on port ${port}...`);
});

export default server;
