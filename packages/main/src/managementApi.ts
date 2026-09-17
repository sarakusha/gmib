import type { RequestHandler, Router } from 'express';

import config from './config';
import auth from './auth';
import {
  createManagementSettingsService,
  type ManagementSettingsService,
} from './managementSettings';
import { createManagementSettingsRouter } from './managementSettingsRouter';

const runtimeSettingsService = createManagementSettingsService({
  getConfig: () => config.store,
  updateConfigStore: async update => (await import('./nibus')).updateConfigStore(update),
});

export const mountManagementSettingsApi = (
  api: Router,
  options: {
    settingsService?: ManagementSettingsService;
    strictAuth?: RequestHandler;
  } = {},
): void => {
  const strictAuth = options.strictAuth ?? auth;
  api.use(
    '/manage/v1',
    createManagementSettingsRouter({
      service: options.settingsService ?? runtimeSettingsService,
      strictAuth,
    }),
  );
};
