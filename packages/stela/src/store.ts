import Configstore from 'configstore';
import { omit } from 'lodash';

// import getConfig from 'next/config';

export const pkgName = 'stela';

// const { serverRuntimeConfig } = getConfig();

const store = new Configstore(pkgName);
export function getSafeStore() {
  return omit(store.all, ['users']);
}
export default store;
