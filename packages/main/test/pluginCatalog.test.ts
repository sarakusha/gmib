import { createHash } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  downloadOfficialPluginArchive,
  listOfficialPlugins,
  OFFICIAL_PLUGIN_CATALOG_URL,
  parsePluginCatalog,
} from '../src/pluginCatalog';

const catalogEntry = (id: string, gmibApi = '^1.0.0') => ({
  manifest: {
    id,
    name: id,
    version: '1.0.0',
    gmibApi,
  },
  publisher: {
    id: 'sarakusha',
    name: 'gmib official',
    verified: true,
  },
  repository: 'https://github.com/sarakusha/gmib-plugins',
  release: {
    url: `https://github.com/sarakusha/gmib-plugins/releases/download/${id}-v1.0.0/${id}.gmib-plugin`,
    sha256: 'a'.repeat(64),
    size: 1024,
  },
});

const catalog = (...plugins: ReturnType<typeof catalogEntry>[]) => ({
  schemaVersion: 1,
  generatedAt: '2026-08-05T00:00:00.000Z',
  source: 'https://github.com/sarakusha/gmib-plugins',
  plugins,
});

describe('parsePluginCatalog', () => {
  it('accepts and sorts compatible official plugins', () => {
    expect(parsePluginCatalog(catalog(catalogEntry('zeta'), catalogEntry('alpha')))).toEqual([
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'alpha' }) }),
      expect.objectContaining({ manifest: expect.objectContaining({ id: 'zeta' }) }),
    ]);
  });

  it('omits plugins requiring another Plugin API version', () => {
    expect(parsePluginCatalog(catalog(catalogEntry('future', '^2.0.0')))).toEqual([]);
  });

  it('rejects duplicate plugin identifiers', () => {
    expect(() => parsePluginCatalog(catalog(catalogEntry('same'), catalogEntry('same')))).toThrow(
      /повторяет/,
    );
  });

  it('rejects invalid hashes and non-HTTPS links', () => {
    const invalidHash = catalogEntry('invalid-hash');
    invalidHash.release.sha256 = 'nope';
    expect(() => parsePluginCatalog(catalog(invalidHash))).toThrow(/SHA-256/);

    const insecure = catalogEntry('insecure');
    insecure.release.url = 'http://example.com/plugin.gmib-plugin';
    expect(() => parsePluginCatalog(catalog(insecure))).toThrow(/HTTPS/);
  });

  it('rejects downloads outside the official repository', () => {
    const external = catalogEntry('external');
    external.release.url =
      'https://example.com/sarakusha/gmib-plugins/releases/download/external-v1.0.0/external.gmib-plugin';
    expect(() => parsePluginCatalog(catalog(external))).toThrow(/официального проекта/);
  });
});

describe('downloadOfficialPluginArchive', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includes the catalog URL in network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('fetch failed')));

    await expect(listOfficialPlugins()).rejects.toThrow(OFFICIAL_PLUGIN_CATALOG_URL);
  });

  it('includes the release URL in download errors', async () => {
    const entry = catalogEntry('unavailable');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('fetch failed')));

    await expect(downloadOfficialPluginArchive(entry)).rejects.toThrow(entry.release.url);
  });

  it('returns an archive only after verifying its size and SHA-256', async () => {
    const archive = Buffer.from('verified plugin archive');
    const entry = catalogEntry('verified');
    entry.release.sha256 = createHash('sha256').update(archive).digest('hex');
    entry.release.size = archive.byteLength;
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(archive));
    vi.stubGlobal('fetch', fetchMock);

    await expect(downloadOfficialPluginArchive(entry)).resolves.toEqual(archive);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a downloaded archive with another SHA-256', async () => {
    const entry = catalogEntry('corrupted');
    entry.release.size = 9;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('corrupted')));

    await expect(downloadOfficialPluginArchive(entry)).rejects.toThrow(/SHA-256/);
  });
});
