import displayApi from '../../common/displays';

import configApi from './config';
import novastarApi, { sse } from './novastar';
import screenApi from './screens';

export const reducer = {
  [screenApi.reducerPath]: screenApi.reducer,
  [displayApi.reducerPath]: displayApi.reducer,
  [novastarApi.reducerPath]: novastarApi.reducer,
  [configApi.reducerPath]: configApi.reducer,
};

export const middleware = [
  screenApi.middleware,
  displayApi.middleware,
  novastarApi.middleware,
  configApi.middleware,
  sse,
];
