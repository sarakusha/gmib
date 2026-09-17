import auth from './auth';
import { getRemoteAuthCredentials, setRemoteAuthCredentials } from './remoteAuthConfig';
import { clearIncomingSecrets, setIncomingSecret } from './secret';
import { SrpAuthService } from './srpAuthService';
import { createSrpAuthRouter } from './srpAuthRouter';

export const srpAuthService = new SrpAuthService({
  credentials: {
    get: getRemoteAuthCredentials,
    set: setRemoteAuthCredentials,
  },
  incomingSecrets: {
    set: setIncomingSecret,
    revokeAll: clearIncomingSecrets,
  },
});

export const srpAuthRouter = createSrpAuthRouter(srpAuthService, auth);
