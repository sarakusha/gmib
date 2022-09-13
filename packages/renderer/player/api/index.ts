import displayApi from './displays';
import mediaApi from './media';
import playerApi from './player';
import playlistApi from './playlists';

export const reducer = {
  [mediaApi.reducerPath]: mediaApi.reducer,
  [playlistApi.reducerPath]: playlistApi.reducer,
  [playerApi.reducerPath]: playerApi.reducer,
  [displayApi.reducerPath]: displayApi.reducer,
};

export const middleware = [
  mediaApi.middleware,
  playlistApi.middleware,
  playerApi.middleware,
  displayApi.middleware,
];
