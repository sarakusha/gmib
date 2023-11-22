/* eslint-disable no-param-reassign */
import { app, shell } from 'electron';
import { URL } from 'url';

import debugFactory from 'debug';

import { port } from './config';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:sec`);

const localhost = `http://localhost:${port}`;

const allPermissions = [
  'clipboard-read',
  'clipboard-sanitized-write',
  'display-capture',
  'fullscreen',
  'geolocation',
  'idle-detection',
  'keyboardLock',
  'media',
  'mediaKeySystem',
  'midi',
  'midiSysex',
  'notifications',
  'pointerLock',
  'openExternal',
  'window-management',
  'unknown',
] as const;
// type AllPermissions = Parameters<Exclude<Parameters<WebContents['session']['setPermissionRequestHandler']>[0], null | undefined>>[1];

type AllPermissions = (typeof allPermissions)[number];

const fullGrant: Set<AllPermissions> = new Set(allPermissions);

type Permissions = Set<AllPermissions>;
/**
 * List of origins that you allow open INSIDE the application and permissions for each of them.
 *
 * In development mode you need allow open `VITE_DEV_SERVER_URL`
 */
const ALLOWED_ORIGINS_AND_PERMISSIONS = new Map<string, Permissions>([[localhost, fullGrant]]);

if (import.meta.env.DEV) {
  if (import.meta.env.VITE_DEV_SERVER_URL) {
    ALLOWED_ORIGINS_AND_PERMISSIONS.set(
      import.meta.env.VITE_DEV_SERVER_URL.replace(/\/$/, ''),
      fullGrant,
    );
  }
}

/**
 * List of origins that you allow open IN BROWSER.
 * Navigation to origins below is possible only if the link opens in a new window
 *
 * @example
 * <a
 *   target="_blank"
 *   href="https://github.com/"
 * >
 */
const ALLOWED_EXTERNAL_ORIGINS = new Set<string>(['https://github.com', localhost]);

app.on('web-contents-created', (_, contents) => {
  /**
   * Block navigation to origins not on the allowlist.
   *
   * Navigation is a common attack vector. If an attacker can convince the app to navigate away
   * from its current page, they can possibly force the app to open websites on the Internet.
   *
   * @see https://www.electronjs.org/docs/latest/tutorial/security#13-disable-or-limit-navigation
   */
  contents.on('will-navigate', (event, url) => {
    const { origin } = new URL(url);
    if (ALLOWED_ORIGINS_AND_PERMISSIONS.has(origin)) {
      return;
    }

    // Prevent navigation
    event.preventDefault();

    debug(
      `Blocked navigating to an unallowed origin: ${origin}: ${JSON.stringify([
        ...ALLOWED_ORIGINS_AND_PERMISSIONS,
      ])}`,
    );
  });

  /**
   * Block requested unallowed permissions.
   * By default, Electron will automatically approve all permission requests.
   *
   * @see https://www.electronjs.org/docs/latest/tutorial/security#5-handle-session-permission-requests-from-remote-content
   */
  contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const { origin } = new URL(webContents.getURL());

    const permissionGranted = !!ALLOWED_ORIGINS_AND_PERMISSIONS.get(origin)?.has(permission);
    callback(permissionGranted);

    if (!permissionGranted) {
      debug(`${origin} requested permission for '${permission}', but was blocked.`);
    }
  });

  /**
   * Hyperlinks to allowed sites open in the default browser.
   *
   * The creation of new `webContents` is a common attack vector. Attackers attempt to convince the app to create new windows,
   * frames, or other renderer processes with more privileges than they had before; or with pages opened that they couldn't open before.
   * You should deny any unexpected window creation.
   *
   * @see https://www.electronjs.org/docs/latest/tutorial/security#14-disable-or-limit-creation-of-new-windows
   * @see https://www.electronjs.org/docs/latest/tutorial/security#15-do-not-use-openexternal-with-untrusted-content
   */
  contents.setWindowOpenHandler(({ url }) => {
    const { origin } = new URL(url);

    if (ALLOWED_EXTERNAL_ORIGINS.has(origin)) {
      // Open default browser
      shell.openExternal(url).catch(err => {
        debug(`error while open browser: ${(err as Error).message}`);
      });
    } /* if (import.meta.env.DEV) */ else {
      debug(`Blocked the opening of an unallowed origin: ${origin}`);
    }

    // Prevent creating new window in application
    return { action: 'deny' };
  });

  /**
   * Verify webview options before creation
   *
   * Strip away preload scripts, disable Node.js integration, and ensure origins are on the allowlist.
   *
   * @see https://www.electronjs.org/docs/latest/tutorial/security#12-verify-webview-options-before-creation
   */
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    const { origin } = new URL(params.src);
    if (!ALLOWED_ORIGINS_AND_PERMISSIONS.has(origin)) {
      // if (import.meta.env.DEV) {
      debug(`A webview tried to attach ${params.src}, but was blocked.`);
      // }

      event.preventDefault();
      return;
    }

    // Strip away preload scripts if unused or verify their location is legitimate
    delete webPreferences.preload;
    // @ts-expect-error `preloadURL` exists - see https://www.electronjs.org/docs/latest/api/web-contents#event-will-attach-webview
    delete webPreferences.preloadURL;

    // Disable Node.js integration
    webPreferences.nodeIntegration = false;
  });
});
