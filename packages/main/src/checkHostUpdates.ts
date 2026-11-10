import type { BaseWindow } from 'electron';
import type { UpdateInfo } from 'electron-updater';
import authRequest from './authRequest';
import log from './initlog';
import { showUpdateDialog } from './updateDialog';

/** Keep every step attached to the window that initiated the update. */
export const checkHostUpdates = async (
  host: string,
  port: number,
  parent?: BaseWindow,
): Promise<void> => {
  try {
    const response = await authRequest({ api: '/checkForUpdates', method: 'POST', host, port });
    if (!response) return;
    if (!response.ok) throw new Error(await response.text());
    const info = (await response.json()) as UpdateInfo | undefined;
    if (!info) {
      await showUpdateDialog(
        { title: 'Обновления не найдены', message: 'Установлена последняя версия' },
        parent,
      );
      return;
    }
    const { response: choice } = await showUpdateDialog(
      {
        type: 'info',
        title: 'Найдено обновление',
        message: `Найдено обновление ${info.version} для ${host}, хотите установить?`,
        buttons: ['Установить', 'Не сейчас'],
        cancelId: 1,
      },
      parent,
    );
    if (choice !== 0) return;
    const installed = await authRequest({ api: '/update', method: 'POST', host, port });
    if (!installed) return;
    if (!installed.ok) throw new Error(await installed.text());
    // Local GMIB is about to quit. Do not open another dialog during shutdown.
    if (host !== 'localhost')
      await showUpdateDialog(
        {
          title: 'Обновление загружено',
          message: 'Удалённый GMIB начинает установку и перезапуск.',
        },
        parent,
      );
  } catch (error) {
    log.error('Failed to update GMIB host', error);
    await showUpdateDialog(
      {
        type: 'error',
        title: 'Ошибка обновления',
        message: error instanceof Error ? error.message : String(error),
      },
      parent,
    ).catch(dialogError => log.error('Failed to show update error', dialogError));
  }
};
