import { contextBridge } from 'electron';

// import debugFactory from 'debug';

import log from '/@main/initlog';
import expandTypes from '/@common/expandTypes';
// import { setDispatch } from '/@common/ipcDispatch';

import * as nodeCrypto from './nodeCrypto';

// const search = new URLSearchParams(window.location.search);
// const sourceId = +(search.get('source_id') ?? 1);

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:player-preload-${sourceId}`);

// ipcRenderer.send('register-source-channel', sourceId);

contextBridge.exposeInMainWorld('nodeCrypto', expandTypes(nodeCrypto));
contextBridge.exposeInMainWorld('log', log.log.bind(log));
// contextBridge.exposeInMainWorld('setDispatch', setDispatch);
contextBridge.exposeInMainWorld('server', {
  port: +(process.env['NIBUS_PORT'] ?? 9001) + 1,
});
