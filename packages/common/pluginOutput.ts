export type PluginOutputProfile = { screenId: number; pageId: string; autoStart: boolean };
export type PluginOutputApi = {
  listScreens: () => Promise<Array<{ id: number; name: string; width?: number; height?: number }>>;
  getStatus: () => Promise<{ profile?: PluginOutputProfile; active: boolean; message: string }>;
  start: (profile: PluginOutputProfile) => Promise<void>;
  stop: () => Promise<void>;
};
