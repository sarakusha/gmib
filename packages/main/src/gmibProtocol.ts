import type { App } from 'electron';
import { isIPv4 } from 'node:net';

export type GmibLinkTarget = { host: string; port: number };

/** Links select an existing remote connection; they never carry commands or credentials. */
export const parseGmibLink = (value: string): GmibLinkTarget | undefined => {
  const match = /^gmib:\/\/([a-z0-9.-]+)(?::([0-9]{1,5}))?\/?$/i.exec(value);
  if (!match || match[0] !== value) return undefined;
  const host = match[1].toLowerCase();
  const port = match[2] === undefined ? 9001 : Number(match[2]);
  if (port < 1 || port > 65534 || host.length > 253) return undefined;
  if (/^[0-9.]+$/.test(host)) {
    if (!isIPv4(host)) return undefined;
  } else if (!host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)))
    return undefined;
  return { host, port };
};

type ProtocolOptions = {
  argv: readonly string[];
  kiosk: boolean;
  open: (target: GmibLinkTarget) => void;
  activate: () => void;
  onError: (message: string) => void;
};

/** Register synchronously, then release queued links only after application bootstrap. */
export const installGmibProtocol = (
  application: Pick<App, 'on' | 'isPackaged' | 'setAsDefaultProtocolClient'>,
  options: ProtocolOptions,
): { ready: () => void } => {
  let ready = false;
  const pending = new Map<string, GmibLinkTarget>();
  let activatePending = false;
  const open = (target: GmibLinkTarget): void => {
    try {
      options.open(target);
    } catch {
      options.onError('Не удалось открыть подключение по ссылке GMIB.');
    }
  };
  const accept = (value: string): void => {
    if (options.kiosk) return;
    const target = parseGmibLink(value);
    if (!target) {
      options.onError('Некорректная ссылка GMIB: ожидается gmib://host[:port].');
      return;
    }
    if (ready) open(target);
    else pending.set(`${target.host}:${target.port}`, target);
  };
  const acceptArgs = (args: readonly string[]): boolean => {
    const links = args.filter(arg => /^gmib:/i.test(arg));
    links.forEach(accept);
    return links.length > 0;
  };
  application.on('open-url', (event, url) => {
    event.preventDefault();
    accept(url);
  });
  application.on('second-instance', (_event, argv) => {
    if (!acceptArgs(argv)) {
      if (ready) options.activate();
      else activatePending = true;
    }
  });
  acceptArgs(options.argv);
  // Do not replace the installed protocol handler when running a development checkout.
  if (application.isPackaged && !options.kiosk) {
    try {
      if (!application.setAsDefaultProtocolClient('gmib')) {
        options.onError('Не удалось зарегистрировать обработчик ссылок GMIB.');
      }
    } catch {
      options.onError('Не удалось зарегистрировать обработчик ссылок GMIB.');
    }
  }
  return {
    ready: () => {
      ready = true;
      if (activatePending) options.activate();
      activatePending = false;
      pending.forEach(open);
      pending.clear();
    },
  };
};

type LinkWindow = {
  show: () => void;
  focus: () => void;
  isDestroyed: () => boolean;
  once: (event: 'closed', listener: () => void) => unknown;
};

export const createGmibLinkOpener = (options: {
  localPort: number;
  activateLocal: () => void;
  find: (target: GmibLinkTarget) => LinkWindow | undefined;
  create: (target: GmibLinkTarget) => LinkWindow;
}): ((target: GmibLinkTarget) => void) => {
  // Window registration waits for the remote announcement; reserve immediately instead.
  const opened = new Map<string, LinkWindow>();
  return target => {
    if (target.host === 'localhost' && target.port === options.localPort) {
      options.activateLocal();
      return;
    }
    const remote = target.host === 'localhost' ? { ...target, host: '127.0.0.1' } : target;
    const key = `${remote.host}:${remote.port}`;
    const existing = opened.get(key) ?? options.find(remote);
    const window = existing && !existing.isDestroyed() ? existing : options.create(remote);
    if (opened.get(key) !== window) {
      opened.set(key, window);
      window.once('closed', () => {
        if (opened.get(key) === window) opened.delete(key);
      });
    }
    window.show();
    window.focus();
  };
};
