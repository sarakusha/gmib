let queueTail: Promise<void> = Promise.resolve();

export const enqueueSchedulerJob = <T>(execute: () => Promise<T>): Promise<T> => {
  const result = queueTail.then(execute, execute);
  queueTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};
