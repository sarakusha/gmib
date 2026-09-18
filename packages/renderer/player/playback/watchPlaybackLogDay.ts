// Refresh the server-provided path rather than constructing a remote path locally.
export const watchPlaybackLogDay = (refresh: () => void): (() => void) => {
  let timer: ReturnType<typeof setTimeout>;
  const schedule = (): void => {
    clearTimeout(timer);
    const now = new Date();
    const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    timer = setTimeout(
      () => {
        refresh();
        schedule();
      },
      midnight - now.getTime() + 1000,
    );
  };
  const resume = (): void => {
    refresh();
    schedule();
  };
  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') resume();
  };
  schedule();
  window.addEventListener('focus', resume);
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    clearTimeout(timer);
    window.removeEventListener('focus', resume);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
};
