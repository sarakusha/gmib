import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer, type Server } from 'node:http';

import Store from 'electron-store';
import express, { type RequestHandler } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Config } from '/@common/config';
import { configSchema } from '/@common/schema';

import {
  ManagementSettingsService,
  createManagementSettingsService,
} from '../src/managementSettings';
import { createManagementSettingsRouter } from '../src/managementSettingsRouter';

const baseConfig = (): Config =>
  ({
    brightness: 30,
    autobrightness: false,
    logLevel: 'none',
    overheatProtection: {
      interval: 15,
      bottomBound: 65,
      upperBound: 85,
      step: 5,
      aggregation: 0,
      enabled: false,
    },
    hid: { VID: 123, PID: 456 },
  }) as Config;

const servers: Server[] = [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        server =>
          new Promise<void>((resolve, reject) =>
            server.close(error => (error ? reject(error) : resolve())),
          ),
      ),
  );
  directories.splice(0).forEach(directory => {
    fs.rmSync(directory, { recursive: true, force: true });
  });
});

const startApi = async (initial = baseConfig()) => {
  let config = initial;
  const updateConfigStore = vi.fn((update: (current: Config) => Config) => {
    config = update(config);
    return config;
  });
  const service = createManagementSettingsService({
    getConfig: () => config,
    updateConfigStore,
  });
  const authenticated: RequestHandler = (_req, _res, next) => next();
  const app = express();
  app.use(express.json());
  app.use('/api/manage/v1', createManagementSettingsRouter({ service, strictAuth: authenticated }));
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test server did not start');
  const url = `http://127.0.0.1:${address.port}/api/manage/v1/settings`;
  const request = async (path = '', init: RequestInit = {}) => fetch(`${url}${path}`, init);
  return { config: () => config, request, service, updateConfigStore };
};

const json = (value: unknown): string => JSON.stringify(value);

