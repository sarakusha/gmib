import { execFile, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import { startManagementAnsibleFixture } from './fixtures/managementAnsibleFixture';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '../../..');
const playbook =
  process.env.GMIB_ANSIBLE_TEST_PLAYBOOK ?? path.join(repoRoot, 'examples/ansible/gmib.yml');
const ansible = process.env.ANSIBLE_PLAYBOOK ?? 'ansible-playbook';
const ansibleAvailable = spawnSync(ansible, ['--version'], { stdio: 'ignore' }).status === 0;
const temporaryPaths: string[] = [];
const closeFixtures: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closeFixtures.splice(0).map(close => close()));
  await Promise.all(temporaryPaths.splice(0).map(directory => rm(directory, { recursive: true })));
});

const desired = (baseUrl: string) => ({
  gmib_api_url: baseUrl,
  gmib_client_id: 'ansible-integration',
  gmib_relaunch_when_required: true,
  gmib_plugins: [
    {
      id: 'example-plugin',
      state: 'present',
      enabled: true,
      official: {
        version: '1.0.0',
        sha256: 'a'.repeat(64),
        permissions: ['storage', 'http.routes'],
        trustedBackend: true,
      },
    },
  ],
  gmib_linked_resources: {
    playlist: { name: 'Main playlist', flags: 0, items: [] },
    player: { name: 'Main player', autoPlay: true },
    mapping: { name: 'Main mapping', left: 0, top: 0, width: 1920 },
    scheduler: {
      id: 'morning-player',
      kind: 'cron',
      name: 'Morning player',
      enabled: true,
      priority: 10,
      action: 'play',
      cron: {
        minutes: { mode: 'select', every: 1, selected: [0] },
        hours: { mode: 'select', every: 1, selected: [8] },
        days: { mode: 'all', selected: [] },
        months: { mode: 'all', selected: [] },
        weekdays: { mode: 'all', selected: [] },
      },
    },
  },
  gmib_resources: [
    { type: 'screen', desired: { name: 'Main screen', left: 0, top: 0, width: 1920 } },
    {
      type: 'gmib-scheduler',
      desired: {
        id: 'evening-brightness',
        kind: 'cron',
        name: 'Evening brightness',
        enabled: true,
        priority: 10,
        action: 'set-brightness',
        brightness: 35,
        cron: {
          minutes: { mode: 'select', every: 1, selected: [0] },
          hours: { mode: 'select', every: 1, selected: [20] },
          days: { mode: 'all', selected: [] },
          months: { mode: 'all', selected: [] },
          weekdays: { mode: 'all', selected: [] },
        },
      },
    },
  ],
  gmib_settings: { brightness: 70, autobrightness: false },
  gmib_plugin_settings: [
    {
      path: '/api/plugins/example-plugin/settings',
      response_key: 'settings',
      desired: { scene: 'plasma', speed: 1.25 },
    },
  ],
});

const runPlaybook = async (
  variables: Record<string, unknown>,
  options: { check?: boolean; password?: string } = {},
) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gmib-ansible-test-'));
  temporaryPaths.push(directory);
  const varsFile = path.join(directory, 'vars.json');
  await writeFile(varsFile, JSON.stringify(variables));
  // Keep real SSH inventory metadata: all API helper commands must still run on the controller.
  const inventoryFile = path.join(directory, 'inventory.json');
  await writeFile(
    inventoryFile,
    JSON.stringify({
      all: {
        children: {
          gmib: {
            hosts: {
              'fixture-device': {
                ansible_connection: 'ssh',
                ansible_host: '192.0.2.1',
                ansible_port: 1,
              },
            },
          },
        },
      },
    }),
  );
  const args = ['-i', inventoryFile, playbook, '--extra-vars', `@${varsFile}`];
  if (options.check) args.push('--check');
  try {
    return await execFileAsync(ansible, args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        ANSIBLE_LOCAL_TEMP: path.join(directory, 'local'),
        ANSIBLE_REMOTE_TEMP: path.join(directory, 'remote'),
        GMIB_PASSWORD: options.password ?? 'fixture-password',
      },
      maxBuffer: 2 * 1024 * 1024,
      timeout: 120_000,
    });
  } catch (error) {
    if (error instanceof Error && 'stdout' in error && typeof error.stdout === 'string') {
      error.message = `${error.message}\n${error.stdout}`;
    }
    throw error;
  }
};

