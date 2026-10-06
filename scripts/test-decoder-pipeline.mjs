// Isolated Electron/WebCodecs smoke test. This never starts gmib or reads activation data.
// Run: node scripts/test-decoder-pipeline.mjs [--compare-legacy]
// Requires ffmpeg in PATH, or FFMPEG_PATH pointing to its executable.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { _electron as electron } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await mkdtemp(path.join(tmpdir(), 'gmib-decoder-pipeline-'));
const compareLegacy = process.argv.includes('--compare-legacy');
let app;
let server;
const responseTimers = new Set();
const phase = message => console.log(`[decoder-smoke] ${message}`);
const bounded = async (promise, milliseconds, label) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${milliseconds}ms`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
// Also bounds a completely stalled Chromium renderer, whose own timers cannot fire.
const watchdog = setTimeout(() => {
  console.error('[decoder-smoke] Overall 120s deadline exceeded');
  app?.process().kill('SIGKILL');
  responseTimers.forEach(clearTimeout);
  server?.closeAllConnections();
  server?.close();
  void rm(temporary, { recursive: true, force: true }).finally(() => process.exit(1));
}, 120_000);
watchdog.unref();
try {
  phase('Generating five-second H264 fixture');
  const mediaPath = path.join(temporary, 'five-seconds.mkv');
  execFileSync(
    process.env.FFMPEG_PATH || 'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=320x180:rate=25:duration=5',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-g',
      '25',
      '-an',
      mediaPath,
    ],
    { timeout: 30_000 },
  );
  const workers = new Map();
  for (const legacy of compareLegacy ? [false, true] : [false]) {
    const name = legacy ? 'legacy' : 'current';
    phase(`Building ${name} worker`);
    const result = await build({
      configFile: false,
      root,
      logLevel: 'error',
      plugins: legacy
        ? [
            {
              name: 'use-installed-legacy-frame-clock',
              enforce: 'pre',
              transform(code, id) {
                if (!id.endsWith('/player/decoder.ts')) return;
                return code.replace(
                  "import FramePacer from './FramePacer';",
                  "import FramePacer from '@sarakusha/ebml/ReducingValve';",
                );
              },
            },
          ]
        : [],
      build: {
        write: false,
        minify: false,
        lib: {
          entry: path.join(root, 'packages/preload/player/decoder.ts'),
          formats: ['iife'],
          name: 'DecoderSmoke',
        },
      },
    });
    workers.set(`/${name}.js`, result[0].output.find(chunk => chunk.type === 'chunk').code);
  }
  const media = await readFile(mediaPath);
  server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (workers.has(url.pathname)) {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(workers.get(url.pathname));
      return;
    }
    if (url.pathname !== '/media.mkv') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><title>Isolated decoder smoke test</title>');
      return;
    }
    if (request.method === 'HEAD') {
      response.setHeader('Content-Length', media.length);
      response.end();
      return;
    }
    const match = /bytes=(\d+)-(\d+)/.exec(request.headers.range || '');
    const start = match ? Number(match[1]) : 0;
    const end = match ? Math.min(Number(match[2]), media.length - 1) : media.length - 1;
    const send = () => {
      response.writeHead(match ? 206 : 200, {
        'Content-Type': 'video/x-matroska',
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${media.length}`,
      });
      response.end(media.subarray(start, end + 1));
    };
    const delay = Number(url.searchParams.get('delay')) || 0;
    if (delay) {
      const timer = setTimeout(() => {
        responseTimers.delete(timer);
        send();
      }, delay);
      responseTimers.add(timer);
    } else send();
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  phase(`HTTP fixture listening at ${url}`);
  const main = path.join(temporary, 'main.cjs');
  await writeFile(
    main,
    `const {app,BrowserWindow}=require('electron');
app.whenReady().then(()=>{const w=new BrowserWindow({show:false,webPreferences:{backgroundThrottling:false}});w.loadURL(${JSON.stringify(url)});});`,
  );
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  phase('Launching isolated Electron');
  app = await electron.launch({
    args: [
      main,
      `--user-data-dir=${path.join(temporary, 'profile')}`,
      ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    ],
    env,
    timeout: 30_000,
  });
  phase('Electron launched; waiting for renderer');
  const page = await app.firstWindow({ timeout: 30_000 });
  page.on('console', message => {
    if (message.text().startsWith('[decoder-smoke]')) console.log(message.text());
  });
  page.on('pageerror', error => console.error(`[decoder-smoke] Renderer error: ${error.message}`));
  await page.waitForLoadState('domcontentloaded', { timeout: 30_000 });
  phase('Renderer loaded; testing real worker pipeline');
  const pipelineRun = page.evaluate(
    async ({ compareLegacy }) => {
      const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
      function source(label, { delay = 0, legacy = false, pause = false } = {}) {
        console.log(`[decoder-smoke] ${label}: creating worker`);
        const worker = new Worker(`/${legacy ? 'legacy' : 'current'}.js`);
        const startedAt = performance.now();
        let finish;
        let fail;
        let ready;
        let frames = 0;
        let firstFrameAt;
        let pausedCheck;
        let legacyDiagnostics;
        const configured = new Promise(resolve => {
          ready = resolve;
        });
        const completed = new Promise((resolve, reject) => {
          finish = resolve;
          fail = reject;
        });
        const timeout = setTimeout(() => fail(new Error(`${label}: timeout`)), 25000);
        // Attach rejection handling immediately, including while this source is preloading.
        void completed.catch(() => {});
        worker.onerror = event => fail(new Error(`${label}: ${event.message}`));
        worker.onmessage = ({ data }) => {
          if (data.ready) {
            console.log(`[decoder-smoke] ${label}: decoder configured`);
            ready();
          }
          if (data.err || data.recoverableError)
            fail(new Error(`${label}: ${JSON.stringify(data)}`));
          if ('frames' in data) legacyDiagnostics = data;
          if (data.frame) {
            if (!frames) console.log(`[decoder-smoke] ${label}: first real frame`);
            if (!(data.frame instanceof VideoFrame))
              fail(new Error('Expected real transferred VideoFrame'));
            frames += 1;
            firstFrameAt ??= performance.now() - startedAt;
            data.frame.close();
            if (pause && frames === 10) {
              worker.postMessage({ pause: true });
              pausedCheck = (async () => {
                await sleep(100);
                const settled = frames;
                await sleep(500);
                if (frames !== settled) throw new Error(`${label}: delivered frames while paused`);
                worker.postMessage({ play: true });
              })();
            }
          }
          if (data.done) {
            console.log(`[decoder-smoke] ${label}: complete, ${frames} frames`);
            clearTimeout(timeout);
            finish({
              label,
              frames,
              firstFrameAt,
              elapsed: performance.now() - startedAt,
              diagnostics: data.diagnostics,
              legacyDiagnostics,
            });
          }
        };
        worker.postMessage({
          uri: `${location.origin}/media.mkv?delay=${delay}&source=${label}`,
          closed: true,
          fade: { disableIn: true, disableOut: true },
        });
        return {
          // A failure or the source timeout must reject readiness too.
          configured: Promise.race([configured, completed]),
          get frames() {
            return frames;
          },
          play() {
            worker.postMessage({ play: true });
          },
          async done() {
            try {
              const result = await completed;
              await pausedCheck;
              return result;
            } finally {
              clearTimeout(timeout);
              worker.terminate();
            }
          },
        };
      }
      const delayed = source('delayed-first-frame', { delay: 6000 });
      delayed.play();
      const paused = source('pause-during-playback', { pause: true });
      paused.play();
      const legacy = compareLegacy
        ? source('legacy-delayed-first-frame', { legacy: true, delay: 6000 })
        : undefined;
      legacy?.play();
      const first = source('playlist-first');
      const second = source('playlist-second-preloaded');
      await Promise.all([first.configured, second.configured]);
      await sleep(1000);
      if (first.frames || second.frames) throw new Error('Paused preload emitted frames');
      first.play();
      const firstResult = await first.done();
      if (second.frames) throw new Error('Next clip emitted before playlist transition');
      const wrap = source('playlist-wrap-first-preloaded');
      second.play();
      const secondResult = await second.done();
      if (wrap.frames) throw new Error('Wrapped first clip emitted before playlist transition');
      wrap.play();
      return Promise.all([
        Promise.resolve(firstResult),
        Promise.resolve(secondResult),
        wrap.done(),
        delayed.done(),
        paused.done(),
        ...(legacy ? [legacy.done()] : []),
      ]);
    },
    { compareLegacy },
  );
  const results = await bounded(pipelineRun, 60_000, 'Real decoder pipeline');
  console.log(
    JSON.stringify(
      { electron: await app.evaluate(() => process.versions.electron), results },
      null,
      2,
    ),
  );
  for (const result of results) {
    if (result.label.startsWith('legacy-')) {
      assert.equal(result.frames, 0, 'legacy startup-delay reproduction');
      assert.equal(result.legacyDiagnostics?.dropped, 125);
    } else {
      if (result.label === 'delayed-first-frame')
        assert.ok(result.firstFrameAt >= 5500, 'The delayed response must exercise late startup');
      assert.equal(result.diagnostics?.decodedFrames, 125, `${result.label}: decoded frames`);
      assert.ok(result.frames >= 120, `${result.label}: unexpectedly lost more than five frames`);
      assert.equal(
        result.frames,
        result.diagnostics?.outputFrames,
        `${result.label}: frame transfer count`,
      );
    }
  }
} finally {
  phase('Cleaning up isolated Electron and HTTP fixture');
  try {
    if (app) {
      try {
        await bounded(app.close(), 10_000, 'Electron cleanup');
      } catch (error) {
        app.process().kill('SIGKILL');
        throw error;
      }
    }
  } finally {
    responseTimers.forEach(clearTimeout);
    server?.closeAllConnections();
    await bounded(
      new Promise(resolve => (server ? server.close(resolve) : resolve())),
      5000,
      'HTTP cleanup',
    );
    await rm(temporary, { recursive: true, force: true });
    clearTimeout(watchdog);
  }
}
