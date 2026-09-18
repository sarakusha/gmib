import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CustomHost } from '/@common/helpers';

import { GmibApiClient } from '../../../scripts/gmib-api-client.mjs';
import { main } from '../../../scripts/gmib-api-inventory.mjs';
import { createManagementHostsService } from '../src/managementHosts';

const PASSWORD_ENV = 'GMIB_INVENTORY_CLI_TEST_PASSWORD';
const BASE_URL = 'http://gmib.example.invalid:9002';
const originalAnsibleTemp = process.env.ANSIBLE_LOCAL_TEMP;
const ansibleTemp = mkdtempSync(path.join(os.tmpdir(), 'gmib-ansible-cli-'));
const ansibleAvailable =
  spawnSync('ansible-inventory', ['--version'], {
    env: { ...process.env, ANSIBLE_LOCAL_TEMP: ansibleTemp },
    stdio: 'ignore',
  }).status === 0;

const directories: string[] = [];
let outputLines: string[];
let stdoutSpy: ReturnType<typeof vi.spyOn>;

const inventory = (name: string) => ({
  _meta: {
    hostvars: {
      'sign-a': {
        ansible_host: '192.0.2.20',
        ansible_user: 'automation',
        ansible_password: 'inventory-secret-must-stay-local',
        gmib_address: 'sign-a.example.invalid',
        gmib_nibus_port: 9001,
        gmib_saved_name: name,
      },
      'ssh-only': {
        ansible_host: '192.0.2.30',
        ansible_user: 'other-user',
        ansible_password: 'other-secret-must-stay-local',
      },
    },
  },
  all: { children: ['gmib', 'othergroup'] },
  gmib: { hosts: ['sign-a'] },
  othergroup: { hosts: ['ssh-only'] },
});

const staticInventory = (name: string) => ({
  all: {
    children: {
      gmib: {
        hosts: {
          'sign-a': {
            ansible_host: '192.0.2.20',
            ansible_user: 'automation',
            ansible_password: 'inventory-secret-must-stay-local',
            gmib_address: 'sign-a.example.invalid',
            gmib_nibus_port: 9001,
            gmib_saved_name: name,
          },
        },
      },
      othergroup: {
        hosts: {
          'ssh-only': {
            ansible_host: '192.0.2.30',
            ansible_user: 'other-user',
            ansible_password: 'other-secret-must-stay-local',
          },
        },
      },
    },
  },
});

const createRuntime = () => {
  let stored: CustomHost[] = [];
  let writes = 0;
  const service = createManagementHostsService({
    getSavedHosts: () => stored,
    setSavedHosts: hosts => {
      stored = structuredClone(hosts);
      writes += 1;
    },
    getDiscoveredHosts: () => [],
  });
  const request = vi
    .spyOn(GmibApiClient.prototype, 'request')
    .mockImplementation(
      async (requestPath: string, options: { body?: unknown; method?: string } = {}) => {
        if (requestPath === '/api/manage/v1/hosts' && options.method !== 'PUT') {
          return { data: await service.get(), serverId: 'fixture-server', status: 200 };
        }
        if (
          options.method === 'PUT' &&
          ['/api/manage/v1/hosts', '/api/manage/v1/hosts?dryRun=true'].includes(requestPath)
        ) {
          return {
            data: service.put(options.body, requestPath.endsWith('?dryRun=true')),
            serverId: 'fixture-server',
            status: 200,
          };
        }
        throw new Error(`Unexpected request: ${options.method ?? 'GET'} ${requestPath}`);
      },
    );
  const setDirect = async (hosts: Array<{ address: string; nibusPort: number; name?: string }>) => {
    const snapshot = await service.get();
    service.put({ revision: snapshot.revision, hosts });
  };
  return {
    request,
    service,
    setDirect,
    stored: () => structuredClone(stored),
    writes: () => writes,
  };
};

const runMain = async (argv: string[]): Promise<Record<string, unknown>> => {
  outputLines = [];
  await main([
    ...argv,
    '--base-url',
    BASE_URL,
    '--client-id',
    'inventory-cli-test',
    '--password-env',
    PASSWORD_ENV,
  ]);
  expect(outputLines).toHaveLength(1);
  return JSON.parse(outputLines[0]) as Record<string, unknown>;
};

