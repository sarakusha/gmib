import { dialog } from 'electron';

import type {
  PluginArchiveInspection,
  PluginInstallConsent,
  PluginInstallResult,
  PluginPermission,
} from '/@common/plugins';

import { pluginLifecycle } from './pluginLifecycle';

const permissionLabels: Record<PluginPermission, string> = {
  'http.routes': 'локальные и авторизованные HTTP-маршруты',
  'output.pages': 'страницы в разделе «Вывод»',
  realtime: 'события реального времени',
  storage: 'постоянное хранилище',
  database: 'база SQLite плагина',
  'services.provide': 'предоставление сервисов плагинам',
  'services.consume': 'использование сервисов зависимостей',
  'plugins.read': 'список установленных видов спорта',
  'output.control': 'управление привязанным выводом',
  'nibus.read': 'чтение событий NiBUS',
  'nibus.write': 'отправка состояния табло NiBUS',
};

const confirmInstall = async (
  inspection: PluginArchiveInspection,
): Promise<PluginInstallConsent | undefined> => {
  const { manifest } = inspection;
  const permissionText =
    (manifest.permissions ?? [])
      .map(permission => `• ${permissionLabels[permission]}`)
      .join('\n') || 'Разрешения API не запрашиваются';
  const backendWarning = manifest.main
    ? '\n\nПлагин содержит доверенный backend-код. Он выполняется с правами gmib и должен быть получен из надёжного источника.'
    : '';
  const confirmation = await dialog.showMessageBox({
    type: manifest.main ? 'warning' : 'question',
    title: inspection.installed ? 'Обновление плагина' : 'Установка плагина',
    message: `${inspection.installed ? 'Обновить' : 'Установить'} «${manifest.name}» ${manifest.version}?`,
    detail: `${manifest.description ? `${manifest.description}\n\n` : ''}Разрешения:\n${permissionText}${backendWarning}`,
    buttons: [inspection.installed ? 'Обновить' : 'Установить', 'Отмена'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (confirmation.response !== 0) return undefined;
  return {
    permissions: [...(manifest.permissions ?? [])],
    trustedBackend: Boolean(manifest.main),
  };
};

const installResult = (
  result: Awaited<ReturnType<typeof pluginLifecycle.installArchive>>,
): PluginInstallResult => ({ status: 'installed', ...result });

export const installPluginFromDialog = async (): Promise<PluginInstallResult> => {
  const result = await dialog.showOpenDialog({
    title: 'Установить плагин gmib',
    filters: [{ name: 'Плагины gmib', extensions: ['gmib-plugin', 'zip'] }],
    properties: ['openFile'],
  });
  const [archivePath] = result.filePaths;
  if (result.canceled || !archivePath) return { status: 'cancelled' };
  const inspection = await pluginLifecycle.inspectArchive(archivePath);
  const consent = await confirmInstall(inspection);
  if (!consent) return { status: 'cancelled' };
  return installResult(
    await pluginLifecycle.installArchive(archivePath, inspection.sha256, consent, true),
  );
};

export const installOfficialPluginFromDialog = async (id: string): Promise<PluginInstallResult> => {
  const entry = (await pluginLifecycle.catalog()).find(item => item.manifest.id === id);
  if (!entry) throw new Error(`Официальный плагин не найден: ${id}`);
  const pin = { id, version: entry.manifest.version, sha256: entry.release.sha256 };
  const inspection = await pluginLifecycle.inspectOfficial(pin);
  const consent = await confirmInstall(inspection);
  if (!consent) return { status: 'cancelled' };
  return installResult(await pluginLifecycle.installOfficial(pin, consent, true));
};

export const uninstallPluginFromDialog = async (id: string): Promise<boolean> => {
  const installed = (await pluginLifecycle.list()).find(item => item.manifest.id === id);
  if (!installed) return false;
  const confirmation = await dialog.showMessageBox({
    type: 'warning',
    title: 'Удаление плагина',
    message: `Удалить «${installed.manifest.name}»?`,
    detail:
      'Файлы плагина будут удалены. Сохранённые данные останутся, чтобы их можно было восстановить при повторной установке.',
    buttons: ['Удалить', 'Отмена'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (confirmation.response !== 0) return false;
  return (await pluginLifecycle.uninstall(id)).changed;
};
