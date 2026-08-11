import type { RemoteHost } from '/@common/helpers';

export const areSameRemoteHost = (left: RemoteHost, right: RemoteHost): boolean =>
  left.name === right.name &&
  left.version === right.version &&
  left.address === right.address &&
  left.port === right.port &&
  left.platform === right.platform &&
  left.arch === right.arch &&
  left.osVersion === right.osVersion;
