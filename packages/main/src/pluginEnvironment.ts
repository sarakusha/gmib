import { ipcMain } from 'electron';
import * as SunCalc from 'suncalc';
import config from './config';
import master from './MasterBrowser';
import sensorsSlice, { calculate, pushSensorValue } from '../../renderer/gmib/store/sensorsSlice';
import type { PluginManifest } from '/@common/plugins';
import type { PluginEnvironmentApi } from '/@common/pluginEnvironment';

// Reuse auto-brightness filtering and stale-sample rules, not a second lux algorithm.
let sensors = sensorsSlice.getInitialState();
const record = (address: string, value: number) => {
  if (typeof address !== 'string' || !Number.isFinite(value) || value < 0) return;
  sensors = sensorsSlice.reducer(sensors, pushSensorValue({ kind: 'illuminance', address, value }));
  sensors = sensorsSlice.reducer(sensors, calculate());
};
ipcMain.on('sensors', (_event, data: { address: string; illuminance?: number }) => {
  if (data && typeof data.illuminance === 'number') record(data.address, data.illuminance);
});
master.on('illuminance', record);

export const createPluginEnvironment = (manifest: PluginManifest): PluginEnvironmentApi => ({
  snapshot() {
    return Promise.resolve().then(() => {
      if (!manifest.permissions?.includes('environment.read'))
        throw new Error('environment.read permission required');
      const { latitude, longitude } = config.get('location') ?? {};
      const valid =
        typeof latitude === 'number' &&
        Number.isFinite(latitude) &&
        Math.abs(latitude) <= 90 &&
        typeof longitude === 'number' &&
        Number.isFinite(longitude) &&
        Math.abs(longitude) <= 180;

      const iso = (value: Date | null | undefined) =>
        value && Number.isFinite(value.getTime()) ? value.toISOString() : null;
      const solarDays = [-1, 0, 1].map(offset => {
        const date = new Date();
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() + offset);
        const times = valid ? SunCalc.getTimes(date, latitude, longitude) : undefined;
        return {
          sunrise: iso(times?.sunrise),
          day: iso(times?.goldenHourEnd),
          sunset: iso(times?.sunset),
          night: iso(times?.dusk),
        };
      });
      sensors = sensorsSlice.reducer(sensors, calculate());
      const latest = Object.entries(sensors.sensors.illuminance)
        .filter(([, value]) => value.current && value.average !== undefined)
        .sort((a, b) => b[1].current![0] - a[1].current![0])[0];
      return {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        solar: solarDays[1],
        solarDays,
        sensors: latest
          ? [
              {
                id: 'gmib-autobrightness',
                name: `Автояркость GMIB (${latest[0]})`,
                lux: latest[1].average!,
                updatedAt: new Date(latest[1].current![0]).toISOString(),
              },
            ]
          : [],
      };
    });
  },
});
