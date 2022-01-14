/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { ipcRenderer } from 'electron';
import type { RemoteHost } from '../util/helpers';
import { AsyncInitializer } from './asyncInitialMiddleware';
import type { RootState } from './index';
// import debugFactory from '../util/debug';

// const debug = debugFactory('gmib:remoteHostsSlice');

type Remote = Pick<RemoteHost, 'address' | 'port'> & Omit<Partial<RemoteHost>, 'address' | 'port'>;

const selectId = ({ address, port }: Remote): string => `${address}:${port}`;

const remoteHostsAdapter = createEntityAdapter<Remote>({ selectId });

export const {
  selectById: selectRemoteHostById,
  selectAll: selectAllRemoteHosts,
} = remoteHostsAdapter.getSelectors<RootState>(state => state.remoteHosts);

const remoteSlice = createSlice({
  name: 'remoteHosts',
  initialState: remoteHostsAdapter.getInitialState(),
  reducers: {
    addRemoteHost: remoteHostsAdapter.addOne,
    removeRemoteHost: remoteHostsAdapter.removeOne,
  },
});

export const { addRemoteHost, removeRemoteHost } = remoteSlice.actions;

export const initializeRemoteHosts: AsyncInitializer = async dispatch => {
  // debug('InitializeRemoteHosts');
  ipcRenderer.on('serviceUp', (event, remoteHost: RemoteHost) => {
    // debug('serviceUp');
    dispatch(addRemoteHost(remoteHost));
  });
  ipcRenderer.on('serviceDown', (event, remoteHost: RemoteHost) => {
    // debug('serviceDown');
    dispatch(removeRemoteHost(selectId(remoteHost)));
  });
};

export default remoteSlice.reducer;