describe('management settings service', () => {
  it('reads only the allowlisted settings and requires strictAuth', async () => {
    const auth = vi.fn<RequestHandler>((_req, _res, next) => next());
    const service = new ManagementSettingsService({
      getConfig: () => ({ ...baseConfig(), hid: { VID: 9, PID: 10 } }),
      updateConfigStore: vi.fn(),
    });
    const app = express();
    app.use('/settings', createManagementSettingsRouter({ service, strictAuth: auth }));
    const server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server did not start');
    const response = await fetch(`http://127.0.0.1:${address.port}/settings/settings`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      brightness: 30,
      autobrightness: false,
      spline: configSchema.spline.default,
      sunSpline: configSchema.sunSpline.default,
    });
    expect(auth).toHaveBeenCalledOnce();
    expect(() =>
      createManagementSettingsRouter({
        service,
        strictAuth: undefined as unknown as RequestHandler,
      }),
    ).toThrow('requires strictAuth');
  });

  it('deep-merges location and night mode while preserving unrelated config', async () => {
    const api = await startApi({
      ...baseConfig(),
      location: { latitude: 55.75, longitude: 37.62 },
      nightMode: { start: '22:00', end: '06:00', brightness: 12 },
    });
    const response = await api.request('', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: json({ location: { latitude: 56 }, nightMode: { brightness: 8 } }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      changed: true,
      dryRun: false,
      settings: {
        brightness: 30,
        autobrightness: false,
        location: { latitude: 56, longitude: 37.62 },
        nightMode: { start: '22:00', end: '06:00', brightness: 8 },
        spline: configSchema.spline.default,
        sunSpline: configSchema.sunSpline.default,
      },
    });
    expect(api.updateConfigStore).toHaveBeenCalledOnce();
    expect(api.config().hid).toEqual({ VID: 123, PID: 456 });
  });

  it('toggles autobrightness, supports curve replacement and returns no-op', async () => {
    const api = await startApi();
    const patch = {
      autobrightness: true,
      spline: [
        [0, 5],
        [100, 40],
      ],
    };
    const first = await api.request('', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: json(patch),
    });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ changed: true, dryRun: false });
    const second = await api.request('', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: json(patch),
    });
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ changed: false, dryRun: false });
    expect(api.updateConfigStore).toHaveBeenCalledOnce();
  });

  it('resets curves to schema defaults with a real config store', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gmib-management-settings-'));
    directories.push(cwd);
    const store = new Store<Config>({
      cwd,
      name: 'config',
      schema: configSchema,
      clearInvalidConfig: true,
    });
    store.store = { ...store.store, spline: undefined, sunSpline: undefined };
    expect(store.get('spline')).toEqual(configSchema.spline.default);
    expect(store.get('sunSpline')).toEqual(configSchema.sunSpline.default);
    const customSpline: NonNullable<Config['spline']> = [
      [0, 5],
      [100, 40],
    ];
    const customSunSpline: NonNullable<Config['sunSpline']> = [['time:12:00', 55]];
    store.store = { ...store.store, spline: customSpline, sunSpline: customSunSpline };
    const updateConfigStore = vi.fn((update: (current: Config) => Config) => {
      store.store = update(store.store);
      return store.store;
    });
    const service = createManagementSettingsService({
      getConfig: () => store.store,
      updateConfigStore,
    });
    const reset = { spline: null, sunSpline: null };

    expect(service.patch(reset, true)).toEqual({
      changed: true,
      dryRun: true,
      settings: {
        brightness: 30,
        autobrightness: false,
        spline: configSchema.spline.default,
        sunSpline: configSchema.sunSpline.default,
      },
    });
    expect(store.get('spline')).toEqual(customSpline);
    expect(store.get('sunSpline')).toEqual(customSunSpline);
    expect(updateConfigStore).not.toHaveBeenCalled();

    expect(service.patch(reset)).toEqual({
      changed: true,
      dryRun: false,
      settings: {
        brightness: 30,
        autobrightness: false,
        spline: configSchema.spline.default,
        sunSpline: configSchema.sunSpline.default,
      },
    });
    expect(store.get('spline')).toEqual(configSchema.spline.default);
    expect(store.get('sunSpline')).toEqual(configSchema.sunSpline.default);

    expect(service.patch(reset)).toEqual({
      changed: false,
      dryRun: false,
      settings: {
        brightness: 30,
        autobrightness: false,
        spline: configSchema.spline.default,
        sunSpline: configSchema.sunSpline.default,
      },
    });
    expect(updateConfigStore).toHaveBeenCalledOnce();
  });

  it('validates unknown fields, ranges, times, and curve ordering', async () => {
    const api = await startApi();
    for (const body of [
      { secret: 'nope' },
      { brightness: 101 },
      { location: { latitude: 91 } },
      {
        spline: [
          [100, 20],
          [10, 30],
        ],
      },
      { sunSpline: [['time:25:00', 20]] },
      { nightMode: { start: '22:00' } },
    ]) {
      const response = await api.request('', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: json(body),
      });
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('invalid_settings');
    }
    expect(api.updateConfigStore).not.toHaveBeenCalled();
  });

  it('dry-runs validated changes without notification or persistence', async () => {
    const api = await startApi();
    const response = await api.request('?dryRun=true', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: json({ brightness: 70, autobrightness: true }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      changed: true,
      dryRun: true,
      settings: {
        brightness: 70,
        autobrightness: true,
        spline: configSchema.spline.default,
        sunSpline: configSchema.sunSpline.default,
      },
    });
    expect(api.config()).toMatchObject({ brightness: 30, autobrightness: false });
    expect(api.updateConfigStore).not.toHaveBeenCalled();
  });

  it('rejects unsupported query parameters', async () => {
    const api = await startApi();
    const response = await api.request('?dryRun=1', { method: 'PATCH', body: '{}' });
    expect(response.status).toBe(400);
    expect(api.updateConfigStore).not.toHaveBeenCalled();
  });
});
