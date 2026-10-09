import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import {
  createPreloadReloadGate,
  createRestartManager,
  createStartupScope,
} from './watchLifecycle.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));

test('a stop during preload readiness prevents startup and closes a late watcher', async () => {
  const scope = createStartupScope();
  let resolveBuild;
  const build = new Promise(resolve => {
    resolveBuild = resolve;
  });
  let spawned = false;
  let closed = 0;
  const readiness = scope.whenReady(build, () => {
    spawned = true;
  });

  await scope.close();
  assert.equal(await readiness, false);
  assert.equal(spawned, false);
  resolveBuild();
  assert.equal(await scope.add({ close: async () => closed++ }), false);
  assert.equal(closed, 1);
});

test('preload readiness requires an output write and a completed watch cycle', async () => {
  let reloads = 0;
  const gate = createPreloadReloadGate(() => reloads++);
  gate.written();
  gate.written();
  gate.ended();
  await gate.firstBuild;
  assert.equal(reloads, 0);
  gate.written();
  gate.ended();
  assert.equal(reloads, 1);
});

test('watch cycle with no preload output rejects readiness', async () => {
  const gate = createPreloadReloadGate(() => {});
  gate.ended();
  await assert.rejects(gate.firstBuild, /without writing output/);
});

const fixture = (timeoutMs = 100) => {
  const children = [];
  const quits = [];
  const errors = [];
  const manager = createRestartManager({
    timeoutMs,
    spawnChild: () => {
      const child = new EventEmitter();
      child.signals = [];
      child.pid = 1234;
      child.unrefs = 0;
      child.unref = () => child.unrefs++;
      child.killResult = true;
      child.kill = signal => {
        child.signals.push(signal);
        return child.killResult;
      };
      children.push(child);
      return child;
    },
    onQuit: (...args) => quits.push(args),
    onFatal: error => errors.push(error),
  });
  return { manager, children, quits, errors };
};

test('rapid main bundles wait for old child exit and coalesce into one new child', async () => {
  const { manager, children, quits } = fixture();
  await manager.requestRestart();
  assert.equal(children.length, 1);
  const first = manager.requestRestart();
  const second = manager.requestRestart();
  assert.deepEqual(children[0].signals, ['SIGINT']);
  assert.equal(children.length, 1);
  children[0].emit('exit', null, 'SIGINT');
  await Promise.all([first, second]);
  assert.equal(children.length, 2);
  assert.deepEqual(quits, []);
  const stopping = manager.stop();
  children[1].emit('exit', null, 'SIGINT');
  await stopping;
});

test('natural child exit requests launcher shutdown', async () => {
  const { manager, children, quits } = fixture();
  await manager.requestRestart();
  children[0].emit('exit', 7, null);
  assert.deepEqual(quits, [[7, null]]);
  await manager.stop();
});

test('spawn error is reported and prevents later starts', async () => {
  const { manager, children, errors } = fixture();
  await manager.requestRestart();
  children[0].emit('error', new Error('spawn failed'));
  await tick();
  assert.equal(errors.length, 1);
  await manager.requestRestart();
  assert.equal(children.length, 1);
  await manager.stop();
});

test('shutdown while restart waits for old child prevents a new spawn', async () => {
  const { manager, children } = fixture();
  await manager.requestRestart();
  const restarting = manager.requestRestart();
  const stopping = manager.stop();
  children[0].emit('exit', null, 'SIGINT');
  await Promise.all([restarting, stopping]);
  assert.equal(children.length, 1);
});

test('shutdown timeout fails without spawning a second child', async () => {
  const { manager, children, errors } = fixture(5);
  await manager.requestRestart();
  await manager.requestRestart();
  assert.equal(children.length, 1);
  assert.match(errors[0].message, /did not exit/);
  assert.match(errors[0].message, /PID 1234/);
  assert.deepEqual(children[0].signals, ['SIGINT']);
  assert.equal(children[0].unrefs, 1);
});

test('failed signal leaves the current Electron process running and prevents replacement', async () => {
  const { manager, children, errors } = fixture();
  await manager.requestRestart();
  children[0].killResult = false;
  await manager.requestRestart();
  assert.equal(children.length, 1);
  assert.match(errors[0].message, /Could not signal Electron/);
  assert.match(errors[0].message, /PID 1234/);
  assert.equal(children[0].unrefs, 1);
});
