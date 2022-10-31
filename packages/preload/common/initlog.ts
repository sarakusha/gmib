import type { LogLevel } from '@nibus/core/common';
import debugFactory from 'debug';
import log from 'electron-log';


log.transports.file.level = 'info';
log.transports.file.fileName = `${import.meta.env.VITE_APP_NAME}.log`;
log.transports.console.level = false;

debugFactory.log = log.log.bind(log);

// ipcRenderer.on('DEBUG', (_, ns: string) => debugFactory.enable(ns));
// import.meta.env.VITE_DEBUG && debugFactory.enable(import.meta.env.VITE_DEBUG);
export const setLogLevel = (logLevel: LogLevel) => {
  const ns =
    import.meta.env.VITE_DEBUG && logLevel === 'none'
      ? `${import.meta.env.VITE_DEBUG},-novastar:encoder,-novastar:decoder`
      : import.meta.env.VITE_DEBUG;
  if (ns) {
    debugFactory.enable(ns);
  }
};

export default log;
