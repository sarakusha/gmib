import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { app } from 'electron';
import { nanoid } from 'nanoid';

import type {
  PluginArchiveInspection,
  PluginCatalogEntry,
  PluginInstallConsent,
  PluginLifecycleInstallResult,
  PluginLifecycleUninstallResult,
  PluginStatus,
} from '/@common/plugins';

import { downloadOfficialPluginArchive, listOfficialPlugins } from './pluginCatalog';
import {
  inspectPluginArchive,
  installPluginFromArchive,
  isPluginRunning,
  listPlugins,
  setPluginEnabled,
  uninstallPlugin,
} from './pluginHost';

export class PluginLifecycleError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

type PluginLifecycleDependencies = {
  catalog: () => Promise<PluginCatalogEntry[]>;
  downloadOfficial: (entry: PluginCatalogEntry) => Promise<Buffer>;
  inspectArchive: (
    archivePath: string,
    expectedManifest?: PluginCatalogEntry['manifest'],
  ) => Promise<PluginArchiveInspection>;
  installArchive: typeof installPluginFromArchive;
  isRunning: (id: string) => boolean;
  list: () => Promise<PluginStatus[]>;
  setEnabled: typeof setPluginEnabled;
  temporaryDirectory: () => Promise<string>;
  uninstall: typeof uninstallPlugin;
};

export type OfficialPluginPin = { id: string; sha256: string; version: string };

const exactConsent = (inspection: PluginArchiveInspection, consent: PluginInstallConsent): void => {
  const expected = [...(inspection.manifest.permissions ?? [])].sort();
  const accepted = [...consent.permissions].sort();
  if (!isDeepStrictEqual(accepted, expected)) {
    throw new PluginLifecycleError(
      'permissions_not_accepted',
      'Нужно явно принять точный список разрешений плагина',
      409,
    );
  }
  if (consent.trustedBackend !== Boolean(inspection.manifest.main)) {
    throw new PluginLifecycleError(
      'trusted_backend_not_accepted',
      'Нужно явно подтвердить наличие или отсутствие доверенного backend-кода',
      409,
    );
  }
};

const officialEntry = async (
  catalog: () => Promise<PluginCatalogEntry[]>,
  pin: OfficialPluginPin,
): Promise<PluginCatalogEntry> => {
  const entry = (await catalog()).find(item => item.manifest.id === pin.id);
  if (!entry) {
    throw new PluginLifecycleError(
      'official_plugin_not_found',
      `Официальный плагин не найден: ${pin.id}`,
      404,
    );
  }
  if (entry.manifest.version !== pin.version || entry.release.sha256 !== pin.sha256.toLowerCase()) {
    throw new PluginLifecycleError(
      'official_release_unavailable',
      'Запрошенная версия и SHA-256 отсутствуют в текущем официальном каталоге',
      409,
    );
  }
  return entry;
};

