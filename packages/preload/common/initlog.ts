import { ipcRenderer } from 'electron';

import debugFactory from 'debug';
import log from 'electron-log';

log.transports.file.level = 'info';
log.transports.file.fileName = `${import.meta.env.VITE_APP_NAME}.log`;
log.transports.console.level = false;

debugFactory.log = log.log.bind(log);

ipcRenderer.on('DEBUG', (_, ns: string) => debugFactory.enable(ns));
// import.meta.env.VITE_DEBUG && debugFactory.enable(import.meta.env.VITE_DEBUG);
export default log;
