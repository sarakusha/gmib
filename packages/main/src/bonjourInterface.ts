import os, { type NetworkInterfaceInfo } from 'node:os';

type NetworkInterfaces = NodeJS.Dict<NetworkInterfaceInfo[]>;

const isIPv4 = (info: NetworkInterfaceInfo): boolean => info.family === 'IPv4' && !info.internal;

export const selectWindowsMdnsInterfaces = (
  interfaces: NetworkInterfaces = os.networkInterfaces(),
): string[] =>
  Array.from(
    new Set(
      Object.values(interfaces)
        .flatMap(entries => entries ?? [])
        .filter(isIPv4)
        .map(info => info.address),
    ),
  );

export const getBonjourInterfaces = (): string[] =>
  process.platform === 'win32' ? selectWindowsMdnsInterfaces() : [];
