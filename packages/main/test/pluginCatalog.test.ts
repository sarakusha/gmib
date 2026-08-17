import { createHash } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '/tmp') } }));
const pluginHostMocks = vi.hoisted(() => ({
  installPluginFromArchive: vi.fn(async () => ({ status: 'cancelled' as const })),
  listPlugins: vi.fn(async () => []),
}));
vi.mock('../src/pluginHost', () => ({
  installPluginFromArchive: pluginHostMocks.installPluginFromArchive,
  listPlugins: pluginHostMocks.listPlugins,
}));

import {
  installOfficialPlugin,
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

describe('installOfficialPlugin', () => {
  beforeEach(() => {
    pluginHostMocks.installPluginFromArchive.mockClear();
    pluginHostMocks.listPlugins.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includes the catalog URL in network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('fetch failed')));

    await expect(listOfficialPlugins()).rejects.toThrow(OFFICIAL_PLUGIN_CATALOG_URL);
  });

  it('includes the release URL in download errors', async () => {
    const entry = catalogEntry('unavailable');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(catalog(entry))))
        .mockRejectedValueOnce(new Error('fetch failed')),
    );

    await expect(installOfficialPlugin('unavailable')).rejects.toThrow(entry.release.url);
  });

  it('verifies a downloaded archive before passing it to the installer', async () => {
    const archive = Buffer.from('verified plugin archive');
    const entry = catalogEntry('verified');
    entry.release.sha256 = createHash('sha256').update(archive).digest('hex');
    entry.release.size = archive.byteLength;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(catalog(entry))))
      .mockResolvedValueOnce(new Response(archive));
    vi.stubGlobal('fetch', fetchMock);

    await expect(installOfficialPlugin('verified')).resolves.toEqual({ status: 'cancelled' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pluginHostMocks.installPluginFromArchive).toHaveBeenCalledWith(
      expect.stringMatching(/verified\.gmib-plugin$/),
      expect.objectContaining({ id: 'verified', version: '1.0.0' }),
    );
  });

  it('rejects a downloaded archive with another SHA-256', async () => {
    const entry = catalogEntry('corrupted');
    entry.release.size = 9;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(catalog(entry))))
        .mockResolvedValueOnce(new Response('corrupted')),
    );

    await expect(installOfficialPlugin('corrupted')).rejects.toThrow(/SHA-256/);
    expect(pluginHostMocks.installPluginFromArchive).not.toHaveBeenCalled();
  });
});
