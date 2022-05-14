import type { AddressParam, DeviceId, Display, LogLevel } from '@nibus/core/lib';
import Address, { AddressType } from '@nibus/core/lib/Address';
import { hasProps } from '@novastar/screen/lib/common';
import { createSelector } from '@reduxjs/toolkit';
import maxBy from 'lodash/maxBy';
import pick from 'lodash/pick';

import type { ConfigState } from './configSlice';
import type { CurrentState, TabValues } from './currentSlice';
import type { DeviceProps, DeviceState, DeviceStateWithParent } from './devicesSlice';
import { devicesAdapter } from './devicesSlice';
import type {FlasherState} from './flasherSlice';
import { logAdapter } from './logSlice';
import { mibsAdapter } from './mibsSlice';
import { novastarsAdapter } from './novastarsSlice';
import { remoteHostsAdapter } from './remoteHostsSlice';
import type { SensorDictionary, SensorKind, SensorsState, SensorState } from './sensorsSlice';
import type { FinderState, SessionState } from './sessionSlice';

import type { RootState } from './index';

import type { Config, OverheatProtection, Page, Screen } from '/@common/config';
import type { Health, ValueState } from '/@common/helpers';
import { findById, notEmpty } from '/@common/helpers';


export const {
  selectAll: selectAllDevices,
  selectById: selectDeviceById,
  selectIds: selectDeviceIds,
} = devicesAdapter.getSelectors<RootState>(state => state.devices);

export const {
  selectAll: selectAllNovastars,
  selectById: selectNovastarByPath,
  selectIds: selectNovastarIds,
} = novastarsAdapter.getSelectors<RootState>(state => state.novastars);

export const selectNovastarScreen = createSelector(
  [selectNovastarByPath, (_state, _path, screen: number) => screen],
  (novastar, screen) => novastar?.screens?.[screen],
);

export const selectConfig = (state: RootState): ConfigState => state.config;
export const selectLoading = (state: RootState): boolean => selectConfig(state).loading;
export const selectBrightness = (state: RootState): number => selectConfig(state).brightness;
export const selectAutobrightness = (state: RootState): boolean =>
  selectConfig(state).autobrightness;
export const selectSpline = (state: RootState): Config['spline'] => selectConfig(state).spline;
export const selectLocation = (state: RootState): Config['location'] =>
  selectConfig(state).location;
export const selectScreens = (state: RootState): Screen[] => selectConfig(state).screens;
export const selectScreenById = (state: RootState, id?: string): Screen | undefined =>
  (id && findById(selectConfig(state).screens, id)) || undefined;
export const selectLogLevel = (state: RootState): LogLevel => selectConfig(state).logLevel;
export const selectAllPages = (state: RootState): Page[] => selectConfig(state).pages;
export const selectPageById = (state: RootState, id: string): Page | undefined =>
  findById(selectAllPages(state), id);
export const selectSessionVersion = (state: RootState): string | undefined =>
  selectConfig(state).version;
export const selectScreenAddresses = (state: RootState): string[] =>
  [
    ...new Set(
      selectScreens(state).reduce<string[]>(
        (res, { addresses }) =>
          addresses ? [...res, ...addresses.map(address => address.replace(/[+-].*$/, ''))] : res,
        [],
      ),
    ),
  ].sort();
export const selectOverheatProtection = (state: RootState): OverheatProtection | undefined =>
  selectConfig(state).overheatProtection;
export const selectCurrent = (state: RootState): CurrentState => state.current;
export const selectCurrentTab = (state: RootState): TabValues | undefined =>
  selectCurrent(state).tab;
export const selectCurrentDeviceId = (state: RootState): string | undefined =>
  selectCurrent(state).device;
export const selectIsRemoteDialogOpen = (state: RootState): boolean =>
  selectCurrent(state).isRemoteDialogOpen;
export const selectCurrentScreenId = (state: RootState): string | undefined =>
  selectCurrent(state).screen;
export const selectCurrentDevice = (state: RootState): DeviceState | undefined => {
  const device = selectCurrentDeviceId(state);
  return device !== undefined ? selectDeviceById(state, device) : undefined;
};
export const selectCurrentHealth = (state: RootState): Health | undefined =>
  selectCurrent(state).health;
export const selectNovastarIsBusy = (state: RootState): boolean => {
  const path = selectCurrentDeviceId(state);
  const novastar = path !== undefined && selectNovastarByPath(state, path);
  return Boolean(novastar && novastar.isBusy > 0);
};

export const selectAllProps = (state: RootState, id: DeviceId): DeviceProps =>
  selectDeviceById(state, id)?.props ?? {};
export const selectProps = <P extends string>(
  state: RootState,
  id: DeviceId,
  ...names: P[]
): Record<P, ValueState | undefined> =>
  pick(selectAllProps(state, id) as Record<P, ValueState | undefined>, names);
