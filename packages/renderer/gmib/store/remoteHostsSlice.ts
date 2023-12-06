import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';

import type { RemoteHost } from '/@common/helpers';

// import debugFactory from '../util/debug';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:remoteHostsSlice`);

type Remote = Pick<RemoteHost, 'address' | 'port'> & Omit<Partial<RemoteHost>, 'address' | 'port'>;

export const getRemoteId = ({ address, port }: Remote): string => `${address}:${port}`;

export const remoteHostsAdapter = createEntityAdapter<Remote, string>({ selectId: getRemoteId });

const remoteSlice = createSlice({
  name: 'remoteHosts',
  initialState: remoteHostsAdapter.getInitialState(),
  reducers: {
    addRemoteHost: remoteHostsAdapter.addOne,
    removeRemoteHost: remoteHostsAdapter.removeOne,
  },
});

export const { addRemoteHost, removeRemoteHost } = remoteSlice.actions;

export default remoteSlice;
