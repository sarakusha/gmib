import type express from 'express';

import type auth from './auth';
import { createLicenseMutationGate } from './licenseMutationGate';

type ApiAuthOptions = {
  auth: typeof auth;
  getLicenseStatus: () => string;
  srpRouter: express.Router;
  unsafeMode: boolean;
};

export const mountApiAuth = (
  api: express.Router,
  { auth: authMiddleware, getLicenseStatus, srpRouter, unsafeMode }: ApiAuthOptions,
): void => {
  if (!unsafeMode) {
    api.use(
      authMiddleware.unless({
        path: [
          /\/api\/login\/.*/,
          /\/api\/handshake\/.*/,
          '/api/identifier',
          '/api/novastar/subscribe',
        ],
      }),
    );
  }

  api.use(createLicenseMutationGate(getLicenseStatus));
  api.use(srpRouter);
};
