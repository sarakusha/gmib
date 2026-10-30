export type PluginOutputProfile = { screenId: number; pageId: string; autoStart: boolean };
export type PluginOutputApi = {
  applyLayout?: (layout: {
    profile: PluginOutputProfile;
    players?: Array<{ playerId: number; playing: boolean }>;
  }) => Promise<void>;
  listPlayers?: () => Promise<Array<{ id: number; name: string; playing: boolean }>>;
  setPlayerState?: (state: { playerId: number; playing: boolean }) => Promise<void>;
  listScreens: () => Promise<Array<{ id: number; name: string; width?: number; height?: number }>>;
  getStatus: () => Promise<{ profile?: PluginOutputProfile; active: boolean; message: string }>;
  start: (profile: PluginOutputProfile) => Promise<void>;
  stop: () => Promise<void>;
};