describe.runIf(ansibleAvailable)('GMIB Ansible example', () => {
  it('is idempotent, predicts drift without writes, and safely retries a partial failure', async () => {
    const fixture = await startManagementAnsibleFixture();
    closeFixtures.push(fixture.close);
    const variables = desired(fixture.baseUrl);

    const freshCheckVariables = {
      ...variables,
      gmib_plugins: [],
      gmib_resources: [],
      gmib_settings: {},
      gmib_plugin_settings: [],
      gmib_relaunch_when_required: false,
    };
    const freshState = fixture.snapshot();
    const freshCheck = await runPlaybook(freshCheckVariables, { check: true });
    expect(freshCheck.stdout).toMatch(/changed=[1-9]/);
    expect(fixture.snapshot()).toEqual(freshState);
    expect(fixture.resources.player).toHaveLength(0);

    fixture.failRelaunchOnce();
    await expect(runPlaybook(variables)).rejects.toMatchObject({ code: expect.any(Number) });
    expect(fixture.mutationCountFor('plugin:install')).toBe(1);
    expect(fixture.snapshot().runningPlugin).toBeUndefined();

    fixture.failOnce('player');
    const partialFailure = await runPlaybook(variables).then(
      () => undefined,
      error => error as Error,
    );
    expect(partialFailure).toMatchObject({ code: expect.any(Number) });
    expect(fixture.resources.screen).toHaveLength(0);
    expect(fixture.resources.playlist).toHaveLength(1);
    expect(fixture.mutationCountFor('plugin:install')).toBe(1);

    const retry = await runPlaybook(variables);
    expect(retry.stdout).toMatch(/failed=0/);
    expect(fixture.resources.screen).toHaveLength(1);
    expect(fixture.resources.playlist).toHaveLength(1);
    expect(fixture.resources.player).toHaveLength(1);

    const mutationsAfterApply = fixture.mutationCount();
    const repeat = await runPlaybook(variables);
    expect(repeat.stdout).toMatch(/changed=0/);
    expect(fixture.mutationCount()).toBe(mutationsAfterApply);

    fixture.drift();
    const beforeCheck = fixture.snapshot();
    const check = await runPlaybook(variables, { check: true });
    expect(check.stdout).toMatch(/changed=[1-9]/);
    expect(fixture.snapshot()).toEqual(beforeCheck);

    const repair = await runPlaybook(variables);
    expect(repair.stdout).toMatch(/failed=0/);
    expect(fixture.snapshot().settings).toMatchObject({ brightness: 70 });
    expect(fixture.snapshot().pluginSettings).toMatchObject({ speed: 1.25 });

    const absentVariables = {
      ...variables,
      gmib_linked_resources: {},
      gmib_resources: [],
      gmib_settings: {},
      gmib_plugin_settings: [],
      gmib_plugins: [{ id: 'example-plugin', state: 'absent' }],
      gmib_relaunch_when_required: false,
    };
    await runPlaybook(absentVariables);
    expect(fixture.mutationCountFor('plugin:delete')).toBe(1);
    expect(fixture.snapshot().runningPlugin).toBeDefined();

    const absentRetry = await runPlaybook({
      ...absentVariables,
      gmib_relaunch_when_required: true,
    });
    expect(absentRetry.stdout).toMatch(/failed=0/);
    expect(fixture.snapshot().runningPlugin).toBeUndefined();
    const absentRepeat = await runPlaybook({
      ...absentVariables,
      gmib_relaunch_when_required: true,
    });
    expect(absentRepeat.stdout).toMatch(/changed=0/);

    await expect(runPlaybook(variables, { password: 'wrong-password' })).rejects.toMatchObject({
      code: expect.any(Number),
    });
    fixture.setLicensed(false);
    await expect(runPlaybook(variables)).rejects.toMatchObject({ code: expect.any(Number) });
  }, 180_000);
});
