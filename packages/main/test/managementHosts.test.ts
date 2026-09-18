import { createServer, type Server } from 'node:http';

import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CustomHost, RemoteHost } from '/@common/helpers';

const mocks = vi.hoisted(() => ({
  identifier: 'server-identifier',
  localSecret: Buffer.from('local-secret'),
  remoteSecret: Buffer.from('remote-secret'),
}));

vi.mock('../src/localConfig', () => ({
  default: { get: vi.fn(() => mocks.identifier), set: vi.fn() },
}));
vi.mock('../src/secret', () => ({
  default: mocks.localSecret,
  getIncomingSecretWithRevision: vi.fn(async () => ({
    revision: 0,
    secret: mocks.remoteSecret,
  })),
}));

import auth from '../src/auth';
import { mountApiAuth } from '../src/apiAuth';
import { mountManagementHostsApi } from '../src/managementHostsApi';
import {
  ManagementHostsRevisionError,
  ManagementHostsStoredDataError,
  ManagementHostsValidationError,
  createManagementHostsService,
} from '../src/managementHosts';

const servers: Server[] = [];
const authorization = { authorization: `Bearer ${mocks.localSecret.toString('base64')}` };

const createFixture = (initial: CustomHost[] = [], discovered: RemoteHost[] = []) => {
  let saved = structuredClone(initial);
  const setSavedHosts = vi.fn((hosts: CustomHost[]) => {
    saved = structuredClone(hosts);
  });
  const service = createManagementHostsService({
    getSavedHosts: () => saved,
    setSavedHosts,
    getDiscoveredHosts: () => discovered,
  });
  return { getSaved: () => saved, service, setSavedHosts };
};

const toPutHost = ({
  address,
  nibusPort,
  name,
}: {
  address: string;
  nibusPort: number;
  name?: string;
}) => ({ address, nibusPort, ...(name ? { name } : {}) });

const startApi = async (
  unsafeMode: boolean,
  status: 'active' | 'unlicensed' = 'active',
  fixture = createFixture(),
) => {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    Object.assign(res.locals, { receivedAt: Date.now() });
    next();
  });
  const api = express.Router();
  mountApiAuth(api, {
    auth,
    getLicenseStatus: () => status,
    srpRouter: express.Router(),
    unsafeMode,
  });
  mountManagementHostsApi(api, { hostsService: fixture.service });
  app.use('/api', api);
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
  return { fixture, url: `http://127.0.0.1:${address.port}/api/manage/v1/hosts` };
};

beforeEach(() => vi.clearAllMocks());

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
});