const tempPaths = async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'gmib-inventory-cli-'));
  directories.push(directory);
  return {
    directory,
    baseline: path.join(directory, 'baseline.json'),
    input: path.join(directory, 'original.json'),
    output: path.join(directory, 'gmib-managed.json'),
  };
};

const syncArgs = (
  { baseline, input, output }: Awaited<ReturnType<typeof tempPaths>>,
  mode: '--apply' | '--check',
  includeManagedOutput = false,
) => [
  'sync',
  ...(includeManagedOutput ? ['--inventory', output] : []),
  '--inventory',
  input,
  '--output',
  output,
  '--baseline',
  baseline,
  mode,
];

const directorySnapshot = async (directory: string): Promise<Record<string, string>> => {
  const entries = await readdir(directory);
  return Object.fromEntries(
    await Promise.all(
      entries
        .sort()
        .map(async filename => [filename, await readFile(path.join(directory, filename), 'utf8')]),
    ),
  );
};

const readOverlayHosts = async (output: string) => {
  const parsed = JSON.parse(await readFile(output, 'utf8')) as {
    all: { children: { gmib: { hosts: Record<string, Record<string, unknown>> } } };
  };
  return parsed.all.children.gmib.hosts;
};

beforeEach(() => {
  process.env[PASSWORD_ENV] = 'fixture-password';
  process.env.ANSIBLE_LOCAL_TEMP = ansibleTemp;
  outputLines = [];
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(chunk => {
    outputLines.push(String(chunk).trim());
    return true;
  });
});

afterEach(async () => {
  stdoutSpy.mockRestore();
  vi.restoreAllMocks();
  delete process.env[PASSWORD_ENV];
  if (originalAnsibleTemp === undefined) delete process.env.ANSIBLE_LOCAL_TEMP;
  else process.env.ANSIBLE_LOCAL_TEMP = originalAnsibleTemp;
  await Promise.all(
    directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })),
  );
});

afterAll(async () => {
  await rm(ansibleTemp, { recursive: true, force: true });
});

