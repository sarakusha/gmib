import { contextBridge } from 'electron';

/** Expose only the API's own entries, keeping its inferred type as the renderer contract. */
const exposeApi = (api: Record<string, unknown>): void => {
  for (const [name, value] of Object.entries(api)) {
    contextBridge.exposeInMainWorld(name, value);
  }
};

export default exposeApi;
