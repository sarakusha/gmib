import { ipcRenderer } from 'electron';

// import debugFactory from 'debug';
import genSignature from '/@common/generateSignature';
import type { Credentials } from '/@common/Credentials';
import { host, port } from '/@common/remote';
// const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:identify`);
const credentials: Credentials = {};

// const query = new URLSearchParams(window.location.search);
// const host = query.get('host') ?? 'localhost';
// const port = +(query.get('port') ?? process.env.NIBUS_PORT ?? 9001) + 1;

const initialize = async () => {
  try {
    const response =
      host === 'localhost'
        ? await ipcRenderer.invoke('getLocalCredentials')
        : await ipcRenderer.invoke(
          'getRemoteCredentials',
          `http://${host}:${port + 1}/api/identifier`,
        );
    if (response) {
      credentials.identifier = response.identifier;
      credentials.apiSecret =
        response.apiSecret instanceof Uint8Array
          ? Buffer.from(
            response.apiSecret.buffer,
            response.apiSecret.byteOffset,
            response.apiSecret.byteLength,
          )
          : undefined;
    }
  } catch (e) {
    console.error('ERROR', e);
  }
};

export const getSecret = () => credentials.apiSecret?.toString('base64');

export const setSecret = (apiSecret: bigint, identifier = credentials.identifier) => {
  ipcRenderer.send('setRemoteSecret', identifier, apiSecret);
  credentials.apiSecret = Buffer.from(apiSecret.toString(16), 'hex');
};

export const getIdentifier = () => credentials.identifier;

export const generateSignature = (
  method: string,
  uri: string,
  timestamp: number,
  body?: unknown,
): string | undefined => {
  console.log({ secret: credentials.apiSecret, method, uri, timestamp, body: JSON.stringify(body) });
  return credentials.apiSecret && genSignature(credentials.apiSecret, method, uri, timestamp, body);
};

initialize();
