import debugFactory from 'debug';
import log from 'electron-log';

import config from './config';

// The tab container has no renderer IPC context. Keep logs in the file instead
// of broadcasting each main-process message to every BrowserWindow in dev.
log.transports.ipc.level = false;
log.initialize();
log.transports.file.level = 'info';
log.transports.file.fileName = `${import.meta.env.VITE_APP_NAME}.log`;
log.transports.console.level = false;

debugFactory.log = log.log.bind(log);
// import.meta.env.VITE_DEBUG && debugFactory.enable(import.meta.env.VITE_DEBUG);

const updateDebugger = () => {
  const logLevel = config.get('logLevel');
  const exclusions = ['-novastar:net'];
  if (logLevel === 'none') exclusions.push('-novastar:encoder', '-novastar:decoder');
  const ns = import.meta.env.VITE_DEBUG && `${import.meta.env.VITE_DEBUG},${exclusions.join(',')}`;
  if (ns) {
    debugFactory.enable(ns);
  }
};

updateDebugger();

config.onDidChange('logLevel', updateDebugger);

export default log;
