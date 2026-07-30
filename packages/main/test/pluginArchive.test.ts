import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import AdmZip from 'adm-zip';
import { afterEach, describe, expect, it } from 'vitest';

import { extractPluginArchive } from '../src/pluginArchive';

const temporaryDirectories: string[] = [];

const temporaryDirectory = async (): Promise<string> => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gmib-plugin-test-'));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(directory => fs.promises.rm(directory, { recursive: true, force: true })),
  );
});

describe('extractPluginArchive', () => {
  it('extracts and validates a plugin archive', async () => {
    const root = await temporaryDirectory();
    const archivePath = path.join(root, 'parking.gmib-plugin');
    const zip = new AdmZip();
    zip.addFile(
      'manifest.json',
      Buffer.from(
        JSON.stringify({
          id: 'parking',
          name: 'Parking',
          version: '1.0.0',
          gmibApi: '^1.0.0',
          public: 'public',
          permissions: ['output.pages'],
          pages: [{ id: 'screen', title: 'Parking', path: 'screen.html' }],
        }),
      ),
    );
    zip.addFile('public/screen.html', Buffer.from('<!doctype html>'));
    zip.writeZip(archivePath);

    const destination = path.join(root, 'extracted');
    await expect(extractPluginArchive(archivePath, destination)).resolves.toMatchObject({
      id: 'parking',
    });
    await expect(
      fs.promises.readFile(path.join(destination, 'public/screen.html'), 'utf8'),
    ).resolves.toContain('doctype');
  });

  it('requires manifest.json at archive root', async () => {
    const root = await temporaryDirectory();
    const archivePath = path.join(root, 'wrapped.gmib-plugin');
    const zip = new AdmZip();
    zip.addFile('wrapped/manifest.json', Buffer.from('{}'));
    zip.writeZip(archivePath);

    await expect(extractPluginArchive(archivePath, path.join(root, 'extracted'))).rejects.toThrow(
      /manifest\.json/,
    );
  });

  it('rejects entries outside the plugin directory', async () => {
    const root = await temporaryDirectory();
    const archivePath = path.join(root, 'unsafe.gmib-plugin');
    const zip = new AdmZip();
    zip.addFile('outside.txt', Buffer.from('unsafe'));
    zip.getEntries()[0].entryName = '../outside.txt';
    zip.addFile(
      'manifest.json',
      Buffer.from(
        JSON.stringify({
          id: 'unsafe',
          name: 'Unsafe',
          version: '1.0.0',
          gmibApi: '^1.0.0',
        }),
      ),
    );
    zip.writeZip(archivePath);

    await expect(extractPluginArchive(archivePath, path.join(root, 'extracted'))).rejects.toThrow(
      /недопустимый путь/,
    );
  });
});
