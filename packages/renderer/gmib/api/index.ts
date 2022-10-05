import displayApi from '../../common/displays';

import screenApi from './screens';

export const reducer = {
  [screenApi.reducerPath]: screenApi.reducer,
  [displayApi.reducerPath]: displayApi.reducer,
};

export const middleware = [screenApi.middleware, displayApi.middleware];
