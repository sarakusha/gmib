/// <reference types="vite/client" />

/**
 * Describes all existing environment variables and their types.
 * Required for Code completion and type checking
 *
 * Note: To prevent accidentally leaking env variables to the client, only variables prefixed with `VITE_` are exposed to your Vite-processed code
 *
 * @see https://github.com/vitejs/vite/blob/cab55b32de62e0de7d7789e8c2a1f04a8eae3a3f/packages/vite/types/importMeta.d.ts#L62-L69 Base Interface
 * @see https://vitejs.dev/guide/env-and-mode.html#env-files Vite Env Variables Doc
 */
interface ImportMetaEnv {
  /**
   * The value of the variable is set in scripts/watch.js and depend on packages/main/vite.config.js
   */
  readonly VITE_DEV_SERVER_URL: undefined | string;
  readonly VITE_PLAYER_DEV_SERVER_URL: undefined | string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_DEBUG?: string;
  readonly VITE_PLAYER?: '0' | '1';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
