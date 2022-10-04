import { createHash as createHashOrig, type HashOptions } from 'crypto';

// eslint-disable-next-line import/prefer-default-export
export const createHash = (algorithm: string, options?: HashOptions) => {
  const hash = createHashOrig(algorithm, options);
  return {
    update: hash.update.bind(hash),
    digest: hash.digest.bind(hash),
  };
};