describe('management hosts service', () => {
  it('normalizes endpoint identities and keeps discovery outside the saved revision', async () => {
    const fixture = createFixture(
      [
        { address: 'SIGN.Example.', port: 9001, name: ' Main ' },
        { address: '2001:0db8:0:0:0:0:0:1', port: 9100 },
      ],
      [
        {
          address: '192.0.2.10',
          port: 9001,
          name: 'Found',
          version: '5.5.0',
          platform: 'linux',
        },
      ],
    );
    const first = await fixture.service.get();
    expect(first.saved).toEqual([
      {
        key: 'sign.example:9001',
        address: 'sign.example',
        nibusPort: 9001,
        apiPort: 9002,
        name: 'Main',
      },
      {
        key: '[2001:db8::1]:9100',
        address: '2001:db8::1',
        nibusPort: 9100,
        apiPort: 9101,
      },
    ]);
    expect(first.discovered).toEqual([
      {
        key: '192.0.2.10:9001',
        address: '192.0.2.10',
        nibusPort: 9001,
        apiPort: 9002,
        name: 'Found',
        version: '5.5.0',
        platform: 'linux',
      },
    ]);

    const otherDiscovery = createFixture(fixture.getSaved(), [
      { address: '192.0.2.11', port: 9001, name: 'Other', version: '5.6.0' },
    ]);
    expect((await otherDiscovery.service.get()).revision).toBe(first.revision);
  });

  it('replaces the complete saved list, while dry-run and no-op do not persist', async () => {
    const fixture = createFixture([{ address: 'old.example', port: 9001, name: 'Old' }]);
    const current = await fixture.service.get();
    const body = {
      revision: current.revision,
      hosts: [{ address: 'NEW.example.', nibusPort: 9100, name: ' New ' }],
    };

    const preview = fixture.service.put(body, true);
    expect(preview).toMatchObject({ changed: true, dryRun: true });
    expect(preview.revision).not.toBe(current.revision);
    expect(fixture.setSavedHosts).not.toHaveBeenCalled();

    const applied = fixture.service.put(body);
    expect(applied).toEqual({ ...preview, dryRun: false });
    expect(fixture.getSaved()).toEqual([{ address: 'new.example', port: 9100, name: 'New' }]);
    expect(fixture.setSavedHosts).toHaveBeenCalledOnce();

    const noOp = fixture.service.put({
      revision: applied.revision,
      hosts: applied.saved.map(toPutHost),
    });
    expect(noOp).toMatchObject({ changed: false, dryRun: false, revision: applied.revision });
    expect(fixture.setSavedHosts).toHaveBeenCalledOnce();
  });

  it('does not reorder storage for a semantically identical replacement', async () => {
    const fixture = createFixture([
      { address: 'z.example', port: 9001 },
      { address: 'a.example', port: 9001 },
    ]);
    const current = await fixture.service.get();
    const result = fixture.service.put({
      revision: current.revision,
      hosts: [...current.saved].reverse().map(toPutHost),
    });
    expect(result.changed).toBe(false);
    expect(result.saved.map(host => host.address)).toEqual(['z.example', 'a.example']);
    expect(fixture.setSavedHosts).not.toHaveBeenCalled();
  });

  it('propagates a persistence failure without advancing the saved revision', async () => {
    const saved = [{ address: 'old.example', port: 9001 }];
    const service = createManagementHostsService({
      getSavedHosts: () => saved,
      setSavedHosts: () => {
        throw new Error('disk full');
      },
      getDiscoveredHosts: () => [],
    });
    const current = await service.get();
    expect(() =>
      service.put({
        revision: current.revision,
        hosts: [{ address: 'new.example', nibusPort: 9100 }],
      }),
    ).toThrow('disk full');
    expect((await service.get()).revision).toBe(current.revision);
    expect(saved).toEqual([{ address: 'old.example', port: 9001 }]);
  });

  it('rejects stale revisions, duplicate endpoints, invalid ports and legacy saved data', async () => {
    const fixture = createFixture([{ address: 'one.example', port: 9001 }]);
    const current = await fixture.service.get();
    fixture.service.put({
      revision: current.revision,
      hosts: [{ address: 'two.example', nibusPort: 9001 }],
    });
    expect(() => fixture.service.put({ revision: current.revision, hosts: [] })).toThrow(
      ManagementHostsRevisionError,
    );
    expect(() =>
      fixture.service.put({
        revision: 'not-a-revision',
        hosts: [],
      }),
    ).toThrow(ManagementHostsValidationError);

    const updated = await fixture.service.get();
    expect(() =>
      fixture.service.put({
        revision: updated.revision,
        hosts: [
          { address: 'EXAMPLE.com', nibusPort: 9001 },
          { address: 'example.com.', nibusPort: 9001 },
        ],
      }),
    ).toThrow(/duplicates endpoint/);
    expect(() =>
      fixture.service.put({
        revision: updated.revision,
        hosts: [{ address: 'example.com', nibusPort: 65535 }],
      }),
    ).toThrow(/between 1 and 65534/);
    for (const address of [
      'foo/bar',
      'foo?x',
      'foo#x',
      'user@foo',
      'foo\\bar',
      'foo bar',
      'fe80::1%en0',
      '[example.com]',
      '127.1',
      '0x7f000001',
    ]) {
      expect(
        () =>
          fixture.service.put({
            revision: updated.revision,
            hosts: [{ address, nibusPort: 9001 }],
          }),
        address,
      ).toThrow(ManagementHostsValidationError);
    }
    await expect(
      createFixture([{ address: 'https://bad.example/path', port: 9001 }]).service.get(),
    ).rejects.toBeInstanceOf(ManagementHostsStoredDataError);
  });
});

