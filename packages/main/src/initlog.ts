import debugFactory from 'debug';
import log from 'electron-log';

import config from './config';

log.transports.file.level = 'info';
log.transports.file.fileName = `${import.meta.env.VITE_APP_NAME}.log`;
log.transports.console.level = false;

debugFactory.log = log.log.bind(log);
// import.meta.env.VITE_DEBUG && debugFactory.enable(import.meta.env.VITE_DEBUG);

const updateDebugger = () => {
  const logLevel = config.get('logLevel');
  const ns =
    import.meta.env.VITE_DEBUG && logLevel === 'none'
      ? `${import.meta.env.VITE_DEBUG},-novastar:encoder,-novastar:decoder`
      : import.meta.env.VITE_DEBUG;
  if (ns) {
    debugFactory.enable(ns);
  }
};

updateDebugger();

config.onDidChange('logLevel', updateDebugger);

export default log;
