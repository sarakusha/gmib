export type PluginEnvironmentSnapshot = {
  timeZone: string;
  solar: {
    sunrise: string | null;
    day: string | null;
    sunset: string | null;
    night: string | null;
  };
  solarDays?: PluginEnvironmentSnapshot['solar'][];
  sensors: { id: string; name: string; lux: number; updatedAt: string }[];
};
export type PluginEnvironmentApi = { snapshot: () => Promise<PluginEnvironmentSnapshot> };
