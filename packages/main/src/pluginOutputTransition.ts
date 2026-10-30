import type { BrowserWindow } from 'electron';
import { checkPlayerOutput } from './playerOutputHealth';
import { getPlaybackOutputs, onPlaybackOutputsChanged } from './playbackOutputState';

const PLAYER_READY_TIMEOUT_MS = 8000;

/** Keep the cover while Chromium produces a surface and the native compositor settles. */
export const waitForPluginOutputFrame = async (window: BrowserWindow): Promise<void> => {
  let timeout: NodeJS.Timeout | undefined;
  const checkVisible = () => {
    if (window.isDestroyed() || !window.isVisible())
      throw new Error('Новый вывод скрыт. Прежний вывод сохранён.');
  };
  try {
    checkVisible();
    const image = await Promise.race([
      window.webContents.capturePage(undefined, { stayHidden: true }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Новый вывод не подготовил изображение. Прежний вывод сохранён.')),
          PLAYER_READY_TIMEOUT_MS,
        );
      }),
    ]);
    if (image.isEmpty()) throw new Error('Новый вывод не подготовил изображение.');
    // A ready Chromium surface can precede native presentation. Keep this grace
    // period on every platform, including macOS WindowServer and Windows DWM.
    await new Promise<void>(resolve => setTimeout(resolve, 250));
    checkVisible();
  } finally {
    clearTimeout(timeout);
  }
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
