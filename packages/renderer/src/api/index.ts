import screenApi from './screens';

export const reducer = {
  [screenApi.reducerPath]: screenApi.reducer,
};

export const middleware = [screenApi.middleware];
