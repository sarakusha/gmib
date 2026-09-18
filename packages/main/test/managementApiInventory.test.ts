import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { GmibApiError } from '../../../scripts/gmib-api-client.mjs';
import {
  GmibInventoryError,
  inventoryHosts,
  normalizeAddress,
  overlayFor,
  prepareMutationPaths,
  runImport,
  runSync,
  syncPlan,
  writeManagedFiles,
} from '../../../scripts/gmib-api-inventory.mjs';
import { createManagementHostsService } from '../src/managementHosts';

const ansibleAvailable = spawnSync('ansible-inventory', ['--version'], { stdio: 'ignore' }).status === 0;

const inventory = (hostvars: Record<string, Record<string, unknown>>) => ({
  _meta: { hostvars },
  all: { children: ['gmib', 'othergroup'] },
  gmib: { children: ['gmib_children'] },
  gmib_children: { hosts: Object.keys(hostvars).filter(name => name.startsWith('gmib-')) },
  othergroup: { hosts: ['ssh-only'] },
});

const record = (address: string, nibusPort: number, name?: string) => ({
  key: `${address}:${nibusPort}`,
  address,
  nibusPort,
  apiPort: nibusPort + 1,
  ...(name ? { name } : {}),
});

const revisionFor = (character: string) => `sha256:${character.repeat(64)}`;

const clientFor = (initial: ReturnType<typeof record>[], { stale = false } = {}) => {
  let revision = revisionFor('a');
  let saved = [...initial];
  const request = vi.fn(async (requestPath: string, options: { method?: string; body?: any } = {}) => {
    if (requestPath === '/api/manage/v1/hosts' && options.method === 'PUT') {
      if (stale) throw new GmibApiError('stale', { status: 412, code: 'stale_hosts_revision' });
      saved = options.body.hosts.map((host: { address: string; nibusPort: number; name?: string }) =>
        record(host.address, host.nibusPort, host.name),
      );
      revision = revisionFor('b');
      return { data: { changed: true, dryRun: false, revision, saved }, status: 200 };
    }
    if (requestPath === '/api/manage/v1/hosts') {
      return { data: { revision, saved, discovered: [] }, status: 200 };
    }
    if (requestPath.startsWith('/api/manage/v1/hosts?dryRun=')) {
      if (stale) throw new GmibApiError('stale', { status: 412, code: 'hosts_revision_stale' });
      return { data: { changed: true, dryRun: true, revision, saved }, status: 200 };
    }
    throw new Error(`Unexpected ${options.method ?? 'GET'} ${requestPath}`);
  });
  return { request, saved: () => saved };
};

