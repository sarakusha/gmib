import path from 'node:path';
import { app } from 'electron';

import { onBeforeDatabaseClose } from './db';
import localConfig from './localConfig';
import { PlaybackStatisticsStore } from './playbackStatisticsStore';

let store: PlaybackStatisticsStore | undefined;
let closing = false;

export const getPlaybackStatisticsPath = (): string =>
  path.join(app.getPath('userData'), 'playback.sqlite');

/** The event writer and HTTP reports share one transaction queue and database lifetime. */
export const getPlaybackStatisticsStore = (): PlaybackStatisticsStore => {
  if (closing) throw new Error('Playback statistics database is closing');
  store ??= new PlaybackStatisticsStore(getPlaybackStatisticsPath(), {
    retentionDays: () => localConfig.get('playbackLogRetentionDays'),
  });
  return store;
};

onBeforeDatabaseClose(async () => {
  closing = true;
  await store?.close();
});
