/* eslint-disable no-bitwise */

import type { AddressParam, Display, LogLevel } from '@nibus/core';
import Address, { AddressType } from '@nibus/core/Address';
import { hasProps } from '@novastar/screen/common';
import { createSelector } from '@reduxjs/toolkit';
import maxBy from 'lodash/maxBy';
import pick from 'lodash/pick';

import type { ConfigState } from './configSlice';
import type { CurrentState, TabValues } from './currentSlice';
import type { DeviceState } from './devicesSlice';
import { devicesAdapter } from './devicesSlice';
import type { FlasherState } from './flasherSlice';
import { logAdapter } from './logSlice';
import { mibsAdapter } from './mibsSlice';
import { remoteHostsAdapter } from './remoteHostsSlice';
import type { SensorDictionary, SensorKind, SensorRecord, SensorsState } from './sensorsSlice';
import type { FinderState, SessionState } from './sessionSlice';
import { selectNovastarTelemetryById } from './telemetrySlice';

import type { RootState } from '.';

import type { Config, OverheatProtection } from '/@common/config';
import type { Health, ValueState } from '/@common/helpers';
import { notEmpty } from '/@common/helpers';

export const {
  selectAll: selectAllDevices,
  selectById: selectDeviceById,
  selectIds: selectDeviceIds,
} = devicesAdapter.getSelectors<RootState>(state => state.devices);

export const selectConfig = (state: RootState): ConfigState => state.config;
export const selectLoading = (state: RootState): boolean => selectConfig(state).loading;
export const selectDisableNet = (state: RootState): boolean => !!selectConfig(state).disableNet;
export const selectBrightness = (state: RootState): number => selectConfig(state).brightness;
export const selectAutobrightness = (state: RootState): boolean =>
  selectConfig(state).autobrightness;
export const selectSpline = (state: RootState): Config['spline'] => selectConfig(state).spline;
export const selectLocation = (state: RootState): Config['location'] =>
  selectConfig(state).location;
export const selectLogLevel = (state: RootState): LogLevel => selectConfig(state).logLevel;
export const selectSessionVersion = (state: RootState): string | undefined =>
  selectConfig(state).version;
export const selectOverheatProtection = (state: RootState): OverheatProtection | undefined =>
  selectConfig(state).overheatProtection;
export const selectCurrent = (state: RootState): CurrentState => state.current;
export const selectCurrentTab = (state: RootState): TabValues | undefined =>
  selectCurrent(state).tab;
export const selectCurrentDeviceId = (state: RootState): string | undefined =>
  selectCurrent(state).device;
export const selectIsRemoteDialogOpen = (state: RootState): boolean =>
  selectCurrent(state).isRemoteDialogOpen;
export const selectIsActivateDialogOpen = (state: RootState): boolean =>
  selectCurrent(state).isActivateDialogOpen;
export const selectCurrentScreenId = (state: RootState): number | undefined =>
  selectCurrent(state).screen;
export const selectCurrentDevice = (state: RootState): DeviceState | undefined => {
  const device = selectCurrentDeviceId(state);
  return device !== undefined ? selectDeviceById(state, device) : undefined;
};
export const selectCurrentHealth = (state: RootState): Health | undefined =>
  selectCurrent(state).health;
export const selectAuthRequired = (state: RootState) => selectCurrent(state).authRequired;
export const selectBroadcastDetected = (state: RootState) => selectCurrent(state).broadcastDetected;
export const selectInvalidState = (state: RootState) => selectCurrent(state).invalidState;
export const selectFocused = (state: RootState) => selectCurrent(state).focused;
export const selectTabChangedTimestamp = (state: RootState) =>
  selectCurrent(state).tabChangedTimestamp;

type PropsSelector = <P extends string>(
  state: RootState,
  id: string,
  ...names: P[]
) => Record<P, ValueState | undefined>;

export const selectProps: PropsSelector = createSelector(
  [
    (state: RootState) => state.devices,
    (_: RootState, id: string) => id,
    (_: RootState, id: string, names: string) => names,
  ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (devices, id, names) => pick(devices.entities[id], names.split(',')) as any,
);

export const selectLinks = createSelector(selectAllDevices, devices =>
  devices.filter(notEmpty).filter(({ isLinkingDevice }) => isLinkingDevice),
);

export const selectAllDevicesWithParent = createSelector(
  [selectAllDevices, state => state],
  (devices, state) =>
    devices.map(({ parent, ...props }) => ({
      ...props,
      parent: typeof parent !== 'undefined' ? selectDeviceById(state, parent) : undefined,
    })),
);
export const filterDevicesByAddress = <D extends Pick<DeviceState, 'address' | 'mib' | 'props'>>(
  devices: D[],
  addressParam: AddressParam,
): D[] => {
  const address = new Address(addressParam);
  return devices.filter(device => {
    if (address.equals(device.address)) return true;
    if (address.type === AddressType.net) {
      if (device.mib.startsWith('minihost')) {
        // console.log(`${device.props.domain?.raw}.${device.props.subnet?.raw}.${device.props.did?.raw}`);
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
    return (
      address.type === AddressType.mac &&
      typeof device.props.serno?.value === 'string' &&
      address.equals(device.props.serno.value)
    );
  });
};

export const selectDevicesByAddress: (state: RootState, address: AddressParam) => DeviceState[] =
  createSelector(
    [selectAllDevices, (state, address: AddressParam) => address],
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

const selectSpecialSensors = (state: RootState, kind: SensorKind) =>
  selectSensors(state).sensors[kind];
const selectLast = createSelector(selectSpecialSensors, sensors =>
  maxBy(Object.values(sensors).filter(hasCurrent), ({ current }) => current[0]),
);
export const selectLastWithAddress = createSelector(selectSpecialSensors, sensors => {
  const item = maxBy(
    Object.entries(sensors)
      .map(([address, state]) => [address, state?.current])
      .filter(([, current]) => current != null),
    ([, current]) => current?.[0],
  ) as [string, SensorRecord] | undefined;
  if (!item) return undefined;
  const [address, [timestamp, value]] = item;
  return `${address}:${timestamp}:${value}`;
});
const selectLastValue = createSelector(selectLast, last => last?.current?.[1]);
export const selectLastAverage = createSelector(selectLast, last => last?.average);
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
export const selectHostName = (state: RootState): string | undefined => selectSession(state).name;
export const selectPlatform = (state: RootState): string | undefined =>
  selectSession(state).platform;

export const { selectAll: selectLogLines } = logAdapter.getSelectors<RootState>(state => state.log);

const selectFlasher = (state: RootState): FlasherState => state.flasher;

export const selectProgress = (state: RootState): number => selectFlasher(state).progress;

export const selectFlashing = (state: RootState): boolean => selectFlasher(state).flashing;

export const selectTelemetry = (state: RootState) => state.telemetry;

export const selectNovastarTelemetry = (state: RootState, path: string) =>
  selectNovastarTelemetryById(selectTelemetry(state).novastar, path);