describe('GMIB inventory helper', () => {
  it('uses only scoped GMIB fields and preserves SSH variables outside the overlay', () => {
    const snapshot = inventory({
      'gmib-sign': {
        ansible_host: 'ssh.example.invalid',
        ansible_user: 'automation',
        ansible_password: 'must-not-export',
        gmib_address: 'Sign.Example.Invalid.',
        gmib_nibus_port: 9001,
      },
      'ssh-only': { ansible_host: 'other.example.invalid', ansible_password: 'other-secret' },
    });
    const hosts = inventoryHosts(snapshot);
    expect(hosts).toEqual([
      {
        key: 'sign.example.invalid:9001',
        address: 'sign.example.invalid',
        nibusPort: 9001,
        name: 'gmib-sign',
        alias: 'gmib-sign',
      },
    ]);
    const output = JSON.stringify(overlayFor(hosts));
    expect(output).not.toContain('ansible_host');
    expect(output).not.toContain('ansible_password');
    expect(output).not.toContain('must-not-export');
    expect(output).toContain('gmib_api_url');
  });

  it('matches server endpoint normalization and rejects URL-like address ambiguity', () => {
    expect(normalizeAddress('BÜCHER.example.')).toBe('xn--bcher-kva.example');
    expect(normalizeAddress('[2001:0DB8:0:0::1]')).toBe('2001:db8::1');
    for (const invalid of ['host/path', 'host?query', 'host#fragment', 'host@user', '[host]']) {
      expect(() => normalizeAddress(invalid)).toThrow(GmibInventoryError);
    }
  });

  it('merges a new inventory endpoint in three-way sync and preserves remote additions', () => {
    const alpha = record('alpha.example.invalid', 9001, 'Alpha');
    const bravo = {
      key: 'bravo.example.invalid:9100',
      address: 'bravo.example.invalid',
      nibusPort: 9100,
      name: 'Bravo',
      alias: 'gmib-bravo',
    };
    const plan = syncPlan([alpha], [{ ...alpha, alias: 'gmib-alpha' }, bravo], { saved: [alpha] });
    expect(plan.hosts).toEqual(
      expect.arrayContaining([expect.objectContaining(alpha), expect.objectContaining(bravo)]),
    );
    expect(plan.actions).toContainEqual({ kind: 'add', key: bravo.key, from: 'inventory' });
  });

  it('fails same-endpoint name conflict and baseline deletion before mutation', async () => {
    const alpha = record('alpha.example.invalid', 9001, 'Alpha');
    const renamed = { ...alpha, name: 'Inventory alpha', alias: 'gmib-alpha' };
    expect(() => syncPlan([alpha], [renamed], { saved: [] })).toThrow(GmibInventoryError);
    expect(() => syncPlan([], [renamed], { saved: [alpha] })).toThrow(GmibInventoryError);

    const client = clientFor([alpha]);
    const writeFiles = vi.fn();
    await expect(
      runSync(client, [renamed], { saved: [] }, {
        output: '/tmp/unused-overlay.json',
        group: 'gmib',
        baseUrl: 'http://gmib.example.invalid:9002',
        writeFiles,
      }),
    ).rejects.toMatchObject({ code: 'sync_conflict' });
    expect(client.request).toHaveBeenCalledTimes(1);
    expect(writeFiles).not.toHaveBeenCalled();
  });

  it('keeps a GMIB rename stable until the editable inventory actually changes', () => {
    const alpha = record('alpha.example.invalid', 9001, 'Alpha');
    const renamedInGmib = { ...alpha, name: 'Bravo' };
    const renamedInInventory = { ...alpha, name: 'Charlie', alias: 'gmib-alpha' };
    const first = syncPlan([renamedInGmib], [{ ...alpha, alias: 'gmib-alpha' }], {
      saved: [alpha],
      inventoryObserved: [alpha],
    });
    expect(first.hosts).toEqual([renamedInGmib]);
    const repeatedGmib = syncPlan([renamedInGmib], [{ ...alpha, alias: 'gmib-alpha' }], {
      saved: [renamedInGmib],
      inventoryObserved: [alpha],
    });
    expect(repeatedGmib.hosts).toEqual([renamedInGmib]);
    const inventoryEdit = syncPlan([renamedInGmib], [renamedInInventory], {
      saved: [renamedInGmib],
      inventoryObserved: [alpha],
    });
    expect(inventoryEdit.hosts).toEqual([renamedInInventory]);
    expect(inventoryEdit.actions).toContainEqual({ kind: 'propagate', key: alpha.key, from: 'inventory' });
    const repeatedInventory = syncPlan([renamedInInventory], [renamedInInventory], {
      saved: [renamedInInventory],
      inventoryObserved: [renamedInInventory],
    });
    expect(repeatedInventory.hosts).toEqual([renamedInInventory]);
  });

  it('records the selected winner as an action', () => {
    const alpha = record('alpha.example.invalid', 9001, 'Alpha');
    const remote = { ...alpha, name: 'From GMIB' };
    const input = { ...alpha, name: 'From inventory' };
    const plan = syncPlan([remote], [input], { saved: [alpha], inventoryObserved: [alpha] }, { conflict: 'gmib-wins' });
    expect(plan.hosts).toEqual([remote]);
    expect(plan.actions).toContainEqual({ kind: 'resolve', key: alpha.key, from: 'gmib' });
  });

  it('reports stale revision and a post-PUT output failure without pretending retry is safe', async () => {
    const alpha = record('alpha.example.invalid', 9001, 'Alpha');
    const bravo = {
      key: 'bravo.example.invalid:9001',
      address: 'bravo.example.invalid',
      nibusPort: 9001,
      name: 'Bravo',
      alias: 'gmib-bravo',
    };
    const stale = clientFor([alpha], { stale: true });
    await expect(runImport(stale, [bravo])).rejects.toMatchObject({
      code: 'hosts_revision_stale',
      status: 412,
    });

    const client = clientFor([alpha]);
    await expect(
      runSync(client, [{ ...alpha, alias: 'gmib-alpha' }, bravo], { saved: [alpha], path: '/tmp/baseline.json' }, {
        output: '/tmp/overlay.json',
        group: 'gmib',
        baseUrl: 'http://gmib.example.invalid:9002',
        writeFiles: async () => {
          throw new Error('disk full');
        },
      }),
    ).rejects.toMatchObject({
      code: 'managed_file_partial',
      partial: true,
      savedApplied: true,
      revision: revisionFor('b'),
    });
    expect(client.saved()).toEqual(expect.arrayContaining([expect.objectContaining({ key: bravo.key })]));
  });

  it('uses the production management hosts service response before accepting a baseline', async () => {
    let saved = [{ address: 'SIGN.Example.', port: 9001, name: 'Alpha' }];
    const service = createManagementHostsService({
      getSavedHosts: () => saved,
      setSavedHosts: next => {
        saved = next;
      },
      getDiscoveredHosts: () => [],
    });
    const client = {
      request: vi.fn(async (requestPath: string, options: { method?: string; body?: any } = {}) => {
        if (requestPath === '/api/manage/v1/hosts' && !options.method) {
          return { data: await service.get(), status: 200 };
        }
        if (requestPath === '/api/manage/v1/hosts' && options.method === 'PUT') {
          return { data: service.put(options.body, false), status: 200 };
        }
        throw new Error(`Unexpected ${options.method ?? 'GET'} ${requestPath}`);
      }),
    };
    const beta = {
      key: 'beta.example.invalid:9100',
      address: 'beta.example.invalid',
      nibusPort: 9100,
      name: 'Beta',
      alias: 'gmib-beta',
    };
    await expect(runImport(client, [beta])).resolves.toMatchObject({
      changed: true,
      revision: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    });
    await expect(service.get()).resolves.toMatchObject({
      saved: expect.arrayContaining([
        expect.objectContaining({ key: 'sign.example:9001', apiPort: 9002 }),
        expect.objectContaining({ key: 'beta.example.invalid:9100', apiPort: 9101 }),
      ]),
    });
  });

  it('recovers a real interrupted overlay write and permits the verified overlay as an input source', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'gmib-inventory-journal-'));
    const output = path.join(directory, 'overlay.json');
    const marker = `${output}.gmib-managed.json`;
    const baseUrl = 'http://gmib.example.invalid:9002';
    const alpha = record('alpha.example.invalid', 9001, 'Alpha');
    const overlay = overlayFor([alpha]);
    await mkdir(marker);
    try {
      await expect(
        writeManagedFiles({
          output,
          overlay,
          baseUrl,
          group: 'gmib',
          savedApplied: true,
          revision: revisionFor('a'),
        }),
      ).rejects.toMatchObject({ code: 'managed_file_partial', partial: true });
      await rm(marker, { recursive: true, force: true });
      const recovered = await prepareMutationPaths({
        output,
        source: [output],
        baseUrl,
        group: 'gmib',
      });
      expect(recovered.outputState.journal).toBeDefined();
      await writeManagedFiles({
        output,
        overlay,
        baseUrl,
        group: 'gmib',
        savedApplied: true,
        revision: revisionFor('a'),
        journal: recovered.outputState.journal,
      });
      expect(await readFile(output, 'utf8')).toContain('gmib_address');
      await expect(
        prepareMutationPaths({ output, source: [output], baseUrl, group: 'gmib' }),
      ).resolves.toMatchObject({ output });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects an incompatible journal before mutating saved hosts', async () => {
    const alpha = record('alpha.example.invalid', 9001, 'Alpha');
    const bravo = { ...record('bravo.example.invalid', 9001, 'Bravo'), alias: 'gmib-bravo' };
    const client = clientFor([alpha]);
    await expect(
      runSync(client, [{ ...alpha, alias: 'gmib-alpha' }, bravo], { saved: [alpha], path: '/tmp/baseline.json' }, {
        output: '/tmp/overlay.json',
        group: 'gmib',
        baseUrl: 'http://gmib.example.invalid:9002',
        journal: { kind: 'different' },
      }),
    ).rejects.toMatchObject({ code: 'invalid_output_journal' });
    expect(client.request).toHaveBeenCalledTimes(1);
  });
});

