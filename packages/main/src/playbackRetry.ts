import type { PlayerWindowParams } from '/@common/WindowParams';

type RetryTarget = {
  webContents: {
    send(channel: string, mediaId: string): void;
  };
};

export const broadcastPlaybackRetry = (
  mediaId: string,
  players: PlayerWindowParams[],
  findWindow: (id: number) => RetryTarget | undefined,
): void => {
  players
    .filter(player => player.host === 'localhost')
    .forEach(player => findWindow(player.id)?.webContents.send('playback:retry', mediaId));
};
