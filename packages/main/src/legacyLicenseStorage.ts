import type { LocalConfig } from '/@common/helpers';

const stringFields = ['announce', 'iv', 'knock'] as const;

export type LegacyLicenseUpdate = Partial<Record<(typeof stringFields)[number], string | null>> & {
  autoUpdate?: boolean;
  pritunl?: unknown;
};

export const parseLegacyLicenseUpdate = (value: unknown): LegacyLicenseUpdate => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('License server returned an invalid response');
  }
  const input = value as Record<string, unknown>;
  const result: LegacyLicenseUpdate = {};
  stringFields.forEach(field => {
    const current = input[field];
    if (current !== undefined && current !== null && typeof current !== 'string') {
      throw new Error('License server returned an invalid response');
    }
    if (current !== undefined) result[field] = current;
  });
  if (input.autoUpdate !== undefined) {
    if (typeof input.autoUpdate !== 'boolean') {
      throw new Error('License server returned an invalid response');
    }
    result.autoUpdate = input.autoUpdate;
  }
  if (input.pritunl !== undefined) result.pritunl = input.pritunl;
  return result;
};

type WritableStore = Pick<
  {
    set: <Key extends keyof LocalConfig>(key: Key, value: LocalConfig[Key]) => void;
    delete: (key: keyof LocalConfig) => void;
  },
  'set' | 'delete'
>;

export const applyLegacyLicenseUpdate = (
  store: WritableStore,
  update: LegacyLicenseUpdate,
): void => {
  stringFields.forEach(field => {
    const value = update[field];
    if (value === null) store.delete(field);
    else if (value !== undefined) store.set(field, value);
  });
  if (update.autoUpdate !== undefined) store.set('autoUpdate', update.autoUpdate);
};
