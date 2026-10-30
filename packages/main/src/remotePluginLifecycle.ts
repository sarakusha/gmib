import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';

import { dialog } from 'electron';

import { supportsFeature } from '/@common/capabilities';
import type { GmibWindowParams } from '/@common/WindowParams';
import type {
  PluginArchiveInspection,
  PluginCatalogEntry,
  PluginInstallResult,
  PluginLifecycleInstallResult,
  PluginLifecycleUninstallResult,
  PluginStatus,
} from '/@common/plugins';

import authRequest from './authRequest';
import { MAX_PLUGIN_ARCHIVE_SIZE } from './pluginArchive';
import { confirmInstall, confirmUninstall } from './pluginLifecycleUi';

const ROOT = '/manage/v1/plugins';
const pluginId = (id: string): string => {
  if (typeof id !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(id))
    throw new Error('Недопустимый идентификатор плагина');
  return id;
};

export const requireRemotePluginSupport = (params: GmibWindowParams): void => {
  if (!supportsFeature('remotePlugins', params.info?.version, true))
    throw new Error('Для удалённого управления плагинами обновите GMIB до 5.7.1 или новее');
};

export const createRemotePluginLifecycle = (params: GmibWindowParams) => {
  requireRemotePluginSupport(params);
  const target = `${params.info?.name ?? params.host} (${params.host}:${params.nibusPort + 1})`;
  const request = async <T>(
    path = '',
    method = 'GET',
    body?: unknown,
    binaryBody?: Uint8Array,
  ): Promise<T> => {
    const response = await authRequest({
      host: params.host,
      port: params.nibusPort + 1,
      api: `${ROOT}${path}`,
      method,
      body,
      binaryBody,
      redirect: 'error',
    });
    if (!response) throw new Error('Авторизация на удалённом GMIB отменена');
    const text = await response.text();
    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      if (response.ok) throw new Error('Удалённый GMIB вернул некорректный ответ');
    }
    if (!response.ok) {
      const error = (result as { error?: { message?: string } | string } | undefined)?.error;
      throw new Error(
        (typeof error === 'string' ? error : error?.message) ??
          (response.status === 404
            ? 'Удалённый GMIB не поддерживает управление плагинами. Обновите его до 5.7.1 или новее'
            : `Операция с плагином на удалённом GMIB завершилась ошибкой (${response.status})`),
      );
    }
    return result as T;
  };
  const list = async (): Promise<PluginStatus[]> =>
    (await request<{ plugins: PluginStatus[] }>()).plugins;
  const catalog = async (): Promise<PluginCatalogEntry[]> =>
    (await request<{ plugins: PluginCatalogEntry[] }>('/catalog')).plugins;
  return {
    list,
    catalog,
    install: async (): Promise<PluginInstallResult> => {
      const selected = await dialog.showOpenDialog({
        title: `Установить плагин на ${target}`,
        filters: [{ name: 'Плагины gmib', extensions: ['gmib-plugin', 'zip'] }],
        properties: ['openFile'],
      });
      const [archivePath] = selected.filePaths;
      if (selected.canceled || !archivePath) return { status: 'cancelled' };
      const stats = await fs.stat(archivePath);
      if (!stats.isFile() || !stats.size || stats.size > MAX_PLUGIN_ARCHIVE_SIZE)
        throw new Error('Выберите непустой архив плагина размером не более 50 МБ');
      // Keep the inspected bytes unchanged while the consent dialog is open.
      const bytes = await fs.readFile(archivePath);
      if (!bytes.length || bytes.length > MAX_PLUGIN_ARCHIVE_SIZE)
        throw new Error('Размер архива плагина должен быть от 1 байта до 50 МБ');
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const inspection = await request<PluginArchiveInspection>(
        `/archive/inspect?${new URLSearchParams({ sha256 })}`,
        'POST',
        undefined,
        bytes,
      );
      if (inspection.sha256 !== sha256) throw new Error('SHA-256 проверенного архива не совпадает');
      const consent = await confirmInstall(inspection, target);
      if (!consent) return { status: 'cancelled' };
      const query = new URLSearchParams({
        sha256,
        permissions: consent.permissions.join(','),
        trustedBackend: String(consent.trustedBackend),
        enabled: 'true',
      });
      const result = await request<PluginLifecycleInstallResult>(
        `/archive/install?${query}`,
        'POST',
        undefined,
        bytes,
      );
      return { status: 'installed', ...result };
    },
    installOfficial: async (id: string): Promise<PluginInstallResult> => {
      pluginId(id);
      const entry = (await catalog()).find(item => item.manifest.id === id);
      if (!entry) throw new Error(`Официальный плагин не найден: ${id}`);
      const pin = { version: entry.manifest.version, sha256: entry.release.sha256 };
      const inspection = await request<PluginArchiveInspection>(
        `/official/${id}/inspect?${new URLSearchParams(pin)}`,
      );
      if (
        inspection.sha256 !== pin.sha256 ||
        inspection.manifest.id !== id ||
        inspection.manifest.version !== pin.version
      )
        throw new Error('Проверенный плагин не соответствует выбранному официальному выпуску');
      const consent = await confirmInstall(inspection, target);
      if (!consent) return { status: 'cancelled' };
      const result = await request<PluginLifecycleInstallResult>(
        `/official/${id}/install`,
        'POST',
        {
          ...pin,
          ...consent,
          enabled: true,
        },
      );
      return { status: 'installed', ...result };
    },
    setEnabled: async (id: string, enabled: boolean): Promise<PluginStatus> => {
      if (typeof enabled !== 'boolean') throw new Error('Параметр enabled должен быть boolean');
      return (
        await request<{ plugin: PluginStatus }>(`/${pluginId(id)}/enabled`, 'PUT', { enabled })
      ).plugin;
    },
    uninstall: async (id: string): Promise<boolean> => {
      pluginId(id);
      const installed = (await list()).find(item => item.manifest.id === id);
      if (!installed || !(await confirmUninstall(installed.manifest.name, target))) return false;
      return (await request<PluginLifecycleUninstallResult>(`/${id}`, 'DELETE')).changed;
    },
    restart: async (): Promise<void> => {
      await request('/restart', 'POST');
    },
  };
};
