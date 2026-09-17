import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { app } from 'electron';
import express, { type RequestHandler } from 'express';
import { nanoid } from 'nanoid';

import {
  type PluginInstallConsent,
  type PluginPermission,
  pluginPermissions,
} from '/@common/plugins';

import { requireLicenseCapability } from './licenseState';
import { MAX_PLUGIN_ARCHIVE_SIZE } from './pluginArchive';
import { type OfficialPluginPin, pluginLifecycle, PluginLifecycleError } from './pluginLifecycle';

const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const allowedPermissions = new Set<string>(pluginPermissions);

type LifecycleService = typeof pluginLifecycle;

const asyncRoute =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

const text = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PluginLifecycleError('invalid_request', `Поле ${field} не задано`);
  }
  return value.trim();
};

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PluginLifecycleError('invalid_request', 'Тело запроса должно быть JSON-объектом');
  }
  return value as Record<string, unknown>;
};

const pluginId = (value: unknown): string => {
  const result = text(value, 'id');
  if (!ID_PATTERN.test(result)) {
    throw new PluginLifecycleError('invalid_request', 'Недопустимый идентификатор плагина');
  }
  return result;
};

const sha256 = (value: unknown): string => {
  const result = text(value, 'sha256').toLowerCase();
  if (!SHA256_PATTERN.test(result)) {
    throw new PluginLifecycleError('invalid_request', 'Поле sha256 должно содержать SHA-256');
  }
  return result;
};

const boolean = (value: unknown, field: string): boolean => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new PluginLifecycleError('invalid_request', `Поле ${field} должно быть boolean`);
};

const permissions = (value: unknown): PluginPermission[] => {
  const result =
    typeof value === 'string'
      ? value === ''
        ? []
        : value.split(',')
      : Array.isArray(value) && value.every(permission => typeof permission === 'string')
        ? value
        : undefined;
  if (!result) {
    throw new PluginLifecycleError(
      'invalid_request',
      'Поле permissions должно содержать массив или разделённый запятыми список',
    );
  }
  if (
    new Set(result).size !== result.length ||
    result.some(permission => !allowedPermissions.has(permission))
  ) {
    throw new PluginLifecycleError(
      'invalid_request',
      'Поле permissions содержит неверные значения',
    );
  }
  return result as PluginPermission[];
};

const consentFrom = (source: Record<string, unknown>): PluginInstallConsent => ({
  permissions: permissions(source.permissions),
  trustedBackend: boolean(source.trustedBackend, 'trustedBackend'),
});

const pinFrom = (id: unknown, source: Record<string, unknown>): OfficialPluginPin => {
  return {
    id: pluginId(id),
    version: text(source.version, 'version'),
    sha256: sha256(source.sha256),
  };
};

const receiveArchive = async (
  req: Parameters<RequestHandler>[0],
  createTemporaryDirectory: () => Promise<string>,
): Promise<{ archivePath: string; cleanup: () => Promise<void>; sha256: string }> => {
  if (!req.headers['content-type']?.toLowerCase().startsWith('application/octet-stream')) {
    throw new PluginLifecycleError(
      'invalid_content_type',
      'Архив нужно передавать как application/octet-stream',
      415,
    );
  }
  const contentLength = Number(req.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_PLUGIN_ARCHIVE_SIZE) {
    throw new PluginLifecycleError('archive_too_large', 'Размер архива превышает 50 МБ', 413);
  }
  const directory = await createTemporaryDirectory();
  const archivePath = path.join(directory, 'upload.gmib-plugin');
  const hash = crypto.createHash('sha256');
  let size = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.byteLength;
      if (size > MAX_PLUGIN_ARCHIVE_SIZE) {
        callback(
          new PluginLifecycleError('archive_too_large', 'Размер архива превышает 50 МБ', 413),
        );
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(req, limiter, fs.createWriteStream(archivePath, { mode: 0o600 }));
    if (size === 0) throw new PluginLifecycleError('empty_archive', 'Архив плагина пуст');
    return {
      archivePath,
      cleanup: () => fs.promises.rm(directory, { recursive: true, force: true }),
      sha256: hash.digest('hex'),
    };
  } catch (error) {
    await fs.promises.rm(directory, { recursive: true, force: true });
    throw error;
  }
};

export const createPluginManagementRouter = (
  service: LifecycleService,
  options: {
    createTemporaryDirectory?: () => Promise<string>;
    requireCapability?: () => void;
  } = {},
): express.Router => {
  const router = express.Router();
  const createTemporaryDirectory =
    options.createTemporaryDirectory ??
    (() => fs.promises.mkdtemp(path.join(app.getPath('temp'), `gmib-plugin-upload-${nanoid()}-`)));

  router.use((_req, res, next) => {
    try {
      (options.requireCapability ?? (() => requireLicenseCapability('plugins')))();
      next();
    } catch (error) {
      const status =
        error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
          ? error.status
          : 403;
      res.status(status).json({
        error: { code: 'plugin_capability_required', message: (error as Error).message },
      });
    }
  });

  router.get(
    '/',
    asyncRoute(async (_req, res) => res.json({ plugins: await service.list() })),
  );
  router.get(
    '/catalog',
    asyncRoute(async (_req, res) => res.json({ plugins: await service.catalog() })),
  );
  router.get(
    '/official/:id/inspect',
    asyncRoute(async (req, res) => {
      res.json(await service.inspectOfficial(pinFrom(req.params.id, req.query)));
    }),
  );
  router.post(
    '/official/:id/install',
    asyncRoute(async (req, res) => {
      const body = record(req.body);
      res.json(
        await service.installOfficial(
          pinFrom(req.params.id, body),
          consentFrom(body),
          boolean(body.enabled, 'enabled'),
        ),
      );
    }),
  );
  for (const operation of ['inspect', 'install'] as const) {
    router.post(
      `/archive/${operation}`,
      asyncRoute(async (req, res) => {
        const expectedSha256 = sha256(req.query.sha256);
        const upload = await receiveArchive(req, createTemporaryDirectory);
        try {
          if (upload.sha256 !== expectedSha256) {
            throw new PluginLifecycleError(
              'archive_hash_mismatch',
              'SHA-256 архива плагина не совпадает с ожидаемым значением',
              409,
            );
          }
          if (operation === 'inspect') {
            res.json(await service.inspectArchive(upload.archivePath, expectedSha256));
          } else {
            res.json(
              await service.installArchive(
                upload.archivePath,
                expectedSha256,
                consentFrom(req.query),
                boolean(req.query.enabled, 'enabled'),
              ),
            );
          }
        } finally {
          await upload.cleanup();
        }
      }),
    );
  }
  router.put(
    '/:id/enabled',
    asyncRoute(async (req, res) => {
      const id = pluginId(req.params.id);
      const body = record(req.body);
      res.json(await service.setEnabled(id, boolean(body.enabled, 'enabled')));
    }),
  );
  router.delete(
    '/:id',
    asyncRoute(async (req, res) => {
      const id = pluginId(req.params.id);
      res.json(await service.uninstall(id));
    }),
  );

  router.use(((error, _req, res, _next) => {
    if (error instanceof PluginLifecycleError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    res.status(500).json({
      error: {
        code: 'plugin_lifecycle_failed',
        message: 'Операция с плагином завершилась ошибкой',
      },
    });
  }) as express.ErrorRequestHandler);
  return router;
};

export const pluginManagementRouter = createPluginManagementRouter(pluginLifecycle);
