import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';

import type { CustomHost, RemoteHost } from '/@common/helpers';

const MAX_HOSTS = 1000;
const MAX_LABEL_LENGTH = 63;
const MAX_HOSTNAME_LENGTH = 253;
const MAX_NAME_LENGTH = 200;
const REVISION_PATTERN = /^sha256:[0-9a-f]{64}$/;

export type ManagementHost = {
  key: string;
  address: string;
  nibusPort: number;
  apiPort: number;
  name?: string;
};

export type DiscoveredManagementHost = ManagementHost & {
  version: string;
  platform?: string;
  arch?: string;
  osVersion?: string;
};

export type ManagementHostsSnapshot = {
  revision: string;
  saved: ManagementHost[];
  discovered: DiscoveredManagementHost[];
};

export type ManagementHostsPutResult = {
  changed: boolean;
  dryRun: boolean;
  revision: string;
  saved: ManagementHost[];
};

export type ManagementHostsAdapter = {
  getSavedHosts: () => readonly CustomHost[];
  setSavedHosts: (hosts: CustomHost[]) => void;
  getDiscoveredHosts: () => readonly RemoteHost[] | Promise<readonly RemoteHost[]>;
};

export class ManagementHostsValidationError extends Error {
  readonly code = 'invalid_hosts';

  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'ManagementHostsValidationError';
  }
}

export class ManagementHostsStoredDataError extends Error {
  readonly code = 'invalid_saved_hosts';

  constructor(readonly field: string) {
    super(`Saved host at ${field} is invalid`);
    this.name = 'ManagementHostsStoredDataError';
  }
}

export class ManagementHostsRevisionError extends Error {
  readonly code = 'stale_hosts_revision';

  constructor(readonly currentRevision: string) {
    super('Saved hosts changed after they were read');
    this.name = 'ManagementHostsRevisionError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertAllowedKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string,
): void => {
  const unknown = Object.keys(value).find(key => !allowed.includes(key));
  if (unknown) {
    throw new ManagementHostsValidationError(
      `${field}.${unknown} is not supported`,
      `${field}.${unknown}`,
    );
  }
};

const normalizeAddress = (value: unknown, field: string): string => {
  if (typeof value !== 'string') {
    throw new ManagementHostsValidationError(`${field} must be a hostname or IP address`, field);
  }
  if (/\s|[/?#@\\%]/.test(value)) {
    throw new ManagementHostsValidationError(`${field} contains unsupported characters`, field);
  }
  let address = value;
  const bracketed = address.startsWith('[') || address.endsWith(']');
  if (bracketed) {
    if (!(address.startsWith('[') && address.endsWith(']'))) {
      throw new ManagementHostsValidationError(`${field} has invalid IPv6 brackets`, field);
    }
    address = address.slice(1, -1);
    if (isIP(address) !== 6) {
      throw new ManagementHostsValidationError(`${field} brackets require an IPv6 address`, field);
    }
  }
  if (isIP(address) === 6) {
    const normalized = new URL(`http://[${address}]/`).hostname;
    return normalized.slice(1, -1).toLowerCase();
  }
  if (isIP(address) === 4) return address;
  if (address.includes(':')) {
    throw new ManagementHostsValidationError(`${field} must be a valid IPv6 address`, field);
  }
  const withoutRootDot = address.endsWith('.') ? address.slice(0, -1) : address;
  const ascii = domainToASCII(withoutRootDot).toLowerCase();
  if (isIP(ascii) !== 0) {
    throw new ManagementHostsValidationError(
      `${field} must not use an abbreviated or encoded IP address`,
      field,
    );
  }
  const labels = ascii.split('.');
  if (
    ascii.length === 0 ||
    ascii.length > MAX_HOSTNAME_LENGTH ||
    labels.some(
      label =>
        label.length === 0 ||
        label.length > MAX_LABEL_LENGTH ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
  ) {
    throw new ManagementHostsValidationError(`${field} must be a valid hostname`, field);
  }
  const urlHostname = new URL(`http://${ascii}/`).hostname;
  if (isIP(urlHostname) !== 0 && urlHostname !== ascii) {
    throw new ManagementHostsValidationError(
      `${field} must not use an abbreviated or encoded IP address`,
      field,
    );
  }
  return ascii;
};

const normalizePort = (value: unknown, field: string): number => {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 65534) {
    throw new ManagementHostsValidationError(
      `${field} must be an integer between 1 and 65534`,
      field,
    );
  }
  return value as number;
};

const normalizeOptionalName = (value: unknown, field: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new ManagementHostsValidationError(`${field} must be a string`, field);
  }
  const name = value.trim();
  if (name.length === 0) return undefined;
  if (name.length > MAX_NAME_LENGTH) {
    throw new ManagementHostsValidationError(
      `${field} must be at most ${MAX_NAME_LENGTH} characters`,
      field,
    );
  }
  return name;
};

const endpointKey = (address: string, nibusPort: number): string =>
  `${isIP(address) === 6 ? `[${address}]` : address}:${nibusPort}`;

const normalizeHost = (value: unknown, field: string, stored: boolean): ManagementHost => {
  if (!isRecord(value)) {
    throw new ManagementHostsValidationError(`${field} must be an object`, field);
  }
  assertAllowedKeys(
    value,
    stored ? ['address', 'port', 'name'] : ['address', 'nibusPort', 'name'],
    field,
  );
  const address = normalizeAddress(value.address, `${field}.address`);
  const nibusPort = normalizePort(
    stored ? value.port : value.nibusPort,
    `${field}.${stored ? 'port' : 'nibusPort'}`,
  );
  const name = normalizeOptionalName(value.name, `${field}.name`);
  return {
    key: endpointKey(address, nibusPort),
    address,
    nibusPort,
    apiPort: nibusPort + 1,
    ...(name ? { name } : {}),
  };
};

const normalizeList = (value: unknown, field: string, stored: boolean): ManagementHost[] => {
  if (!Array.isArray(value) || value.length > MAX_HOSTS) {
    throw new ManagementHostsValidationError(
      `${field} must be an array with at most ${MAX_HOSTS} hosts`,
      field,
    );
  }
  const seen = new Set<string>();
  return value.map((host, index) => {
    const normalized = normalizeHost(host, `${field}[${index}]`, stored);
    if (seen.has(normalized.key)) {
      throw new ManagementHostsValidationError(
        `${field}[${index}] duplicates endpoint ${normalized.key}`,
        `${field}[${index}]`,
      );
    }
    seen.add(normalized.key);
    return normalized;
  });
};

const canonicalSaved = (hosts: readonly ManagementHost[]): string =>
  JSON.stringify(
    hosts
      .map(({ address, nibusPort, name }) => ({
        address,
        nibusPort,
        ...(name ? { name } : {}),
      }))
      .sort((left, right) => {
        const leftKey = `${left.address}\0${left.nibusPort}\0${left.name ?? ''}`;
        const rightKey = `${right.address}\0${right.nibusPort}\0${right.name ?? ''}`;
        return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
      }),
  );

export const managementHostsRevision = (hosts: readonly ManagementHost[]): string =>
  `sha256:${createHash('sha256').update(canonicalSaved(hosts)).digest('hex')}`;

const normalizeStoredHosts = (hosts: readonly CustomHost[]): ManagementHost[] => {
  try {
    return normalizeList(hosts, 'saved', true);
  } catch (error) {
    if (error instanceof ManagementHostsValidationError) {
      throw new ManagementHostsStoredDataError(error.field ?? 'saved');
    }
    throw error;
  }
};

const safeMetadata = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text.length > 0 && text.length <= MAX_NAME_LENGTH ? text : undefined;
};

