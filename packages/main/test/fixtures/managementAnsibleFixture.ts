import { createServer } from 'node:http';

import { createVerifierAndSalt, SRPParameters, SRPRoutines } from '@sarakusha/tssrp6a';
import express, { type RequestHandler } from 'express';

import generateSignature from '/@common/generateSignature';
import type { RemoteAuthCredentials } from '/@common/helpers';
import { srpSessionKeyToBuffer } from '/@common/srp';

import type { AuthorizationContext } from '../../src/auth';
import { createSrpAuthRouter } from '../../src/srpAuthRouter';
import { SrpAuthService } from '../../src/srpAuthService';

type Resource = Record<string, unknown> & { id: number | string };

const resourceTypes = [
  'screen',
  'player',
  'playlist',
  'mapping',
  'scheduler',
  'gmib-scheduler',
] as const;

const credentialsFor = async (password: string): Promise<RemoteAuthCredentials> => {
  const routines = new SRPRoutines(new SRPParameters());
  const { s, v } = await createVerifierAndSalt(routines, 'gmib', password);
  return { salt: `0x${s.toString(16)}`, verifier: `0x${v.toString(16)}`, revision: 0 };
};

export const startManagementAnsibleFixture = async (password = 'fixture-password') => {
  let credentials = await credentialsFor(password);
  let licensed = true;
  let failNextType: string | undefined;
  let failNextRelaunch = false;
  let pluginReadbackFailures = 0;
  let settings: Record<string, unknown> = {
    brightness: 50,
    autobrightness: false,
    spline: [
      [10, 10],
      [10000, 80],
    ],
    sunSpline: [
      ['event:dawn', 10],
      ['event:solarNoon', 80],
    ],
  };
  let desiredPlugin: Resource | undefined;
  let runningPlugin: Resource | undefined;
  let pluginSettings: Record<string, unknown> = { scene: 'aurora', speed: 1 };
  const incoming = new Map<string, { revision: number; secret: Buffer }>();
  const resources = Object.fromEntries(resourceTypes.map(type => [type, []])) as Record<
    (typeof resourceTypes)[number],
    Resource[]
  >;
  const nextId = Object.fromEntries(resourceTypes.map(type => [type, 1])) as Record<
    (typeof resourceTypes)[number],
    number
  >;
  const mutations = new Map<string, number>();
  const recordMutation = (key: string) => mutations.set(key, (mutations.get(key) ?? 0) + 1);

  const service = new SrpAuthService({
    credentials: {
      get: async () => credentials,
      set: async next => {
        credentials = next;
      },
    },
    incomingSecrets: {
      set: async (id, secret, revision) => {
        incoming.set(id, { revision, secret: srpSessionKeyToBuffer(secret) });
      },
      revokeAll: async () => {
        incoming.clear();
      },
    },
  });
  const auth: RequestHandler = (req, res, next) => {
    const id = req.headers['x-ni-identifier'];
    const timestamp = Number(req.headers['x-ni-timestamp']);
    const stored = typeof id === 'string' ? incoming.get(id) : undefined;
    const expected =
      stored && generateSignature(stored.secret, req.method, req.originalUrl, timestamp, req.body);
    if (
      stored &&
      stored.revision === credentials.revision &&
      Number.isFinite(timestamp) &&
      Math.abs(Date.now() - timestamp) < 60_000 &&
      expected === req.headers['x-ni-signature']
    ) {
      const authorization: AuthorizationContext = {
        identifier: id as string,
        kind: 'remote',
        revision: stored.revision,
      };
      Object.assign(res.locals, { authorization });
      next();
      return;
    }
    res.status(401).json({ identifier: 'ansible-fixture' });
  };
  const activeLicense: RequestHandler = (_req, res, next) => {
    if (licensed) next();
    else res.status(403).json({ error: { code: 'license_inactive', message: 'License inactive' } });
  };

  const app = express();
  app.use(express.json());
  app.get('/api/identifier', (_req, res) => res.send('ansible-fixture'));
  app.use('/api', createSrpAuthRouter(service, auth));
  app.get('/api/announce', auth, (_req, res) => {
    res.json({ licenseState: { status: licensed ? 'active' : 'missing' } });
  });

  for (const type of resourceTypes) {
    const basePath = `/api/${type}`;
    app.get(basePath, auth, activeLicense, (_req, res) => res.json(resources[type]));
    if (!['mapping', 'scheduler', 'gmib-scheduler'].includes(type)) {
      app.get(`${basePath}/:id`, auth, activeLicense, (req, res) => {
        const id = Number(req.params.id);
        const resource = resources[type].find(item => item.id === id);
        if (!resource) res.sendStatus(404);
        else res.json(resource);
      });
    }
    app.post(basePath, auth, activeLicense, (req, res) => {
      if (failNextType === type) {
        failNextType = undefined;
        res.status(500).json({ error: { code: 'fixture_failure', message: 'Injected failure' } });
        return;
      }
      const requestedId = req.body.id;
      const id =
        typeof requestedId === 'string' && requestedId.length > 0 ? requestedId : nextId[type]++;
      const resource = { ...req.body, id } as Resource;
      resources[type].push(resource);
      recordMutation(`${type}:create`);
      res.json(resource);
    });
    const update = (req: express.Request, res: express.Response) => {
      const id = req.params.id ?? req.body.id;
      const normalizedId = ['scheduler', 'gmib-scheduler'].includes(type) ? id : Number(id);
      const index = resources[type].findIndex(item => item.id === normalizedId);
      if (index < 0) {
        res.sendStatus(404);
        return;
      }
      resources[type][index] = { ...resources[type][index], ...req.body, id: normalizedId };
      recordMutation(`${type}:update`);
      res.json(resources[type][index]);
    };
    if (['scheduler', 'gmib-scheduler'].includes(type))
      app.put(`${basePath}/:id`, auth, activeLicense, update);
    else app.put(basePath, auth, activeLicense, update);
    app.delete(`${basePath}/:id`, auth, activeLicense, (req, res) => {
      const normalizedId = ['scheduler', 'gmib-scheduler'].includes(type)
        ? req.params.id
        : Number(req.params.id);
      resources[type] = resources[type].filter(item => item.id !== normalizedId);
      recordMutation(`${type}:delete`);
      res.json({});
    });
  }

  app.get('/api/media', auth, activeLicense, (_req, res) => res.json([]));
  app.get('/api/pages', auth, activeLicense, (_req, res) => res.json([]));

  app.patch('/api/manage/v1/settings', auth, activeLicense, (req, res) => {
    const next = { ...settings, ...req.body };
    const changed = JSON.stringify(next) !== JSON.stringify(settings);
    const dryRun = req.query.dryRun === 'true';
    if (changed && !dryRun) {
      settings = next;
      recordMutation('settings:update');
    }
    res.json({ changed, dryRun, settings: next });
  });

  const pluginStatus = (plugin: Resource) => ({
    ...plugin,
    runningEnabled: Boolean(runningPlugin),
    runningVersion: runningPlugin?.manifest && (runningPlugin.manifest as Resource).version,
    restartRequired: plugin.enabled
      ? !runningPlugin ||
        runningPlugin.enabled !== plugin.enabled ||
        (runningPlugin.manifest as Resource).version !== (plugin.manifest as Resource).version
      : Boolean(runningPlugin),
  });
  app.get('/api/manage/v1/plugins', auth, activeLicense, (_req, res) => {
    if (pluginReadbackFailures > 0) {
      pluginReadbackFailures -= 1;
      res.status(503).json({ error: { code: 'restarting', message: 'Runtime is restarting' } });
      return;
    }
    res.json({ plugins: desiredPlugin ? [pluginStatus(desiredPlugin)] : [] });
  });
  app.post('/api/manage/v1/plugins/official/:id/install', auth, activeLicense, (req, res) => {
    const next = {
      id: req.params.id,
      manifest: {
        id: req.params.id,
        version: req.body.version,
        permissions: req.body.permissions,
        ...(req.body.trustedBackend ? { main: 'dist/main.cjs' } : {}),
      },
      archiveSha256: req.body.sha256,
      enabled: req.body.enabled,
    } as Resource;
    const changed = JSON.stringify(desiredPlugin) !== JSON.stringify(next);
    if (changed) {
      desiredPlugin = next;
      recordMutation('plugin:install');
    }
    res.json({ changed, plugin: pluginStatus(next), restartRequired: changed });
  });
  app.put('/api/manage/v1/plugins/:id/enabled', auth, activeLicense, (req, res) => {
    if (!desiredPlugin || desiredPlugin.id !== req.params.id) {
      res.sendStatus(404);
      return;
    }
    const changed = desiredPlugin.enabled !== req.body.enabled;
    desiredPlugin = { ...desiredPlugin, enabled: req.body.enabled };
    if (changed) recordMutation('plugin:enabled');
    res.json({ changed, plugin: pluginStatus(desiredPlugin), restartRequired: changed });
  });
  app.delete('/api/manage/v1/plugins/:id', auth, activeLicense, (req, res) => {
    if (pluginReadbackFailures > 0) {
      pluginReadbackFailures -= 1;
      res.status(503).json({ error: { code: 'restarting', message: 'Runtime is restarting' } });
      return;
    }
    const changed = desiredPlugin?.id === req.params.id;
    if (changed) {
      desiredPlugin = undefined;
      recordMutation('plugin:delete');
    }
    res.json({ changed, restartRequired: Boolean(runningPlugin) });
  });
  app.post('/api/relaunch', auth, activeLicense, (_req, res) => {
    if (failNextRelaunch) {
      failNextRelaunch = false;
      res
        .status(500)
        .json({ error: { code: 'fixture_failure', message: 'Injected relaunch failure' } });
      return;
    }
    recordMutation('relaunch');
    res.json({});
    pluginReadbackFailures = 1;
    setTimeout(() => {
      runningPlugin = desiredPlugin ? structuredClone(desiredPlugin) : undefined;
    }, 200).unref();
  });
  app.get('/api/plugins/example-plugin/settings', auth, activeLicense, (_req, res) => {
    if (!runningPlugin) {
      res.sendStatus(404);
      return;
    }
    res.json({ settings: pluginSettings });
  });
  app.patch('/api/plugins/example-plugin/settings', auth, activeLicense, (req, res) => {
    if (!runningPlugin) {
      res.sendStatus(404);
      return;
    }
    const next = { ...pluginSettings, ...req.body };
    const changed = JSON.stringify(next) !== JSON.stringify(pluginSettings);
    if (changed) {
      pluginSettings = next;
      recordMutation('plugin-settings:update');
    }
    res.json({ changed, settings: pluginSettings });
  });

  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture did not start');

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve())),
      ),
    failOnce(type: string) {
      failNextType = type;
    },
    failRelaunchOnce() {
      failNextRelaunch = true;
    },
    mutationCount() {
      return Array.from(mutations.values()).reduce((sum, value) => sum + value, 0);
    },
    mutationCountFor(key: string) {
      return mutations.get(key) ?? 0;
    },
    resources,
    setLicensed(value: boolean) {
      licensed = value;
    },
    drift() {
      resources.screen[0] = { ...resources.screen[0], width: 800 };
      settings = { ...settings, brightness: 15 };
      pluginSettings = { ...pluginSettings, speed: 0.5 };
    },
    snapshot() {
      return structuredClone({ resources, settings, pluginSettings, desiredPlugin, runningPlugin });
    },
  };
};
