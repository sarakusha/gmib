import type { LicenseRuntimeState } from '/@common/license';
import { hashCode } from '/@common/helpers';

const SPECIAL = 'rlXINR-cZo5bnISD5TaUT';
const BLOCK = 'LqiknX4bnpOZyEn5DYsUT';
const FLEX = 'MeE8KHrK9KuXZe0HnW47V';
const DISPLAY =
  '{ display: inherit; margin: inherit; overflow: inherit; position: inherit; color: inherit; background: inherit; }';

const capabilityClasses: Readonly<Record<string, string>> = {
  autobrightness: 'YqATOnK8rERXOjt0JEXW0',
  'custom-editor': 'CG7cBydXFzf6qGSi-xBj8',
  'custom-url': 'tNX9k9byJD58qNs4nxAIi',
  novastar: 'yu6ODejliBoLEEgGBmOEe',
  overheat: 'kTVgvtztsObADJyScNLdK',
  player: 'fENqwKPkxEbSMsIqFGbuR',
  remote: 'y6jz5rJ-Brg9PLHpFRQgc',
};

export type LicensePresentation = {
  message?: string;
  plan?: string;
  renew?: string;
  useProxy: boolean;
};

export const createLicensePresentation = (
  state: LicenseRuntimeState,
  deviceId: string,
): LicensePresentation => {
  const active = state.status === 'active';
  const classes = active
    ? state.capabilities.map(capability => capabilityClasses[capability]).filter(Boolean)
    : [];
  const root = `.gmib-${hashCode(deviceId).toString(16)}`;
  const selectors = classes.map(className => `${root} .${SPECIAL}.${className}`).join();
  const block = classes.map(className => `${root} .${SPECIAL}.${className}.${BLOCK}`).join();
  const flex = classes.map(className => `${root} .${SPECIAL}.${className}.${FLEX}`).join();
  return {
    useProxy: active && state.capabilities.includes('novastar'),
    ...(active && state.plan ? { plan: state.plan } : {}),
    ...(active && state.expiresAt ? { renew: state.expiresAt } : {}),
    ...(selectors
      ? {
          message: `${selectors} ${DISPLAY}\n${block} { display: block }\n${flex} { display: flex }`,
        }
      : {}),
  };
};