const normalizeDiscoveredHosts = (hosts: readonly RemoteHost[]): DiscoveredManagementHost[] => {
  const normalized = hosts.flatMap((host, index) => {
    try {
      const base = normalizeHost(
        { address: host.address, nibusPort: host.port, name: host.name },
        `discovered[${index}]`,
        false,
      );
      return [
        {
          ...base,
          version: safeMetadata(host.version) ?? 'N/A',
          ...(safeMetadata(host.platform) ? { platform: safeMetadata(host.platform) } : {}),
          ...(safeMetadata(host.arch) ? { arch: safeMetadata(host.arch) } : {}),
          ...(safeMetadata(host.osVersion) ? { osVersion: safeMetadata(host.osVersion) } : {}),
        },
      ];
    } catch (error) {
      if (error instanceof ManagementHostsValidationError) return [];
      throw error;
    }
  });
  normalized.sort((left, right) => {
    const leftKey = `${left.key}\0${JSON.stringify(left)}`;
    const rightKey = `${right.key}\0${JSON.stringify(right)}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  return [...new Map(normalized.map(host => [host.key, host])).values()];
};

const toStoredHosts = (hosts: readonly ManagementHost[]): CustomHost[] =>
  hosts.map(({ address, nibusPort: port, name }) => ({
    address,
    port,
    ...(name ? { name } : {}),
  }));

export class ManagementHostsService {
  constructor(private readonly adapter: ManagementHostsAdapter) {}

  async get(): Promise<ManagementHostsSnapshot> {
    const saved = normalizeStoredHosts(this.adapter.getSavedHosts());
    const discovered = normalizeDiscoveredHosts(await this.adapter.getDiscoveredHosts());
    return { revision: managementHostsRevision(saved), saved, discovered };
  }

  put(value: unknown, dryRun = false): ManagementHostsPutResult {
    if (!isRecord(value)) {
      throw new ManagementHostsValidationError('PUT body must be a JSON object');
    }
    assertAllowedKeys(value, ['revision', 'hosts'], 'body');
    if (typeof value.revision !== 'string' || !REVISION_PATTERN.test(value.revision)) {
      throw new ManagementHostsValidationError(
        'revision must be a sha256 revision returned by GET',
        'revision',
      );
    }
    if (!('hosts' in value)) {
      throw new ManagementHostsValidationError('hosts is required', 'hosts');
    }
    const desired = normalizeList(value.hosts, 'hosts', false);

    // Keep compare-and-write synchronous so two requests cannot both commit the same revision.
    const current = normalizeStoredHosts(this.adapter.getSavedHosts());
    const currentRevision = managementHostsRevision(current);
    if (value.revision !== currentRevision) {
      throw new ManagementHostsRevisionError(currentRevision);
    }
    const changed = canonicalSaved(current) !== canonicalSaved(desired);
    if (!changed) {
      return { changed: false, dryRun, revision: currentRevision, saved: current };
    }
    const revision = managementHostsRevision(desired);
    if (!dryRun) this.adapter.setSavedHosts(toStoredHosts(desired));
    return { changed: true, dryRun, revision, saved: desired };
  }
}

export const createManagementHostsService = (
  adapter: ManagementHostsAdapter,
): ManagementHostsService => new ManagementHostsService(adapter);
