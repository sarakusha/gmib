#!/usr/bin/env node

const { createServer, build, createLogger } = require('vite');
const electronPath = require('electron');
const { spawn } = require('child_process');
const { generateAsync } = require('dts-for-context-bridge');

/** @type 'production' | 'development'' */
const mode = (process.env.MODE = process.env.MODE || 'development');

/** @type {import('vite').LogLevel} */
const LOG_LEVEL = 'info';

/** @type {import('vite').InlineConfig} */
const sharedConfig = {
  mode,
  build: {
    watch: {},
  },
  logLevel: LOG_LEVEL,
};

/** Messages on stderr that match any of the contained patterns will be stripped from output */
const stderrFilterPatterns = [
  // warning about devtools extension
  // https://github.com/cawa-93/vite-electron-builder/issues/492
  // https://github.com/MarshallOfSound/electron-devtools-installer/issues/143
  /ExtensionLoadWarning/,
];

/**
 * @param {{name: string; configFile: string; writeBundle: import('rollup').OutputPlugin['writeBundle'] }} param0
 */
const getWatcher = ({ name, configFile, writeBundle }) => {
  return build({
    ...sharedConfig,
    configFile,
    plugins: [{ name, writeBundle }],
  });
};

/**
 * Start or restart App when source files are changed
 * @param {{config: {server: import('vite').ResolvedServerOptions}}} ResolvedServerOptions
 */
const setupMainPackageWatcher = ({ config: { server } }, { config: { server: playerServer } }) => {
  // Create VITE_DEV_SERVER_URL environment variable to pass it to the main process.
  {
    const protocol = server.https ? 'https:' : 'http:';
    const host = server.host || 'localhost';
    const port = server.port; // Vite searches for and occupies the first free port: 3000, 3001, 3002 and so on
    const path = '/';
    process.env.VITE_DEV_SERVER_URL = `${protocol}//${host}:${port}${path}`;
  }
  // Create VITE_PLAYER_DEV_SERVER_URL environment variable to pass it to the main process.
  {
    const protocol = playerServer.https ? 'https:' : 'http:';
    const host = playerServer.host || 'localhost';
    const port = playerServer.port; // Vite searches for and occupies the first free port: 3000, 3001, 3002 and so on
    const path = '/';
    process.env.VITE_PLAYER_DEV_SERVER_URL = `${protocol}//${host}:${port}${path}`;
  }

  const logger = createLogger(LOG_LEVEL, {
    prefix: '[main]',
  });

  /** @type {ChildProcessWithoutNullStreams | null} */
  let spawnProcess = null;

  return getWatcher({
    name: 'reload-app-on-main-package-change',
    configFile: 'packages/main/vite.config.js',
    writeBundle() {
      if (spawnProcess !== null) {
        spawnProcess.off('exit', process.exit);
        spawnProcess.kill('SIGINT');
        spawnProcess = null;
      }

      spawnProcess = spawn(String(electronPath), ['.']);

      spawnProcess.stdout.on(
        'data',
        d => d.toString().trim() && logger.warn(d.toString(), { timestamp: true }),
      );
      spawnProcess.stderr.on('data', d => {
        const data = d.toString().trim();
        if (!data) return;
        const mayIgnore = stderrFilterPatterns.some(r => r.test(data));
        if (mayIgnore) return;
        logger.error(data, { timestamp: true });
      });

      // Stops the watch script when the application has been quit
      spawnProcess.on('exit', process.exit);
    },
  });
};

/**
 * Start or restart App when source files are changed
 * @param {{ws: import('vite').WebSocketServer}} WebSocketServer
 */
const setupPreloadPackageWatcher = ({ ws }) =>
  getWatcher({
    name: 'reload-page-on-preload-package-change',
    configFile: 'packages/preload/vite.config.js',
    writeBundle() {
      // Generating exposedInMainWorld.d.ts when preload package is changed.
      generateAsync({
        input: 'packages/preload/tsconfig.json',
        output: 'packages/preload/exposedInMainWorld.d.ts',
      });

      ws.send({
        type: 'full-reload',
      });
    },
  });

const setupPlayerPreloadPackageWatcher = ({ ws }) =>
  getWatcher({
    name: 'reload-page-on-preload-player-package-change',
    configFile: 'packages/playerPreload/vite.config.js',
    writeBundle() {
      // Generating exposedInMainWorld.d.ts when preload package is changed.
      generateAsync({
        input: 'packages/playerPreload/tsconfig.json',
        output: 'packages/playerPreload/exposedInMainWorld.d.ts',
      });

      ws.send({
        type: 'full-reload',
      });
    },
  });

/* const setupPlayerPackageWatcher = ({ ws }) =>
  getWatcher({
    name: 'reload-page-on-player-package-change',
    configFile: 'packages/player/vite.config.mjs',
    writeBundle() {
      ws.send({
        type: 'full-reload',
      });
    },
  }); */

(async () => {
  try {
    const viteDevServer = await createServer({
      ...sharedConfig,
      configFile: 'packages/renderer/vite.config.mjs',
      // configFile: process.env.PLAYER ? 'packages/player/vite.config.mjs' : 'packages/renderer/vite.config.mjs',
    });

    // const vitePlayerDevServer = await createServer({
    //   ...sharedConfig,
    //   configFile: 'packages/player/vite.config.mjs',
    //   server: { port: 1337 },
    // });

    const s = await viteDevServer.listen();
    s.printUrls());
    // const s1 = await vitePlayerDevServer.listen();
    // console.log('player devserver Listening on', s1.printUrls());

    await setupPlayerPreloadPackageWatcher(vitePlayerDevServer);
    await setupPreloadPackageWatcher(viteDevServer);
    await setupMainPackageWatcher(viteDevServer, vitePlayerDevServer);
    // await setupPlayerPackageWatcher(viteDevServer);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
