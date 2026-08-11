import os, { type NetworkInterfaceInfo } from 'node:os';

type NetworkInterfaces = NodeJS.Dict<NetworkInterfaceInfo[]>;

type AddressRecord = {
  type: string;
  data: unknown;
};

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

export const selectBonjourAddressRecords = <Record extends AddressRecord>(
  records: Record[],
  address: string,
): Record[] =>
  records.filter(
    record => record.type !== 'AAAA' && (record.type !== 'A' || String(record.data) === address),
  );
