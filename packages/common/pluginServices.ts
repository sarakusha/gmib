import type { PluginSportStatus } from './plugins';

export type PluginUnsubscribe = () => void;
export type PluginSqlValue = string | number | null | Uint8Array;
export type PluginMigration = { version: number; sql: string };
export type PluginSql = {
  all: <T = Record<string, unknown>>(sql: string, params?: PluginSqlValue[]) => Promise<T[]>;
  get: <T = Record<string, unknown>>(
    sql: string,
    params?: PluginSqlValue[],
  ) => Promise<T | undefined>;
  run: (sql: string, params?: PluginSqlValue[]) => Promise<{ changes: number; lastID: number }>;
};
export type PluginDatabase = PluginSql & {
  transaction: <T>(work: (transaction: PluginSql) => Promise<T>) => Promise<T>;
};
export type PluginServicesContext = {
  database: { open: (name: string, migrations: PluginMigration[]) => Promise<PluginDatabase> };
  services: {
    provide: (name: string, version: string, service: object) => void;
    require: <T extends object>(pluginId: string, name: string, range: string) => T;
  };
  plugins: { listSports: () => PluginSportStatus[] };
  lifecycle: { onDispose: (handler: () => void | Promise<void>) => void };
  clock: {
    now: () => number;
    onSuspend: (handler: () => void) => PluginUnsubscribe;
    onResume: (handler: () => void) => PluginUnsubscribe;
  };
};
