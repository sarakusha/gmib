import type { BrowserWindow } from 'electron';
import { checkPlayerOutput } from './playerOutputHealth';
import { getPlaybackOutputs, onPlaybackOutputsChanged } from './playbackOutputState';

const PLAYER_READY_TIMEOUT_MS = 8000;

/** Allow the loaded page and native compositor to settle before removing the cover. */
export const waitForPluginOutputSettle = async (window: BrowserWindow): Promise<void> => {
  const checkVisible = () => {
    if (window.isDestroyed() || window.webContents.isDestroyed() || !window.isVisible())
      throw new Error('Новый вывод скрыт или закрыт. Прежний вывод сохранён.');
  };
  checkVisible();
  // loadURL and player frame readiness have already completed. A short grace
  // period works on every platform without depending on GPU screenshot support
  // (capturePage can fail with Unknown Viz Error for an otherwise healthy window).
  await new Promise<void>(resolve => setTimeout(resolve, 500));
  checkVisible();
};

/** Wait for fresh frame evidence after setPluginPlayerState invalidates old evidence. */
export const waitForPluginPlayerReady = (playerId: number): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    let finished = false;
    let unsubscribe = () => {};
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      unsubscribe();
      if (error) reject(error);
      else resolve();
    };
    const check = () => {
      const outputs = getPlaybackOutputs(playerId);
      if (outputs.length > 0 && outputs.every(output => output.state === 'showing')) finish();
    };
    unsubscribe = onPlaybackOutputsChanged(id => {
      if (id === playerId) check();
    });
    const timeout = setTimeout(
      () =>
        finish(new Error(`Плеер ${playerId} не подготовил изображение. Прежний вывод сохранён.`)),
      PLAYER_READY_TIMEOUT_MS,
    );
    check();
    if (!finished) {
      // Reuse the host's authenticated renderer health probe instead of a fixed pause.
      void checkPlayerOutput(playerId).catch(error =>
        finish(error instanceof Error ? error : new Error(String(error))),
      );
    }
  });
