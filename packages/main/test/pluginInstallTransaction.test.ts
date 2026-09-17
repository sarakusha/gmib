import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  commitPluginInstall,
  commitPluginRemoval,
  commitRegistryUpdate,
} from '../src/pluginInstallTransaction';

const roots: string[] = [];
const temporaryRoot = async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gmib-plugin-transaction-'));
  roots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(root => fs.promises.rm(root, { recursive: true, force: true })),
  );
});

describe('plugin filesystem transactions', () => {
  it('restores in-memory enabled state when registry persistence fails', async () => {
    let registry = { disabled: ['sample'] };
    const previous = registry;
    await expect(
      commitRegistryUpdate(
        previous,
        { disabled: [] },
        value => {
          registry = value;
        },
        async () => {
          throw new Error('registry failed');
        },
      ),
    ).rejects.toThrow('registry failed');
    expect(registry).toBe(previous);
  });

  it('restores the previous installation when registry persistence fails', async () => {
    const root = await temporaryRoot();
    const target = path.join(root, 'sample');
    const staging = path.join(root, 'staging');
    const backup = path.join(root, 'backup');
    await fs.promises.mkdir(target);
    await fs.promises.writeFile(path.join(target, 'version'), 'old');
    await fs.promises.mkdir(staging);
    await fs.promises.writeFile(path.join(staging, 'version'), 'new');

    await expect(
      commitPluginInstall({
        backup,
        persist: async () => {
          throw new Error('registry failed');
        },
        staging,
        target,
        targetExists: true,
      }),
    ).rejects.toThrow('registry failed');
    await expect(fs.promises.readFile(path.join(target, 'version'), 'utf8')).resolves.toBe('old');
    await expect(fs.promises.stat(backup)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('restores an installation when uninstall persistence fails', async () => {
    const root = await temporaryRoot();
    const target = path.join(root, 'sample');
    const backup = path.join(root, 'backup');
    await fs.promises.mkdir(target);
    await fs.promises.writeFile(path.join(target, 'version'), 'old');

    await expect(
      commitPluginRemoval(target, backup, async () => {
        throw new Error('registry failed');
      }),
    ).rejects.toThrow('registry failed');
    await expect(fs.promises.readFile(path.join(target, 'version'), 'utf8')).resolves.toBe('old');
  });
});
