import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ request: vi.fn(), open: vi.fn(), consent: vi.fn() }));
vi.mock('electron', () => ({
  dialog: { showOpenDialog: mock.open, showMessageBox: mock.consent },
}));
vi.mock('../src/authRequest', () => ({ default: mock.request }));
vi.mock('../src/pluginArchive', () => ({ MAX_PLUGIN_ARCHIVE_SIZE: 50 * 1024 * 1024 }));
vi.mock('../src/pluginLifecycle', () => ({ pluginLifecycle: {} }));

import type { GmibWindowParams } from '/@common/WindowParams';
import { createRemotePluginLifecycle } from '../src/remotePluginLifecycle';

const params = {
  host: 'remote-host',
  nibusPort: 9001,
  info: { version: '5.7.1', name: 'Remote' },
} as GmibWindowParams;
const manifest = {
  id: 'sample',
  name: 'Sample',
  version: '1.0.0',
  gmibApi: '^1.2.0',
  main: 'main.cjs',
  permissions: ['storage'],
};
const result = { changed: true, plugin: { manifest }, restartRequired: true };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
let directory: string;

beforeEach(async () => {
  vi.resetAllMocks();
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'remote-plugin-test-'));
  mock.consent.mockResolvedValue({ response: 0 });
});
afterEach(async () => fs.rm(directory, { recursive: true, force: true }));

describe('remote plugin lifecycle', () => {
  it('uses the selected host and strict management endpoints for reads and mutations', async () => {
    mock.request
      .mockResolvedValueOnce(response({ plugins: [] }))
      .mockResolvedValueOnce(response({ plugins: [] }))
      .mockResolvedValueOnce(response(result))
      .mockResolvedValueOnce(response({ restarting: true }));
    const service = createRemotePluginLifecycle(params);
    await service.list();
    await service.catalog();
    expect(await service.setEnabled('sample', true)).toEqual(result.plugin);
    await service.restart();
    expect(mock.request.mock.calls.map(([value]) => [value.api, value.method])).toEqual([
      ['/manage/v1/plugins', 'GET'],
      ['/manage/v1/plugins/catalog', 'GET'],
      ['/manage/v1/plugins/sample/enabled', 'PUT'],
      ['/manage/v1/plugins/restart', 'POST'],
    ]);
    for (const [value] of mock.request.mock.calls)
      expect(value).toMatchObject({ host: 'remote-host', port: 9002, redirect: 'error' });
  });

  it('uploads unchanged inspected bytes with digest-bound consent after the dialog', async () => {
    const file = path.join(directory, 'sample.gmib-plugin');
    const bytes = Buffer.from('original archive');
    await fs.writeFile(file, bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    mock.open.mockResolvedValue({ canceled: false, filePaths: [file] });
    mock.request
      .mockResolvedValueOnce(response({ manifest, sha256 }))
      .mockResolvedValueOnce(response(result));
    mock.consent.mockImplementation(async () => {
      await fs.writeFile(file, 'replaced after inspection');
      return { response: 0 };
    });
    expect(await createRemotePluginLifecycle(params).install()).toMatchObject({
      status: 'installed',
    });
    const [inspect, install] = mock.request.mock.calls.map(([value]) => value);
    expect(inspect.api).toBe(`/manage/v1/plugins/archive/inspect?sha256=${sha256}`);
    expect(inspect.binaryBody).toEqual(bytes);
    expect(install.binaryBody).toEqual(bytes);
    expect(install.body).toBeUndefined();
    const query = new URL(install.api, 'http://localhost').searchParams;
    expect(query.get('sha256')).toBe(sha256);
    expect(query.get('permissions')).toBe('storage');
    expect(query.get('trustedBackend')).toBe('true');
    expect(mock.consent.mock.calls[0][0].detail).toContain('remote-host:9002');
    expect(mock.request.mock.invocationCallOrder[1]).toBeGreaterThan(
      mock.consent.mock.invocationCallOrder[0],
    );
  });

  it('does not upload when the file picker is cancelled', async () => {
    mock.open.mockResolvedValue({ canceled: true, filePaths: [] });
    expect(await createRemotePluginLifecycle(params).install()).toEqual({ status: 'cancelled' });
    expect(mock.request).not.toHaveBeenCalled();
    expect(mock.consent).not.toHaveBeenCalled();
  });

  it('does not install an archive when consent is cancelled', async () => {
    const file = path.join(directory, 'sample.zip');
    const bytes = Buffer.from('sample');
    await fs.writeFile(file, bytes);
    mock.open.mockResolvedValue({ canceled: false, filePaths: [file] });
    mock.request.mockResolvedValueOnce(
      response({ manifest, sha256: createHash('sha256').update(bytes).digest('hex') }),
    );
    mock.consent.mockResolvedValue({ response: 1 });
    expect(await createRemotePluginLifecycle(params).install()).toEqual({ status: 'cancelled' });
    expect(mock.request).toHaveBeenCalledTimes(1);
  });

  it('pins an official remote release through inspect and consent', async () => {
    const sha256 = 'a'.repeat(64);
    mock.request
      .mockResolvedValueOnce(response({ plugins: [{ manifest, release: { sha256 } }] }))
      .mockResolvedValueOnce(response({ manifest, sha256 }))
      .mockResolvedValueOnce(response(result));
    await createRemotePluginLifecycle(params).installOfficial('sample');
    expect(mock.request.mock.calls[1][0].api).toContain(`sha256=${sha256}`);
    expect(mock.request.mock.calls[2][0]).toMatchObject({
      api: '/manage/v1/plugins/official/sample/install',
      method: 'POST',
      body: {
        version: '1.0.0',
        sha256,
        permissions: ['storage'],
        trustedBackend: true,
        enabled: true,
      },
    });
  });

  it('only uninstalls the remote plugin after confirmation', async () => {
    mock.request.mockResolvedValueOnce(response({ plugins: [{ manifest }] }));
    mock.consent.mockResolvedValue({ response: 1 });
    const service = createRemotePluginLifecycle(params);
    expect(await service.uninstall('sample')).toBe(false);
    expect(mock.request).toHaveBeenCalledTimes(1);
    mock.request
      .mockResolvedValueOnce(response({ plugins: [{ manifest }] }))
      .mockResolvedValueOnce(response({ changed: true }));
    mock.consent.mockResolvedValue({ response: 0 });
    expect(await service.uninstall('sample')).toBe(true);
    expect(mock.request.mock.calls.at(-1)?.[0]).toMatchObject({
      api: '/manage/v1/plugins/sample',
      method: 'DELETE',
    });
  });

  it('gates old hosts and propagates unsupported/auth errors', async () => {
    expect(() => createRemotePluginLifecycle({ ...params, info: { version: '5.7.0' } })).toThrow(
      '5.7.1',
    );
    expect(mock.request).not.toHaveBeenCalled();
    const service = createRemotePluginLifecycle(params);
    mock.request.mockResolvedValueOnce(new Response('', { status: 404 }));
    await expect(service.list()).rejects.toThrow('5.7.1');
    mock.request.mockResolvedValueOnce(response({ error: { message: 'Permission denied' } }, 403));
    await expect(service.list()).rejects.toThrow('Permission denied');
    mock.request.mockResolvedValueOnce(undefined);
    await expect(service.restart()).rejects.toThrow('отменена');
  });
});