describe.runIf(ansibleAvailable)('managed overlay is a standard Ansible inventory source', () => {
  it('combines with an SSH inventory without replacing its host vars or other groups', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'gmib-inventory-overlay-'));
    try {
      const original = path.join(directory, 'original.yml');
      const overlay = path.join(directory, 'gmib-overlay.json');
      await writeFile(
        original,
        `all:\n  children:\n    gmib:\n      hosts:\n        sign-a:\n          ansible_host: ssh.example.invalid\n          ansible_user: fixture-user\n          gmib_address: gmib.example.invalid\n          gmib_nibus_port: 9001\n          gmib_saved_name: Editable old name\n    othergroup:\n      hosts:\n        other-a:\n          ansible_host: other.example.invalid\n`,
      );
      await writeFile(
        overlay,
        `${JSON.stringify(overlayFor([record('gmib.example.invalid', 9001, 'Remote current name')], 'gmib', new Map([['gmib.example.invalid:9001', 'sign-a']])), null, 2)}\n`,
      );
      const stdout = execFileSync('ansible-inventory', ['--list', '-i', overlay, '-i', original], {
        encoding: 'utf8',
      });
      const result = JSON.parse(stdout);
      expect(result._meta.hostvars['sign-a']).toMatchObject({
        ansible_host: 'ssh.example.invalid',
        ansible_user: 'fixture-user',
        gmib_address: 'gmib.example.invalid',
        gmib_nibus_port: 9001,
        gmib_saved_name: 'Editable old name',
      });
      expect(result._meta.hostvars['other-a']).toMatchObject({ ansible_host: 'other.example.invalid' });
      expect(result._meta.hostvars['sign-a']).not.toHaveProperty('ansible_connection');
      const operational = JSON.parse(
        execFileSync('ansible-inventory', ['--list', '-i', original, '-i', overlay], {
          encoding: 'utf8',
        }),
      );
      expect(operational._meta.hostvars['sign-a']).toMatchObject({
        ansible_host: 'ssh.example.invalid',
        ansible_user: 'fixture-user',
        gmib_saved_name: 'Remote current name',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
