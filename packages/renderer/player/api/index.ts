import displayApi from '../../common/displays';

import mappingApi from './mapping';
import mediaApi from './media';
import playerApi from './player';
import playlistApi from './playlists';
import schedulerApi from './scheduler';
import { socketMiddleware } from './updatePlayer';

export const reducer = {
  [mediaApi.reducerPath]: mediaApi.reducer,
  [playlistApi.reducerPath]: playlistApi.reducer,
  [playerApi.reducerPath]: playerApi.reducer,
  [displayApi.reducerPath]: displayApi.reducer,
  [mappingApi.reducerPath]: mappingApi.reducer,
  [schedulerApi.reducerPath]: schedulerApi.reducer,
};

export const middleware = [
  mediaApi.middleware,
  playlistApi.middleware,
  playerApi.middleware,
  displayApi.middleware,
  mappingApi.middleware,
  schedulerApi.middleware,
  socketMiddleware,
];
