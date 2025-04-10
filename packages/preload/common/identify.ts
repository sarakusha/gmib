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

const initialize = async (): Promise<boolean> => {
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
      return Boolean(credentials.apiSecret);
    }
  } catch (e) {
    console.error('ERROR', e);
  }
  return false;
};

export const getSecret = () => credentials.apiSecret?.toString('base64');

export const setSecret = (apiSecret: bigint | null, identifier = credentials.identifier) => {
  ipcRenderer.send('setRemoteSecret', identifier, apiSecret);
  if (apiSecret) credentials.apiSecret = Buffer.from(apiSecret.toString(16), 'hex');
};

export const getIdentifier = () => credentials.identifier;

export const generateSignature = async (
  method: string,
  uri: string,
  timestamp: number,
  body?: unknown,
): Promise<string | undefined> =>
  initialized.then(() => credentials.apiSecret && genSignature(credentials.apiSecret, method, uri, timestamp, body));

export const initialized = initialize();
