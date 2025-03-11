/**
 * Не используется!
 */

import { app, ipcMain, MessageChannelMain, type WebFrameMain } from 'electron';

import debugFactory from 'debug';
import remove from 'lodash/remove';

// import { getMainWindow } from './mainWindow';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:channels`);

type Expects = {
  sourceId: number;
  outputId: number;
  frame: WebFrameMain;
};

const videoSources = new Map<number, WebFrameMain>();
const videoOutputs: Expects[] = [];

const tryCreateChannels = () => {
  const outputs = remove(videoOutputs, ({ sourceId }) => videoSources.has(sourceId));
  outputs.forEach(({ sourceId, outputId, frame }) => {
    const source = videoSources.get(sourceId);
    if (source) {
      debug(`create channel ${sourceId}/${outputId}`);
      const { port1, port2 } = new MessageChannelMain();
      source.postMessage('new-output', outputId, [port1]);
      frame.postMessage('provide-source-channel', null, [port2]);
      port1.once('close', () => {
        frame.postMessage('close-source-channel', null);
      });
      port2.once('close', () => {
        source.postMessage('remove-output', outputId);
      });
    }
  });
};

// const createScreenChannel = async (playerFrame: WebFrameMain, screenId: number): Promise<void> => {
//   const mainWindow = await getMainWindow();
//   if (!mainWindow) setTimeout(() => createScreenChannel(playerFrame, screenId), 1000);
//   else {
//     const { port1, port2 } = new MessageChannelMain();
//     mainWindow.webContents.postMessage('new-screen', screenId, [port1]);
//     playerFrame.postMessage('provide-screen-channel', null, [port2]);
//     debug(`#${screenId} screen channel is created`);
//   }
// };

app.whenReady().then(() => {
  // ipcMain.on('request-screen-channel', async (event, screenId: number) =>
  //   createScreenChannel(event.senderFrame, screenId),
  // );
  ipcMain.on('register-source-channel', (event, sourceId: number) => {
    debug(`register source: ${sourceId}`);
    event.senderFrame && videoSources.set(sourceId, event.senderFrame);
    tryCreateChannels();
  });
  ipcMain.on('request-source-channel', (event, sourceId: number, outputId: number) => {
    debug(`request source: ${sourceId}/${outputId}`);
    event.senderFrame && videoOutputs.push({ sourceId, outputId, frame: event.senderFrame });
    tryCreateChannels();
  });
});
