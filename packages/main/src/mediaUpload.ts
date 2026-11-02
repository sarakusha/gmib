import fs from 'node:fs';
import path from 'node:path';

import debugFactory from 'debug';
import type { Request, RequestHandler } from 'express';
import formidable from 'formidable';
import { nanoid } from 'nanoid';

import { asyncSerial, notEmpty } from '/@common/helpers';

import { getAllMedia } from './media';
import { loadMedia } from './mediaImport';
import { getMediaImportError } from './mediaImportSafety';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:mediaUpload`);
type MediaUploadError = { filename: string; message: string };

export const createMediaUploadHandler =
  (mediaRoot: string, onUploaded: (request: Request) => void): RequestHandler =>
  (req, res, next) => {
    void (async () => {
      // Multipart writers must not race each other or overwrite published media/thumbnails.
      const uploadDir = await fs.promises.mkdtemp(path.join(mediaRoot, '.upload-'));
      try {
        const form = formidable({
          uploadDir,
          keepExtensions: true,
          multiples: true,
          hashAlgorithm: 'md5',
          maxFileSize: Number.MAX_SAFE_INTEGER,
          filename: (_original, ext) => `${nanoid()}${ext}`,
          filter: ({ mimetype, name }) =>
            (mimetype != null &&
              (mimetype.startsWith('image/') || mimetype.startsWith('video/'))) ||
            (name != null && ['.mkv'].includes(path.extname(name))),
        });
        const [, files] = await form.parse(req);
        const errors: MediaUploadError[] = [];
        const loaded = (
          await asyncSerial(
            Object.values(files)
              .flatMap(file => file ?? [])
              .filter(notEmpty),
            async file => {
              try {
                return await loadMedia(file, mediaRoot);
              } catch (error) {
                const message = getMediaImportError(error);
                errors.push({ filename: file.originalFilename ?? file.newFilename, message });
                debug(`error while loading ${file.originalFilename}: ${message}`);
                return undefined;
              }
            },
          )
        ).filter(notEmpty);
        debug(`files uploaded: ${JSON.stringify(loaded)}`);
        const result = await getAllMedia();
        if (errors.length > 0) {
          res.status(207).json({ media: result, errors });
        } else {
          res.json(result);
        }
        onUploaded(req);
      } finally {
        await fs.promises.rm(uploadDir, { recursive: true, force: true }).catch(error => {
          debug('Unable to remove upload staging directory %s: %s', uploadDir, error);
        });
      }
    })().catch(next);
  };
