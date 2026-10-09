let stopped = false;
let queueTail: Promise<void> = Promise.resolve();

export const enqueueSchedulerJob = <T>(execute: () => Promise<T>): Promise<T> => {
  const run = (): Promise<T> => {
    if (stopped) throw new Error('Scheduler is stopping');
    return execute();
  };
  const result = queueTail.then(run, run);
  queueTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};

/** Cancel waiting jobs, but allow an already-running job to persist its result. */
export const stopSchedulerQueue = (): Promise<void> => {
  stopped = true;
  return queueTail;
};
