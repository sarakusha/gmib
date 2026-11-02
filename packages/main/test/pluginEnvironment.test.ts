import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  ipc: new Map(),
  master: new Map(),
  location: undefined as unknown,
}));
vi.mock('electron', () => ({
  ipcMain: { on: (name: string, handler: unknown) => mocks.ipc.set(name, handler) },
}));
vi.mock('../src/MasterBrowser', () => ({
  default: { on: (name: string, handler: unknown) => mocks.master.set(name, handler) },
}));
vi.mock('../src/config', () => ({ default: { get: () => mocks.location } }));
import { createPluginEnvironment } from '../src/pluginEnvironment';
import type { PluginManifest } from '/@common/plugins';
const api = () => createPluginEnvironment({ permissions: ['environment.read'] } as PluginManifest);
beforeEach(() => {
  vi.useRealTimers();
  mocks.location = undefined;
});
it('checks permission on every read', async () => {
  await expect(createPluginEnvironment({} as PluginManifest).snapshot()).rejects.toThrow(
    'permission',
  );
});
it('uses central coordinates and consistent GMIB day/night events', async () => {
  mocks.location = { latitude: 55.75, longitude: 37.62 };
  const state = await api().snapshot();
  expect(state.solar.sunrise).toMatch(/^\d{4}-/);
  expect(state.solar.day).not.toBe(state.solar.sunrise);
  expect(state.timeZone).toBeTruthy();
  mocks.location = { latitude: 999, longitude: 37 };
  expect((await api().snapshot()).solar.sunrise).toBeNull();
});
it('shares auto brightness source selection and expires lost sensors', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-02T10:00:00Z'));
  mocks.ipc.get('sensors')({}, { address: 'sensor-a', illuminance: 20 });
  expect((await api().snapshot()).sensors[0].lux).toBe(20);
  vi.advanceTimersByTime(1000);
  mocks.master.get('illuminance')('sensor-b', 50);
  expect((await api().snapshot()).sensors[0]).toMatchObject({ id: 'gmib-autobrightness', lux: 50 });
  vi.advanceTimersByTime(61000);
  expect((await api().snapshot()).sensors).toEqual([]);
  vi.useRealTimers();
});