describe('management hosts runtime mount', () => {
  it.each([false, true])('keeps hosts strict when unsafeMode=%s', async unsafeMode => {
    const { url } = await startApi(unsafeMode);
    expect((await fetch(url)).status).toBe(401);
  });

  it('allows authenticated reads before activation but rejects mutation', async () => {
    const { fixture, url } = await startApi(
      true,
      'unlicensed',
      createFixture([{ address: 'saved.example', port: 9001 }]),
    );
    const get = await fetch(url, { headers: authorization });
    expect(get.status).toBe(200);
    const body = (await get.json()) as { revision: string };
    expect(get.headers.get('cache-control')).toBe('no-store');

    const put = await fetch(url, {
      method: 'PUT',
      headers: { ...authorization, 'content-type': 'application/json' },
      body: JSON.stringify({ revision: body.revision, hosts: [] }),
    });
    expect(put.status).toBe(403);
    expect(fixture.setSavedHosts).not.toHaveBeenCalled();
  });

  it('reports dry-run, applies once, and returns a structured stale-revision response', async () => {
    const { fixture, url } = await startApi(
      true,
      'active',
      createFixture([{ address: 'old.example', port: 9001 }]),
    );
    const get = await fetch(url, { headers: authorization });
    const current = (await get.json()) as { revision: string };
    const request = (revision: string, query = '') =>
      fetch(`${url}${query}`, {
        method: 'PUT',
        headers: { ...authorization, 'content-type': 'application/json' },
        body: JSON.stringify({
          revision,
          hosts: [{ address: 'new.example', nibusPort: 9100 }],
        }),
      });

    const preview = await request(current.revision, '?dryRun=true');
    expect(preview.status).toBe(200);
    const predicted = (await preview.json()) as { revision: string; changed: boolean };
    expect(predicted.changed).toBe(true);
    expect(fixture.setSavedHosts).not.toHaveBeenCalled();

    const applied = await request(current.revision);
    expect(applied.status).toBe(200);
    expect(await applied.json()).toMatchObject({
      changed: true,
      dryRun: false,
      revision: predicted.revision,
    });
    expect(fixture.setSavedHosts).toHaveBeenCalledOnce();

    const stale = await request(current.revision);
    expect(stale.status).toBe(412);
    await expect(stale.json()).resolves.toEqual({
      error: {
        code: 'stale_hosts_revision',
        message: 'Saved hosts changed after they were read',
        currentRevision: predicted.revision,
      },
    });
    expect(fixture.setSavedHosts).toHaveBeenCalledOnce();
  });

  it('does not reuse a saved revision as a response validator when discovery changes', async () => {
    const discovered: RemoteHost[] = [
      { address: '192.0.2.10', port: 9001, name: 'First', version: '5.5.0' },
    ];
    const fixture = createFixture([{ address: 'saved.example', port: 9001 }], discovered);
    const { url } = await startApi(true, 'active', fixture);
    const first = await fetch(url, { headers: authorization });
    const firstBody = (await first.json()) as { revision: string };
    discovered.splice(0, 1, {
      address: '192.0.2.11',
      port: 9001,
      name: 'Second',
      version: '5.5.0',
    });

    const second = await fetch(url, {
      headers: { ...authorization, 'if-none-match': `"${firstBody.revision}"` },
    });
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({
      revision: firstBody.revision,
      discovered: [{ address: '192.0.2.11' }],
    });
  });
});
