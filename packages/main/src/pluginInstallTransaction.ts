import fs from 'node:fs';

type PluginInstallTransactionOptions = {
  backup: string;
  persist: () => Promise<void>;
  staging: string;
  target: string;
  targetExists: boolean;
};

export const commitRegistryUpdate = async <T>(
  previous: T,
  next: T,
  assign: (value: T) => void,
  persist: () => Promise<void>,
): Promise<void> => {
  assign(next);
  try {
    await persist();
  } catch (error) {
    assign(previous);
    throw error;
  }
};

export const commitPluginInstall = async ({
  backup,
  persist,
  staging,
  target,
  targetExists,
}: PluginInstallTransactionOptions): Promise<void> => {
  if (targetExists) await fs.promises.rename(target, backup);
  try {
    await fs.promises.rename(staging, target);
    await persist();
  } catch (error) {
    await fs.promises.rm(target, { recursive: true, force: true }).catch(() => undefined);
    if (targetExists) await fs.promises.rename(backup, target).catch(() => undefined);
    throw error;
  }
  if (targetExists) {
    await fs.promises.rm(backup, { recursive: true, force: true }).catch(() => undefined);
  }
};

export const commitPluginRemoval = async (
  target: string,
  backup: string,
  persist: () => Promise<void>,
): Promise<void> => {
  await fs.promises.rename(target, backup);
  try {
    await persist();
  } catch (error) {
    await fs.promises.rename(backup, target).catch(() => undefined);
    throw error;
  }
  await fs.promises.rm(backup, { recursive: true, force: true }).catch(() => undefined);
};
