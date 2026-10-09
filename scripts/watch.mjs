#!/usr/bin/env node

import { build, createServer } from 'vite';
import electronPath from 'electron';
import { spawn } from 'node:child_process';
import process from 'node:process';
import {
  createPreloadReloadGate,
  createRestartManager,
  createStartupScope,
} from './watchLifecycle.mjs';

const mode = (process.env.MODE = process.env.MODE || 'development');
const logLevel = 'info';
const preloadBuild = {
  emptyOutDir: false,
  lib: {
    entry: {
      gmib: 'gmib/index.ts',
      player: 'player/index.ts',
      remote: 'remote/index.ts',
    },
    formats: ['cjs'],
  },
  rollupOptions: { output: { entryFileNames: '[name].cjs' } },
};
const scope = createStartupScope();
let restartManager;
let shutdownPromise;

const shutdown = (exitCode = 0) => {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    try {
      await restartManager?.stop();
    } catch (error) {
      console.error(error);
      exitCode = 1;
    }
    await scope.close();
    process.exitCode = exitCode;
  })();
  return shutdownPromise;
};

process.on('SIGINT', () => void shutdown(130));
process.on('SIGTERM', () => void shutdown(143));

const start = async () => {
  const renderer = await createServer({
    mode,
    logLevel,
    configFile: 'packages/renderer/vite.config.mjs',
  });
  if (!(await scope.add(renderer))) return;
  await renderer.listen();
  if (scope.stopped) return;
  process.env.VITE_DEV_SERVER_URL = renderer.resolvedUrls.local[0];

  const preloadReload = createPreloadReloadGate(() => renderer.ws.send({ type: 'full-reload' }));
  const preloadWatcher = await build({
    mode,
    logLevel,
    configFile: 'packages/preload/vite.config.js',
    build: { ...preloadBuild, watch: {} },
    plugins: [
      { name: 'reload-page-on-preload-change', writeBundle: () => preloadReload.written() },
    ],
  });
  if (!(await scope.add(preloadWatcher))) return;
  preloadWatcher.on('event', event => {
    if (event.code === 'END') preloadReload.ended();
    if (event.code === 'ERROR') preloadReload.failed(event.error);
  });
  // Watch registration finishes before its first build; wait for actual output.
  if (!(await scope.whenReady(preloadReload.firstBuild))) return;

  const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...electronEnv } = process.env;
  restartManager = createRestartManager({
    spawnChild: () =>
      spawn(String(electronPath), ['--inspect', '--remote-debugging-port=9222', '.'], {
        env: electronEnv,
        stdio: 'inherit',
      }),
    onQuit: code => void shutdown(code ?? 0),
    onFatal: error => {
      console.error(error);
      void shutdown(1);
    },
  });

  const mainWatcher = await build({
    mode,
    logLevel,
    configFile: 'packages/main/vite.config.js',
    build: { watch: {} },
    plugins: [
      {
        name: 'reload-app-on-main-change',
        writeBundle: () => restartManager.requestRestart(),
      },
    ],
  });
  await scope.add(mainWatcher);
};

start().catch(error => {
  console.error(error);
  void shutdown(1);
});
