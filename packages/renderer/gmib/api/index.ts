import screenApi from './screens';
import displayApi from './displays';

export const reducer = {
  [screenApi.reducerPath]: screenApi.reducer,
  [displayApi.reducerPath]: displayApi.reducer,
};

export const middleware = [screenApi.middleware, displayApi.middleware];
