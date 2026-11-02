import type { SunEvent } from './config';

export type PluginEnvironmentSnapshot = {
  timeZone: string;
  solar: Record<SunEvent | 'day' | 'night', string | null>;
  solarDays?: PluginEnvironmentSnapshot['solar'][];
  sensors: { id: string; name: string; lux: number; updatedAt: string }[];
};
export type PluginEnvironmentApi = { snapshot: () => Promise<PluginEnvironmentSnapshot> };
