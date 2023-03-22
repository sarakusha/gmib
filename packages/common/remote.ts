const query = window && new URLSearchParams(window.location.search);
export const port = +(query?.get('port') ?? 9001);
export const host = query?.get('host') ?? 'localhost';
export const isRemoteSession = host !== 'localhost';

export const getUrl = (path: string): string => isRemoteSession ? `http://${host}:${port + 1}${path}` : path;
