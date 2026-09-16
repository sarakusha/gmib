import type { LicensePayloadV2 } from '/@common/license';

export type LicensePresentation = {
  message?: string;
  plan?: string;
  renew?: string;
  useProxy: boolean;
};

export const getLicensePresentation = (payload?: LicensePayloadV2): LicensePresentation => {
  const active = payload?.status === 'active';
  return {
    useProxy: Boolean(active && payload.capabilities.includes('novastar')),
    ...(active ? { plan: payload.plan } : {}),
    ...(active && payload.expiresAt ? { renew: payload.expiresAt } : {}),
    ...(active && payload.presentation.css ? { message: payload.presentation.css } : {}),
  };
};
