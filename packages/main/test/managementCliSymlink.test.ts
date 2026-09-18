import { execFile } from 'node:child_process';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '../../..');
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })),
  );
});

describe('management CLI entrypoints through a checkout symlink', () => {
  it.each([
    ['gmib-api.mjs', 'gmib-api.mjs'],
    ['gmib-api-resources.mjs', 'gmib-api-resources.mjs'],
    ['gmib-api-inventory.mjs', 'gmib-api-inventory.mjs'],
  ])('runs %s instead of silently importing it', async (script, usageName) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'gmib-cli-symlink-'));
    directories.push(directory);
    const checkout = path.join(directory, 'gmib');
    await symlink(repoRoot, checkout, 'dir');

    const { stderr, stdout } = await execFileAsync(
      process.execPath,
      [path.join(checkout, 'scripts', script), '--help'],
      { timeout: 10_000 },
    );

    expect(stderr).toBe('');
    expect(stdout).toContain('Usage:');
    expect(stdout).toContain(usageName);
  });
});
