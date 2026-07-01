import displayApi from '../../common/displays';

import configApi from './config';
import novastarApi, { sse } from './novastar';
import schedulerApi from './scheduler';
import screenApi from './screens';

export const reducer = {
  [screenApi.reducerPath]: screenApi.reducer,
  [displayApi.reducerPath]: displayApi.reducer,
  [novastarApi.reducerPath]: novastarApi.reducer,
  [configApi.reducerPath]: configApi.reducer,
  [schedulerApi.reducerPath]: schedulerApi.reducer,
} as const;

export const middleware = [
  screenApi.middleware,
  displayApi.middleware,
  novastarApi.middleware,
  configApi.middleware,
  schedulerApi.middleware,
  sse,
] as const;
