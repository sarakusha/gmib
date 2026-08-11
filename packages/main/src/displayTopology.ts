import { app, screen } from 'electron';

import debugFactory from 'debug';

import { dbReady } from './db';
import { refreshPlayerOutputWindows } from './openHandler';
import { getScreens } from './screen';
import { updateTest } from './screenOutput';
import { wss } from './server';
import { broadcastToTabbedWindows } from './tabbedWindow';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:displayTopology`);
const SETTLE_DELAY_MS = 500;

let refreshTimer: NodeJS.Timeout | undefined;

const broadcastDisplayTopologyChanged = (): void => {
  const message = JSON.stringify({ event: 'displayTopologyChanged' });
  wss.clients.forEach(ws => {
    if (ws.readyState === ws.OPEN) ws.send(message);
  });
  broadcastToTabbedWindows('displayTopologyChanged');
};

const refreshDisplayOutputs = async (): Promise<void> => {
  await dbReady;
  const screens = await getScreens();
  await Promise.all(screens.map(value => updateTest(value, true)));
  refreshPlayerOutputWindows();
  broadcastDisplayTopologyChanged();
};

const scheduleRefreshDisplayOutputs = (): void => {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = undefined;
    void refreshDisplayOutputs().catch(error => {
      debug(
        `Failed to refresh outputs after display topology change: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }, SETTLE_DELAY_MS);
};

void app.whenReady().then(() => {
  screen.on('display-added', scheduleRefreshDisplayOutputs);
  screen.on('display-removed', scheduleRefreshDisplayOutputs);
  screen.on('display-metrics-changed', scheduleRefreshDisplayOutputs);
});

app.once('will-quit', () => {
  if (refreshTimer) clearTimeout(refreshTimer);
  screen.off('display-added', scheduleRefreshDisplayOutputs);
  screen.off('display-removed', scheduleRefreshDisplayOutputs);
  screen.off('display-metrics-changed', scheduleRefreshDisplayOutputs);
});
