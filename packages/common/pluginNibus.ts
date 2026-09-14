import type { PluginUnsubscribe } from './pluginServices';
export type PluginTimerState = {
  valueMs: number;
  running: boolean;
  mode: 'game' | 'rest' | 'timeout';
};
export type PluginScoreboardState = { home: number; away: number; period: number };
export type PluginPenaltyState = { number: string; remainingMs: number };
export type PluginPenaltiesState = { home: PluginPenaltyState[]; away: PluginPenaltyState[] };
export type PluginTeamsState = { home: string; away: string };
export type PluginNibusConnection = { id: string; name: string };
export type PluginInformationReport = { connectionId: string; source: string } & (
  | { kind: 'timer'; value: Partial<PluginTimerState> }
  | { kind: 'score'; side: 'home' | 'away'; value: number }
  | { kind: 'period'; value: number }
  | { kind: 'penalties'; value: PluginPenaltiesState }
  | { kind: 'teamName'; side: 'home' | 'away'; value: string }
);
export type PluginNibusOutput = {
  sendTimer: (state: PluginTimerState) => Promise<void>;
  sendScoreboard: (state: PluginScoreboardState) => Promise<void>;
  sendPenalties: (state: PluginPenaltiesState) => Promise<void>;
  sendTeams: (state: PluginTeamsState) => Promise<void>;
  release: () => Promise<void>;
};
export type PluginNibusApi = {
  listConnections: () => Promise<PluginNibusConnection[]>;
  onConnectionChange: (
    handler: (connections: PluginNibusConnection[]) => void,
  ) => PluginUnsubscribe;
  onInformationReport: (
    filter: { connectionId?: string; source?: string; kinds?: PluginInformationReport['kind'][] },
    handler: (report: PluginInformationReport) => void,
  ) => PluginUnsubscribe;
  acquireOutput: (options: {
    connectionId: string;
    target: string;
    profile: 'matchpad';
  }) => Promise<PluginNibusOutput>;
};
