import os from 'node:os';

import type { GmibWindowParams } from '/@common/WindowParams';

import { port } from './config';
import { getLicenseState } from './licenseState';
import localConfig from './localConfig';
import { getAllGmibParams } from './windowStore';

// The runtime API is started before plugins (index.ts), and interactive control
// arrives through that API. A local UI tab is not a server-readiness signal.
export const getLocalPlayerConnection = (): GmibWindowParams => {
  const registered = getAllGmibParams().find(({ host }) => host === 'localhost');
  if (registered) return registered;

  // This describes a backend connection, not a managed UI window. It is only
  // retained as the local player's parent context; no GMIB tab is registered.
  const licenseState = getLicenseState();
  const params: GmibWindowParams = {
    id: 0,
    zIndex: 0,
    type: 'gmib',
    host: 'localhost',
    nibusPort: port - 1,
    licenseState,
    plan: licenseState.plan,
    autostart: localConfig.get('autostart'),
    exactWindowPlacement: localConfig.get('exactWindowPlacement'),
    info: {
      name: os.hostname().replace(/\.local\.?$/, ''),
      version: import.meta.env.VITE_APP_VERSION,
      platform: os.platform(),
      arch: os.arch(),
    },
    update: values => Object.assign(params, values),
  };
  return params;
};
