import { ipcRenderer } from 'electron';
// import debugFactory from 'debug';
import genSignature from '/@common/generateSignature';
import type { Identity } from '/@common/Identity';

// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:identify`);
const identity: Identity = {};

const query = new URLSearchParams(window.location.search);
const host = query.get('host') ?? 'localhost';
const port = +(query.get('port') ?? 9001) + 1;

const initialize = async () => {
  try {
    const ident =
      host === 'localhost'
        ? await ipcRenderer.invoke('getLocalIdentification')
        : await ipcRenderer.invoke(
            'getRemoteIdentification',
            `http://${host}:${port}/api/identifier`,
          );
    if (ident) {
      identity.identifier = ident.identifier;
      identity.apiSecret =
        ident.apiSecret instanceof Uint8Array
          ? Buffer.from(
              ident.apiSecret.buffer,
              ident.apiSecret.byteOffset,
              ident.apiSecret.byteLength,
            )
          : undefined;
    }
  } catch (e) {
    console.error('ERROR', e);
  }
};

export const getSecret = () => identity.apiSecret?.toString('base64');

export const setSecret = (apiSecret: bigint) => {
  ipcRenderer.invoke('setRemoteSecret', identity.identifier, apiSecret);
  identity.apiSecret = Buffer.from(apiSecret.toString(16), 'hex');
};

export const getIdentifier = () => identity.identifier;

export const generateSignature = (
  method: string,
  uri: string,
  timestamp: number,
  body?: unknown,
): string | undefined =>
  identity.apiSecret && genSignature(identity.apiSecret, method, uri, timestamp, body);

initialize();
