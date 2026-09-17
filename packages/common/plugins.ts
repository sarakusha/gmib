export const GMIB_PLUGIN_API_VERSION = '1.1.0';

export const pluginPermissions = [
  'http.routes',
  'storage',
  'realtime',
  'output.pages',
  'database',
  'services.provide',
  'services.consume',
  'plugins.read',
  'output.control',
  'nibus.read',
  'nibus.write',
] as const;

export type PluginPermission = (typeof pluginPermissions)[number];

export type PluginOutputPage = {
  id: string;
  title: string;
  path: string;
};

export type PluginControlPage = {
  title?: string;
  path: string;
};

export type PluginSport = {
  id: string;
  name: string;
  rosterVersion: number;
  positions: Array<{ id: string; name: string }>;
};

export type PluginSportStatus = PluginSport & {
  pluginId: string;
  installed: boolean;
  enabled: boolean;
  ready: boolean;
  error?: string;
};

export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  description?: string;
  gmibApi: string;
  main?: string;
  public?: string;
  permissions?: PluginPermission[];
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  contributes?: { sports: PluginSport[] };
  localOnly?: boolean;
  pages?: PluginOutputPage[];
  control?: PluginControlPage;
};

export type PluginStatus = {
  manifest: PluginManifest;
  enabled: boolean;
  loaded: boolean;
  runningEnabled: boolean;
  runningVersion?: string;
  restartRequired: boolean;
  archiveSha256?: string;
  error?: string;
};

export type PluginInstallConsent = {
  permissions: PluginPermission[];
  trustedBackend: boolean;
};

export type PluginArchiveInspection = {
  manifest: PluginManifest;
  sha256: string;
  size: number;
  installed?: PluginStatus;
};

export type PluginLifecycleInstallResult = {
  changed: boolean;
  updated: boolean;
  plugin: PluginStatus;
  restartRequired: boolean;
};

export type PluginLifecycleUninstallResult = {
  changed: boolean;
  restartRequired: boolean;
};

export type PluginCatalogPublisher = {
  id: string;
  name: string;
  verified: boolean;
};

export type PluginCatalogRelease = {
  url: string;
  sha256: string;
  size: number;
};

export type PluginCatalogEntry = {
  manifest: PluginManifest;
  publisher: PluginCatalogPublisher;
  repository: string;
  release: PluginCatalogRelease;
};

export type PluginInstallResult =
  | {
      status: 'cancelled';
    }
  | {
      status: 'installed';
      changed: boolean;
      plugin: PluginStatus;
      updated: boolean;
      restartRequired: boolean;
    };
