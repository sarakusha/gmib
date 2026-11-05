import type { RequestHandler, Router } from 'express';

import auth from './auth';
import localConfig from './localConfig';
import { createManagementHostsService, type ManagementHostsService } from './managementHosts';
import { createManagementHostsRouter } from './managementHostsRouter';
import { getRemoteHosts } from './mdns';

const runtimeHostsService = createManagementHostsService({
  getSavedHosts: () => localConfig.get('hosts'),
  setSavedHosts: hosts => localConfig.set('hosts', hosts),
  getDiscoveredHosts: getRemoteHosts,
});

export const mountManagementHostsApi = (
  api: Router,
  options: {
    hostsService?: ManagementHostsService;
    strictAuth?: RequestHandler;
  } = {},
): void => {
  const strictAuth = options.strictAuth ?? auth;
  api.use(
    '/manage/v1',
    createManagementHostsRouter({
      service: options.hostsService ?? runtimeHostsService,
      strictAuth,
    }),
  );
};
