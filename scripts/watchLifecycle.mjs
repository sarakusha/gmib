export const createStartupScope = () => {
  const resources = [];
  let stopped = false;
  let resolveClosed;
  const closed = new Promise(resolve => {
    resolveClosed = resolve;
  });

  return {
    get stopped() {
      return stopped;
    },
    async add(resource) {
      if (stopped) {
        await resource.close();
        return false;
      }
      resources.push(resource);
      return true;
    },
    async whenReady(readiness, callback = () => {}) {
      if (!(await Promise.race([readiness.then(() => true), closed.then(() => false)])))
        return false;
      if (stopped) return false;
      await callback();
      return true;
    },
    async close() {
      if (stopped) return;
      stopped = true;
      resolveClosed();
      await Promise.allSettled(resources.map(resource => resource.close()));
    },
  };
};

export const createPreloadReloadGate = onReload => {
  let wrote = false;
  let initialBuild = true;
  let resolveFirst;
  let rejectFirst;
  const firstBuild = new Promise((resolve, reject) => {
    resolveFirst = resolve;
    rejectFirst = reject;
  });
  return {
    firstBuild,
    written() {
      wrote = true;
    },
    ended() {
      if (!wrote) {
        if (initialBuild) rejectFirst(new Error('Preload watcher ended without writing output'));
        return;
      }
      wrote = false;
      if (initialBuild) {
        initialBuild = false;
        resolveFirst();
      } else onReload();
    },
    failed(error) {
      if (initialBuild) rejectFirst(error);
    },
  };
};

export const createRestartManager = ({ spawnChild, onQuit, onFatal, timeoutMs = 10000 }) => {
  let current = null;
  let pending = false;
  let draining = null;
  let stopping = false;
  let failed = false;

  const fail = error => {
    if (failed || stopping) return;
    failed = true;
    pending = false;
    onFatal(error);
  };

  const startChild = () => {
    const child = spawnChild();
    const record = { child, intentional: false, termination: null, done: null };
    record.done = new Promise((resolve, reject) => {
      child.once('exit', (code, signal) => {
        if (current === record) current = null;
        resolve({ code, signal });
        if (!record.intentional && !stopping && !failed) onQuit(code, signal);
      });
      child.once('error', error => {
        if (current === record) current = null;
        reject(error);
        fail(error);
      });
    });
    // A spontaneous spawn error is reported by onFatal even when no restart is awaiting done.
    void record.done.catch(() => {});
    current = record;
  };

  const terminate = record => {
    if (record.termination) return record.termination;
    record.intentional = true;
    record.termination = new Promise((resolve, reject) => {
      const detachAndReject = message => {
        record.child.unref?.();
        reject(new Error(`${message} (PID ${record.child.pid ?? 'unknown'}); leaving it running`));
      };
      const timer = setTimeout(
        () => detachAndReject('Electron did not exit after SIGINT'),
        timeoutMs,
      );
      if (!record.child.kill('SIGINT')) {
        clearTimeout(timer);
        detachAndReject('Could not signal Electron to exit');
        return;
      }
      record.done.then(resolve, reject).finally(() => clearTimeout(timer));
    });
    return record.termination;
  };

  const requestRestart = () => {
    if (stopping || failed) return Promise.resolve();
    pending = true;
    if (draining) return draining;
    draining = (async () => {
      while (pending && !stopping && !failed) {
        pending = false;
        if (current) await terminate(current);
        if (stopping || failed) break;
        // Several bundles may complete while the previous process is exiting.
        pending = false;
        startChild();
      }
    })()
      .catch(fail)
      .finally(() => {
        draining = null;
        if (pending && !stopping && !failed) void requestRestart();
      });
    return draining;
  };

  const stop = async () => {
    stopping = true;
    pending = false;
    if (current) await terminate(current);
    if (draining) await draining;
  };

  return { requestRestart, stop };
};