describe('GMIB inventory CLI against the management hosts service', () => {
  it('applies a JSON inventory and keeps check mode free of remote and file writes', async () => {
    const paths = await tempPaths();
    const runtime = createRuntime();
    await writeFile(paths.input, `${JSON.stringify(inventory('Source A'), null, 2)}\n`);
    const jsonArgs = [
      'sync',
      '--inventory-json',
      paths.input,
      '--output',
      paths.output,
      '--baseline',
      paths.baseline,
    ];

    await expect(runMain([...jsonArgs, '--apply'])).resolves.toMatchObject({
      ok: true,
      changed: true,
    });
    expect(runtime.stored()).toEqual([
      { address: 'sign-a.example.invalid', port: 9001, name: 'Source A' },
    ]);
    await expect(runMain([...jsonArgs, '--apply'])).resolves.toMatchObject({
      ok: true,
      changed: false,
    });

    await writeFile(paths.input, `${JSON.stringify(inventory('Source B'), null, 2)}\n`);
    const filesBefore = await directorySnapshot(paths.directory);
    const writesBefore = runtime.writes();
    await expect(runMain([...jsonArgs, '--check'])).resolves.toMatchObject({
      ok: true,
      changed: true,
      checkMode: true,
    });
    expect(runtime.writes()).toBe(writesBefore);
    expect(runtime.stored()).toEqual([
      { address: 'sign-a.example.invalid', port: 9001, name: 'Source A' },
    ]);
    expect(await directorySnapshot(paths.directory)).toEqual(filesBefore);
  });

  it.runIf(ansibleAvailable)(
    'round-trips source and GMIB changes without oscillation when managed output is the first source',
    async () => {
      const paths = await tempPaths();
      const runtime = createRuntime();
      await writeFile(paths.input, `${JSON.stringify(staticInventory('Source A'), null, 2)}\n`);

      await expect(runMain(syncArgs(paths, '--apply'))).resolves.toMatchObject({
        ok: true,
        changed: true,
      });
      expect(runtime.stored()).toEqual([
        { address: 'sign-a.example.invalid', port: 9001, name: 'Source A' },
      ]);
      expect(await readFile(paths.baseline, 'utf8')).toContain('Source A');
      expect(await readOverlayHosts(paths.output)).toMatchObject({
        'sign-a': { gmib_saved_name: 'Source A' },
      });

      const repeat = () => runMain(syncArgs(paths, '--apply', true));
      await expect(repeat()).resolves.toMatchObject({ ok: true, changed: false });
      await expect(repeat()).resolves.toMatchObject({ ok: true, changed: false });

      const combined = JSON.parse(
        execFileSync('ansible-inventory', ['--list', '-i', paths.output, '-i', paths.input], {
          encoding: 'utf8',
        }),
      ) as { _meta: { hostvars: Record<string, Record<string, unknown>> } };
      expect(combined._meta.hostvars['sign-a']).toMatchObject({
        ansible_host: '192.0.2.20',
        ansible_user: 'automation',
        ansible_password: 'inventory-secret-must-stay-local',
        gmib_address: 'sign-a.example.invalid',
      });
      expect(combined._meta.hostvars['ssh-only']).toMatchObject({
        ansible_host: '192.0.2.30',
        ansible_user: 'other-user',
        ansible_password: 'other-secret-must-stay-local',
      });

      await writeFile(paths.input, `${JSON.stringify(staticInventory('Source B'), null, 2)}\n`);
      await expect(repeat()).resolves.toMatchObject({ ok: true, changed: true });
      expect(runtime.stored()[0]?.name).toBe('Source B');
      await expect(repeat()).resolves.toMatchObject({ ok: true, changed: false });
      await expect(repeat()).resolves.toMatchObject({ ok: true, changed: false });
      expect(runtime.stored()[0]?.name).toBe('Source B');

      await runtime.setDirect([
        { address: 'sign-a.example.invalid', nibusPort: 9001, name: 'Remote C' },
      ]);
      await expect(repeat()).resolves.toMatchObject({ ok: true, changed: true });
      expect((await readOverlayHosts(paths.output))['sign-a']).toMatchObject({
        gmib_saved_name: 'Remote C',
      });
      await expect(repeat()).resolves.toMatchObject({ ok: true, changed: false });
      await expect(repeat()).resolves.toMatchObject({ ok: true, changed: false });
      expect(runtime.stored()[0]?.name).toBe('Remote C');

      await runtime.setDirect([
        { address: 'sign-a.example.invalid', nibusPort: 9001, name: 'Remote C' },
        { address: 'remote-added.example.invalid', nibusPort: 9100, name: 'Remote D' },
      ]);
      await expect(repeat()).resolves.toMatchObject({ ok: true, changed: true });
      const firstAdditionRepeat = await repeat();
      expect(firstAdditionRepeat, JSON.stringify(firstAdditionRepeat)).toMatchObject({
        ok: true,
        changed: false,
      });
      await expect(repeat()).resolves.toMatchObject({ ok: true, changed: false });
      expect(runtime.stored()).toEqual([
        { address: 'sign-a.example.invalid', port: 9001, name: 'Remote C' },
        { address: 'remote-added.example.invalid', port: 9100, name: 'Remote D' },
      ]);
      expect(JSON.stringify(await readOverlayHosts(paths.output))).toContain('Remote D');

      await writeFile(paths.input, `${JSON.stringify(staticInventory('Check E'), null, 2)}\n`);
      const filesBefore = await directorySnapshot(paths.directory);
      const savedBefore = runtime.stored();
      const writesBefore = runtime.writes();
      await expect(runMain(syncArgs(paths, '--check', true))).resolves.toMatchObject({
        ok: true,
        changed: true,
        checkMode: true,
      });
      expect(runtime.writes()).toBe(writesBefore);
      expect(runtime.stored()).toEqual(savedBefore);
      expect(await directorySnapshot(paths.directory)).toEqual(filesBefore);
    },
  );
});
