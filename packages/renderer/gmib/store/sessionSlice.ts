import type { DeviceId, Display, Host } from '@nibus/core';
import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice, current } from '@reduxjs/toolkit';

export type SessionStatus = 'idle' | 'pending' | 'succeeded' | 'failed' | 'closed';

export type DeviceInfo = {
  address: string;
  owner: DeviceId | undefined;
  version?: number;
  type: number;
};

export type FinderState = {
  isSearching: boolean;
  detected: DeviceInfo[];
};

export interface SessionState extends Partial<Host> {
  status: SessionStatus;
  error: string | undefined;
  portCount: number;
  // devices: DeviceId[];
  online: boolean;
  displays: Display[];
  finder: FinderState;
}

export const deviceKey = ({ address, owner }: DeviceInfo): string =>
  `${owner}#${address.toString()}`;

const initialState: SessionState = {
  status: 'idle',
  error: undefined,
  portCount: 0,
  // devices: [],
  online: false,
  displays: [],
  finder: {
    isSearching: false,
    detected: [],
  },
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    releaseSession(state) {
      state.status = 'closed';
      state.online = false;
      state.portCount = 0;
      state.displays = [];
    },
    // reloadSession() {
    //   window.nibus.reloadDevices();
    // },
    setPortCount(state, { payload: portCount }: PayloadAction<number>) {
      state.portCount = portCount;
    },
    // setDevices(state, { payload: devices }: PayloadAction<DeviceId[]>) {
    //   state.devices = devices;
    // },
    setHostDescription(state, { payload: hostDesc }: PayloadAction<Host>) {
      Object.assign(state, hostDesc);
    },
    setOnline(state, { payload: online }: PayloadAction<boolean>) {
      state.online = online;
    },
    setDisplays(state, { payload: displays }: PayloadAction<Display[]>) {
      state.displays = displays;
    },
    setStatus(
      state,
      { payload: status }: PayloadAction<Pick<SessionState, 'status' | 'portCount' | 'error'>>,
    ) {
      Object.assign(state, status);
    },
    setSearching(state, { payload: isSearching }: PayloadAction<boolean>) {
      state.finder.isSearching = isSearching;
    },
    resetDetected(state) {
      state.finder.detected = [];
    },
    addDetected(state, { payload: device }: PayloadAction<DeviceInfo>) {
      const key = deviceKey(device);
      if (current(state.finder.detected).find(item => deviceKey(item) === key)) return;
      state.finder.detected.push(device);
    },
  },
});
export const {
  // setDevices,
  setHostDescription,
  setOnline,
  setDisplays,
  releaseSession,
  setStatus,
  // reloadSession,
  setPortCount,
  setSearching,
  resetDetected,
  addDetected,
} = sessionSlice.actions;

export default sessionSlice.reducer;