export const createPluginLifecycleService = (dependencies: PluginLifecycleDependencies) => {
  let mutationTail = Promise.resolve();
  const mutate = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = mutationTail.then(operation, operation);
    mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const installInspected = async (
    archivePath: string,
    inspection: PluginArchiveInspection,
    consent: PluginInstallConsent,
    enabled: boolean,
    expectedManifest?: PluginCatalogEntry['manifest'],
  ): Promise<PluginLifecycleInstallResult> => {
    exactConsent(inspection, consent);
    const installed = inspection.installed;
    if (
      installed?.manifest.version === inspection.manifest.version &&
      installed.archiveSha256 === inspection.sha256 &&
      installed.enabled === enabled
    ) {
      return {
        changed: false,
        updated: true,
        plugin: installed,
        restartRequired: installed.restartRequired,
      };
    }
    const result = await dependencies.installArchive(archivePath, {
      enabled,
      expectedSha256: inspection.sha256,
      ...(expectedManifest ? { expectedManifest } : {}),
    });
    return {
      changed: true,
      updated: result.updated,
      plugin: result.plugin,
      restartRequired: result.plugin.restartRequired,
    };
  };

  return {
    list: dependencies.list,
    catalog: dependencies.catalog,
    inspectArchive: (archivePath: string, expectedSha256?: string) =>
      dependencies.inspectArchive(archivePath).then(inspection => {
        if (expectedSha256 && inspection.sha256 !== expectedSha256.toLowerCase()) {
          throw new PluginLifecycleError(
            'archive_hash_mismatch',
            'SHA-256 архива плагина не совпадает с ожидаемым значением',
            409,
          );
        }
        return inspection;
      }),
    inspectOfficial: async (pin: OfficialPluginPin): Promise<PluginArchiveInspection> => {
      const entry = await officialEntry(dependencies.catalog, pin);
      const installed = (await dependencies.list()).find(
        plugin => plugin.manifest.id === entry.manifest.id,
      );
      return {
        manifest: entry.manifest,
        sha256: entry.release.sha256,
        size: entry.release.size,
        ...(installed ? { installed } : {}),
      };
    },
    installArchive: (
      archivePath: string,
      expectedSha256: string,
      consent: PluginInstallConsent,
      enabled: boolean,
    ) =>
      mutate(async () => {
        const inspection = await dependencies.inspectArchive(archivePath);
        if (inspection.sha256 !== expectedSha256.toLowerCase()) {
          throw new PluginLifecycleError(
            'archive_hash_mismatch',
            'SHA-256 архива плагина не совпадает с ожидаемым значением',
            409,
          );
        }
        return installInspected(archivePath, inspection, consent, enabled);
      }),
    installOfficial: (pin: OfficialPluginPin, consent: PluginInstallConsent, enabled: boolean) =>
      mutate(async () => {
        const entry = await officialEntry(dependencies.catalog, pin);
        const installed = (await dependencies.list()).find(
          plugin => plugin.manifest.id === entry.manifest.id,
        );
        const inspection: PluginArchiveInspection = {
          manifest: entry.manifest,
          sha256: entry.release.sha256,
          size: entry.release.size,
          ...(installed ? { installed } : {}),
        };
        exactConsent(inspection, consent);
        if (
          installed?.manifest.version === entry.manifest.version &&
          installed.archiveSha256 === entry.release.sha256 &&
          installed.enabled === enabled
        ) {
          return {
            changed: false,
            updated: true,
            plugin: installed,
            restartRequired: installed.restartRequired,
          };
        }
        const archive = await dependencies.downloadOfficial(entry);
        const directory = await dependencies.temporaryDirectory();
        const archivePath = path.join(directory, `${entry.manifest.id}.gmib-plugin`);
        try {
          await fs.promises.writeFile(archivePath, archive, { mode: 0o600 });
          const verified = await dependencies.inspectArchive(archivePath, entry.manifest);
          if (verified.sha256 !== entry.release.sha256) {
            throw new PluginLifecycleError(
              'archive_hash_mismatch',
              'SHA-256 скачанного плагина не совпадает с официальным каталогом',
              409,
            );
          }
          return installInspected(archivePath, verified, consent, enabled, entry.manifest);
        } finally {
          await fs.promises.rm(directory, { recursive: true, force: true });
        }
      }),
    setEnabled: (id: string, enabled: boolean) =>
      mutate(async () => {
        const installed = (await dependencies.list()).find(plugin => plugin.manifest.id === id);
        if (!installed) {
          throw new PluginLifecycleError('plugin_not_found', `Плагин не найден: ${id}`, 404);
        }
        if (installed.enabled === enabled) return { changed: false, plugin: installed };
        return { changed: true, plugin: await dependencies.setEnabled(id, enabled) };
      }),
    uninstall: (id: string): Promise<PluginLifecycleUninstallResult> =>
      mutate(async () => {
        const installed = (await dependencies.list()).find(plugin => plugin.manifest.id === id);
        if (!installed) {
          return { changed: false, restartRequired: dependencies.isRunning(id) };
        }
        await dependencies.uninstall(id);
        return { changed: true, restartRequired: installed.runningEnabled };
      }),
  };
};

export const pluginLifecycle = createPluginLifecycleService({
  catalog: listOfficialPlugins,
  downloadOfficial: downloadOfficialPluginArchive,
  inspectArchive: inspectPluginArchive,
  installArchive: installPluginFromArchive,
  isRunning: isPluginRunning,
  list: listPlugins,
  setEnabled: setPluginEnabled,
  temporaryDirectory: () =>
    fs.promises.mkdtemp(path.join(app.getPath('temp'), `gmib-plugin-${nanoid()}-`)),
  uninstall: uninstallPlugin,
});