export const selectLinkIds = (state: RootState): DeviceId[] =>
  Object.values(state.devices.entities)
    .filter(notEmpty)
    .filter(({ isLinkingDevice }) => isLinkingDevice)
    .map(({ id }) => id);
export const selectLinks = (state: RootState): DeviceState[] =>
  selectLinkIds(state)
    .map(id => selectDeviceById(state, id))
    .filter(notEmpty);
export const selectAllDevicesWithParent = (state: RootState): DeviceStateWithParent[] =>
  selectAllDevices(state).map(({ parent, ...props }) => ({
    ...props,
    parent: typeof parent !== 'undefined' ? selectDeviceById(state, parent) : undefined,
  }));
export const filterDevicesByAddress = <D extends Pick<DeviceState, 'address' | 'mib' | 'props'>>(
  // export const filterDevicesByAddress = <D extends { address: Address; mib: string; props: {
  // domain?: number, subnet?} }>(
  devices: D[],
  address: Address,
): D[] =>
  devices.filter(device => {
    if (address.type === AddressType.mac) return address.equals(device.address);
    if (address.type === AddressType.net) {
      if (device.mib.startsWith('minihost')) {
        // debug(`${device.props.domain?.raw}.${device.props.subnet?.raw}.${device.props.did?.raw}`);
        return (
          address.domain === device.props.domain?.raw &&
          address.subnet === device.props.subnet?.raw &&
          address.device === device.props.did?.raw
        );
      }
      if (device.mib === 'mcdvi') {
        return (
          address.domain === 255 &&
          device.props.subnet?.raw === address.subnet &&
          address.device === device.props.did?.raw
        );
      }
    }
    return false;
  });
export const selectDevicesByAddress: (state: RootState, address: AddressParam) => DeviceState[] =
  createSelector(
    [selectAllDevices, (state, address: AddressParam) => new Address(address)],
    filterDevicesByAddress,
  );

export const { selectById: selectMibByName } = mibsAdapter.getSelectors<RootState>(
  state => state.mibs,
);

export const { selectAll: selectAllRemoteHosts } = remoteHostsAdapter.getSelectors<RootState>(
  state => state.remoteHosts,
);
export const selectSensors = (state: RootState): SensorsState => state.sensors;
const hasCurrent = hasProps('current');
const selectLast = (state: RootState, kind: SensorKind): SensorState | undefined => {
  const sensors = selectSensors(state).sensors[kind];
  return maxBy(Object.values(sensors).filter(hasCurrent), ({ current }) => current[0]);
};
const selectLastValue = (state: RootState, kind: SensorKind): number | undefined => {
  const [, max] = selectLast(state, kind)?.current ?? [];
  return max;
  // const sensors = state.sensors.sensors[kind];
  // const [, max] =
  //   maxBy(
  //     Object.values(sensors)
  //       .map(({ current }) => current)
  //       .filter(notEmpty),
  //     ([timestamp]) => timestamp
  //   ) ?? [];
  // return max;
};
export const selectLastAverage = (state: RootState, kind: SensorKind): number | undefined =>
  selectLast(state, kind)?.average;
export const selectIlluminance = (state: RootState): SensorDictionary =>
  selectSensors(state).sensors.illuminance;
export const selectInterval = (state: RootState): number => selectSensors(state).interval;
export const selectLastIlluminance = (state: RootState): number | undefined =>
  selectLastValue(state, 'illuminance');
export const selectCurrentIlluminance = (state: RootState, address: string): number | undefined =>
  selectIlluminance(state)[address]?.current?.[1];
export const selectTemperature = (state: RootState): SensorDictionary =>
  selectSensors(state).sensors.temperature;
export const selectLastTemperature = (state: RootState): number | undefined =>
  selectLastValue(state, 'temperature');
export const selectCurrentTemperature = (state: RootState, address: string): number | undefined =>
  selectTemperature(state)[address]?.current?.[1];
export const selectSession = (state: RootState): SessionState => state.session;
export const selectIsOnline = (state: RootState): boolean => selectSession(state).online;
export const selectIsClosed = (state: RootState): boolean =>
  selectSession(state).status === 'closed';
export const selectDisplays = (state: RootState): Display[] => selectSession(state).displays;
export const selectFinder = (state: RootState): FinderState => selectSession(state).finder;

export const { selectAll: selectLogLines } = logAdapter.getSelectors<RootState>(state => state.log);

const selectFlasher = (state: RootState): FlasherState => state.flasher;

export const selectProgress = (state: RootState): number => selectFlasher(state).progress;

export const selectFlashing = (state: RootState): boolean => selectFlasher(state).flashing;
