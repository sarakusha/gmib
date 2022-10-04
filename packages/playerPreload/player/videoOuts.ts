import { ipcRenderer } from 'electron';
import isEqual from 'lodash/isEqual';
import debugFactory from 'debug';
import Deferred from '/@common/Deferred';
import type { PlayerMapping } from '/@common/video';

import stream from './mediaStream';

const search = new URLSearchParams(window.location.search);
const sourceId = +(search.get('source_id') ?? 1);

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:videoOut`);

const toOutputQuery = (mapping: PlayerMapping): string => {
  const query = new URLSearchParams();
  Object.entries(mapping).forEach(([name, value]) => {
    query.set(name, typeof value === 'string' ? value : Number(value).toString());
  });
  return query.toString();
};

type Entry = {
  window: Window;
  port: MessagePort;
  mapping: PlayerMapping;
};

const videoOuts = new Map<number, Entry>();

const createVideoOut = (mapping: PlayerMapping): void => {
  // const url = '/output/index.html?display=2026412505&output_id=2&width=800&height=600';
  const url = `/output/index.html?${toOutputQuery(mapping)}`;
  const { port1, port2 } = new MessageChannel();
  const win = window.open(url, '_blank');
  if (!win) {
    debug(`can not create videoOut ${url}`);
    return;
  }
  win.addEventListener(
    'load',
    () => {
      win.postMessage('provide-channel', '*', [port2]);
      debug(`create videoOut: ${url}`);
      setTimeout(() => {
        const list = win.document.querySelectorAll('video');
        list.forEach(elem => {
          // eslint-disable-next-line no-param-reassign
          elem.srcObject = stream;
          debug(`set stream ${elem}: ${stream}`);
        });
      }, 1000);
    },
    { once: true },
  );
  win.onerror = (ev, source, lineno, colno, error) => {
    debug(`error while create ${url}: ${error}`);
  };
  videoOuts.set(mapping.id, { window: win, port: port1, mapping });
};

export const update = async () => {
  const mappings: PlayerMapping[] = await ipcRenderer.invoke('getPlayerMappings', sourceId);
  const ids = mappings.map(({ id }) => id);
  [...videoOuts].forEach(([id, entry]) => {
    if (!ids.includes(id)) entry.window.close();
  });
  mappings.forEach(mapping => {
    const entry = videoOuts.get(mapping.id);
    if (!entry) {
      createVideoOut(mapping);
    } else if (!isEqual(entry.mapping, mapping)) {
      entry.window.close();
      createVideoOut(mapping);
    }
  });
};

ipcRenderer.on('updateVideoOuts', update);

update();

// window.addEventListener('load', update);

export default videoOuts;
