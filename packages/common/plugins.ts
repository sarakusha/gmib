export const GMIB_PLUGIN_API_VERSION = '1.0.0';

export const pluginPermissions = ['http.routes', 'storage', 'realtime', 'output.pages'] as const;

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

export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  description?: string;
  gmibApi: string;
  main?: string;
  public?: string;
  permissions?: PluginPermission[];
  pages?: PluginOutputPage[];
  control?: PluginControlPage;
};

export type PluginStatus = {
  manifest: PluginManifest;
  enabled: boolean;
  loaded: boolean;
  restartRequired: boolean;
  error?: string;
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
      plugin: PluginStatus;
      updated: boolean;
      restartRequired: true;
    };
