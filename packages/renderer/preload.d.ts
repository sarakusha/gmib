import type { GmibApi } from '../preload/gmib';
import type { PlayerApi } from '../preload/player';
import type { RemoteApi } from '../preload/remote';

// Both player pages use this renderer. Only updateSrcObject exists in both preloads;
// local playback and remote preview methods must be checked before calling them.
type PlayerMediaStream = Pick<PlayerApi['mediaStream'], 'updateSrcObject'> &
  Partial<Omit<PlayerApi['mediaStream'], 'updateSrcObject'>> &
  Partial<Omit<RemoteApi['mediaStream'], 'updateSrcObject'>>;

declare global {
  interface Window extends GmibApi, Omit<PlayerApi, 'mediaStream'> {
    readonly mediaStream: PlayerMediaStream;
  }
}
