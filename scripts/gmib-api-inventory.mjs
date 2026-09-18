#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  access,
  lstat,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { constants as fsConstants, realpathSync } from 'node:fs';
import { isIP } from 'node:net';
import { basename, dirname, join, resolve } from 'node:path';
import { domainToASCII, fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { GmibApiClient, GmibApiError } from './gmib-api-client.mjs';

const execFileAsync = promisify(execFile);
const SCHEMA_VERSION = 1;
const MANAGED_SUFFIX = '.gmib-managed.json';
const JOURNAL_SUFFIX = '.gmib-journal.json';
const DEFAULT_GROUP = 'gmib';

const HELP = `Usage:
  node scripts/gmib-api-inventory.mjs list [connection options]
  node scripts/gmib-api-inventory.mjs export --output FILE [--group gmib] --apply [connection options]
  node scripts/gmib-api-inventory.mjs import INPUT --apply [--group gmib] [connection options]
  node scripts/gmib-api-inventory.mjs sync INPUT --output FILE --baseline FILE --apply [options]

INPUT (choose one):
  --inventory-json FILE       Standard ansible-inventory --list JSON snapshot
  --inventory FILE            Run ansible-inventory --list -i FILE explicitly

Connection:
  --base-url URL              GMIB origin, or GMIB_BASE_URL
  --client-id ID              Stable client id, or GMIB_CLIENT_ID
  --timeout-ms MS             Per-request timeout (default: 10000)

Password (choose one; defaults to GMIB_PASSWORD):
  --password-env NAME
  --password-file FILE        File must be owner-only
  --password-stdin

Sync:
  --group NAME                Inventory group (default: gmib), including children
  --baseline FILE             Required by sync; binds the base URL and group
  --conflict POLICY           fail (default), gmib-wins, or inventory-wins
  --check                     Validate and call PUT?dryRun=true; never writes files
  --apply                     Required for PUT and local output writes
  --help
`;

export class GmibInventoryError extends GmibApiError {
  constructor(message, { code = 'inventory_error', ...details } = {}) {
    super(message, { code, ...details });
    Object.assign(this, details);
  }
}

const fail = (message, code = 'inventory_error', details) => {
  throw new GmibInventoryError(message, { code, ...details });
};
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const stableJson = value => JSON.stringify(value);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const isSafeKey = value =>
  typeof value === 'string' && value.length > 0 && !['__proto__', 'constructor', 'prototype'].includes(value);

const normalizeRevision = value => {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value)) {
    fail('GMIB вернул некорректную revision', 'invalid_hosts_response');
  }
  return value;
};

const normalizePort = (value, label = 'nibusPort') => {
  if (!Number.isSafeInteger(value) || value < 1 || value > 65534) {
    fail(`${label} должен быть целым числом 1..65534`, 'invalid_endpoint');
  }
  return value;
};

export const normalizeAddress = value => {
  if (typeof value !== 'string') fail('address должен быть строкой', 'invalid_endpoint');
  const raw = value;
  if (!raw || /[\\\s/?#@]/.test(raw) || raw.includes('%')) {
    fail('address содержит недопустимые символы', 'invalid_endpoint');
  }
  const bracketed = raw.startsWith('[') || raw.endsWith(']');
  const address = bracketed ? raw.slice(1, -1) : raw;
  if (bracketed && (!raw.startsWith('[') || !raw.endsWith(']') || isIP(address) !== 6)) {
    fail('скобки address допустимы только для IPv6', 'invalid_endpoint');
  }
  const ipVersion = isIP(address);
  if (ipVersion === 4) return address;
  if (ipVersion === 6) {
    const hostname = new URL(`http://[${address}]`).hostname;
    return hostname.slice(1, -1).toLowerCase();
  }
  if (
    address.includes(':') ||
    address.includes('[') ||
    address.includes(']') ||
    isIP(address) !== 0
  ) {
    fail('address имеет неверный вид', 'invalid_endpoint');
  }
  const withoutRoot = address.endsWith('.') ? address.slice(0, -1) : address;
  const ascii = domainToASCII(withoutRoot).toLowerCase();
  if (
    !ascii ||
    ascii.length > 253 ||
    isIP(ascii) !== 0 ||
    !ascii.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  ) {
    fail('address должен быть IPv4, IPv6 или корректным hostname', 'invalid_endpoint');
  }
  return ascii;
};

export const endpointKey = (address, nibusPort) => {
  const normalizedAddress = normalizeAddress(address);
  const normalizedPort = normalizePort(nibusPort);
  return `${isIP(normalizedAddress) === 6 ? `[${normalizedAddress}]` : normalizedAddress}:${normalizedPort}`;
};

const normalizeName = value => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') fail('name должен быть строкой', 'invalid_saved_host');
  const name = value.trim();
  if (!name) return undefined;
  if (name.length > 200) fail('name слишком длинный', 'invalid_saved_host');
  return name;
};

export const normalizeSavedHost = (value, { requireKey = false } = {}) => {
  if (!isObject(value)) fail('Запись хоста должна быть объектом', 'invalid_saved_host');
  const allowed = new Set(['key', 'address', 'nibusPort', 'apiPort', 'name']);
  if (Object.keys(value).some(key => !allowed.has(key))) {
    fail('Запись хоста содержит неподдерживаемое поле', 'invalid_saved_host');
  }
  const address = normalizeAddress(value.address);
  const nibusPort = normalizePort(value.nibusPort);
  const key = endpointKey(address, nibusPort);
  if (requireKey && value.key !== key) fail('GMIB вернул несовпадающий endpoint key', 'invalid_saved_host');
  if (hasOwn(value, 'apiPort')) {
    if (value.apiPort !== nibusPort + 1) {
      fail('apiPort GMIB имеет неверный вид', 'invalid_saved_host');
    }
  }
  return {
    key,
    address,
    nibusPort,
    ...(hasOwn(value, 'apiPort') ? { apiPort: value.apiPort } : {}),
    ...(normalizeName(value.name) ? { name: normalizeName(value.name) } : {}),
  };
};

const savedForPut = host => ({
  address: host.address,
  nibusPort: host.nibusPort,
  ...(host.name ? { name: host.name } : {}),
});

const savedComparable = host => ({
  address: host.address,
  nibusPort: host.nibusPort,
  ...(host.name ? { name: host.name } : {}),
});

const sortedHosts = hosts =>
  [...hosts].sort((left, right) => left.key.localeCompare(right.key)).map(savedComparable);

const equalHost = (left, right) => stableJson(savedComparable(left)) === stableJson(savedComparable(right));

const normalizeSnapshot = value => {
  if (!isObject(value)) {
    fail('GMIB вернул некорректный hosts snapshot', 'invalid_hosts_response');
  }
  if (!Array.isArray(value.saved) || !Array.isArray(value.discovered)) {
    fail('GMIB вернул некорректный hosts snapshot', 'invalid_hosts_response');
  }
  const saved = value.saved.map(host => normalizeSavedHost(host, { requireKey: true }));
  if (new Set(saved.map(host => host.key)).size !== saved.length) {
    fail('GMIB вернул повторяющийся endpoint key', 'invalid_hosts_response');
  }
  return { revision: normalizeRevision(value.revision), saved, discovered: value.discovered };
};

const normalizeOrigin = value => {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.origin;
  } catch {
    fail('base URL должен быть корректным HTTP(S) origin', 'invalid_url');
  }
};

const walkGroup = (inventory, group, seen, hosts, { allowImplicitUngrouped = false } = {}) => {
  if (seen.has(group)) return;
  seen.add(group);
  const current = inventory[group];
  if (!isObject(current)) {
    if (allowImplicitUngrouped && group === 'ungrouped') return;
    fail(`Inventory group ${group} не найден`, 'inventory_group_missing');
  }
  if (current.hosts !== undefined && !Array.isArray(current.hosts)) {
    fail(`Inventory group ${group} имеет неверный hosts`, 'invalid_inventory');
  }
  if (current.children !== undefined && !Array.isArray(current.children)) {
    fail(`Inventory group ${group} имеет неверный children`, 'invalid_inventory');
  }
  for (const host of current.hosts ?? []) {
    if (typeof host !== 'string' || !host) fail('Inventory host имеет неверное имя', 'invalid_inventory');
    hosts.add(host);
  }
  for (const child of current.children ?? []) {
    if (typeof child !== 'string' || !child) fail('Inventory child имеет неверное имя', 'invalid_inventory');
    walkGroup(inventory, child, seen, hosts, { allowImplicitUngrouped });
  }
};

export const inventoryHosts = (inventory, group = DEFAULT_GROUP) => {
  if (!isObject(inventory) || !isObject(inventory._meta) || !isObject(inventory._meta.hostvars)) {
    fail('Ожидается JSON из ansible-inventory --list', 'invalid_inventory');
  }
  if (!isSafeKey(group)) fail('group имеет недопустимое имя', 'invalid_arguments');
  const names = new Set();
  walkGroup(inventory, group, new Set(), names);
  const records = [];
  for (const alias of [...names].sort()) {
    const vars = inventory._meta.hostvars[alias];
    if (!isObject(vars)) fail(`Inventory host ${alias} не содержит hostvars`, 'invalid_inventory');
    const hasAddress = hasOwn(vars, 'gmib_address');
    const hasPort = hasOwn(vars, 'gmib_nibus_port');
    const hasSavedName = hasOwn(vars, 'gmib_saved_name');
    if (!hasAddress && !hasPort && !hasSavedName) continue;
    if (!hasAddress) fail(`Inventory host ${alias} не содержит gmib_address`, 'missing_gmib_address');
    const address = normalizeAddress(vars.gmib_address);
    const nibusPort = hasPort ? normalizePort(vars.gmib_nibus_port, 'gmib_nibus_port') : 9001;
    if (hasOwn(vars, 'gmib_api_url')) {
      try {
        if (typeof vars.gmib_api_url !== 'string') throw new Error();
        const apiUrl = new URL(vars.gmib_api_url);
        if (!['http:', 'https:'].includes(apiUrl.protocol) || apiUrl.username || apiUrl.password) throw new Error();
      } catch {
        fail(`Inventory host ${alias} имеет некорректный gmib_api_url`, 'invalid_gmib_api_url');
      }
    }
    const name = hasSavedName ? normalizeName(vars.gmib_saved_name) : normalizeName(alias);
    records.push({ key: endpointKey(address, nibusPort), address, nibusPort, ...(name ? { name } : {}), alias });
  }
  const duplicate = records.find(
    (record, index) => records.findIndex(item => item.key === record.key) !== index,
  );
  if (duplicate) fail(`Inventory повторяет endpoint ${duplicate.key}`, 'duplicate_inventory_endpoint');
  return records;
};

const allInventoryAliases = inventory => {
  const names = new Set();
  walkGroup(inventory, 'all', new Set(), names, { allowImplicitUngrouped: true });
  return names;
};

const inventoryAliasContext = (inventory, group) => {
  const records = inventoryHosts(inventory, group);
  const aliases = new Map(records.map(record => [record.key, record.alias]));
  const occupied = new Map();
  for (const alias of allInventoryAliases(inventory)) occupied.set(alias, undefined);
  for (const record of records) occupied.set(record.alias, record.key);
  return { records, aliases, occupied };
};

const aliasIsSafe = value => /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value);
const generatedAlias = key => `gmib_${sha256(key).slice(0, 16)}`;

const aliasesFor = (hosts, existingAliases = new Map(), occupied = new Map()) => {
  const used = new Set();
  const aliases = new Map();
  for (const host of [...hosts].sort((left, right) => left.key.localeCompare(right.key))) {
    let alias = existingAliases.get(host.key);
    if (!alias || used.has(alias) || (occupied.has(alias) && occupied.get(alias) !== host.key)) {
      alias = generatedAlias(host.key);
    }
    while (used.has(alias) || (occupied.has(alias) && occupied.get(alias) !== host.key)) {
      alias = `${generatedAlias(host.key)}_${used.size}`;
    }
    used.add(alias);
    aliases.set(host.key, alias);
  }
  return aliases;
};

export const overlayFor = (hosts, group = DEFAULT_GROUP, existingAliases = new Map()) => {
  if (!isSafeKey(group)) fail('group имеет недопустимое имя', 'invalid_arguments');
  const aliases = aliasesFor(hosts, existingAliases);
  const entries = Object.create(null);
  for (const host of [...hosts].sort((left, right) => left.key.localeCompare(right.key))) {
    const apiHost = isIP(host.address) === 6 ? `[${host.address}]` : host.address;
    entries[aliases.get(host.key)] = {
      gmib_address: host.address,
      gmib_nibus_port: host.nibusPort,
      gmib_api_url: `http://${apiHost}:${host.apiPort ?? host.nibusPort + 1}`,
      gmib_saved_name: host.name ?? null,
    };
  }
  return {
    all: { children: { [group]: { hosts: entries } } },
  };
};

const aliasesFromOverlay = (overlay, group) => {
  if (!isObject(overlay) || !isObject(overlay.all) || !isObject(overlay.all.children)) {
    fail('Managed output имеет неверный static inventory JSON', 'invalid_output');
  }
  const current = overlay.all.children[group];
  if (!isObject(current) || !isObject(current.hosts)) {
    fail('Managed output не содержит ожидаемый group', 'invalid_output');
  }
  const aliases = new Map();
  for (const [alias, vars] of Object.entries(current.hosts)) {
    if (!isSafeKey(alias) || !isObject(vars) || !hasOwn(vars, 'gmib_address')) {
      fail('Managed output содержит неверный host', 'invalid_output');
    }
    const address = normalizeAddress(vars.gmib_address);
    const nibusPort = hasOwn(vars, 'gmib_nibus_port') ? normalizePort(vars.gmib_nibus_port) : 9001;
    const key = endpointKey(address, nibusPort);
    if (aliases.has(key)) fail('Managed output повторяет endpoint', 'invalid_output');
    aliases.set(key, alias);
  }
  return aliases;
};

const mapByKey = hosts => new Map(hosts.map(host => [host.key, host]));

export const importPlan = (saved, inventory) => {
  const target = mapByKey(saved);
  const actions = [];
  for (const record of inventory) {
    const current = target.get(record.key);
    if (!current) actions.push({ kind: 'add', key: record.key });
    else if (!equalHost(current, record)) actions.push({ kind: 'update', key: record.key });
    target.set(record.key, record);
  }
  return { hosts: [...target.values()], actions };
};

const selectConflict = (policy, remote, inventory, conflicts, key) => {
  if (policy === 'gmib-wins') return { host: remote, from: 'gmib' };
  if (policy === 'inventory-wins') return { host: inventory, from: 'inventory' };
  conflicts.push({ code: 'name_conflict', key });
  return undefined;
};

export const syncPlan = (saved, inventory, baseline, { conflict = 'fail' } = {}) => {
  if (!['fail', 'gmib-wins', 'inventory-wins'].includes(conflict)) {
    fail('conflict должен быть fail, gmib-wins или inventory-wins', 'invalid_arguments');
  }
  const remote = mapByKey(saved);
  const suppliedInventory = mapByKey(inventory);
  const base = mapByKey(baseline?.saved ?? []);
  const observed = mapByKey(baseline?.inventoryObserved ?? baseline?.saved ?? []);
  const overlayOnly = new Set(baseline?.overlayOnly ?? []);
  const fromInventory = new Map();
  for (const [key, supplied] of suppliedInventory) {
    const prior = base.get(key);
    const lastObserved = observed.get(key);
    // A generated overlay is deliberately lower precedence than the editable
    // inventory. If the merged input still equals the last editable view, it
    // carries no new inventory intent; retain the reconciled GMIB value.
    fromInventory.set(
      key,
      prior &&
        ((lastObserved && equalHost(supplied, lastObserved)) || (overlayOnly.has(key) && equalHost(supplied, prior)))
        ? prior
        : supplied,
    );
  }
  const keys = new Set([...remote.keys(), ...fromInventory.keys(), ...base.keys()]);
  const target = new Map();
  const actions = [];
  const conflicts = [];

  for (const key of [...keys].sort()) {
    const prior = base.get(key);
    const remoteValue = remote.get(key);
    const inventoryValue = fromInventory.get(key);
    if (!prior) {
      if (remoteValue && inventoryValue) {
        if (!equalHost(remoteValue, inventoryValue)) {
          const chosen = selectConflict(conflict, remoteValue, inventoryValue, conflicts, key);
          if (chosen) {
            target.set(key, chosen.host);
            actions.push({ kind: 'resolve', key, from: chosen.from });
          }
        } else target.set(key, remoteValue);
      } else if (remoteValue ?? inventoryValue) {
        target.set(key, remoteValue ?? inventoryValue);
        actions.push({ kind: 'add', key, from: remoteValue ? 'gmib' : 'inventory' });
      }
      continue;
    }
    if (!remoteValue && !inventoryValue) {
      actions.push({ kind: 'remove-baseline', key });
      continue;
    }
    if (!remoteValue || !inventoryValue) {
      conflicts.push({
        code: 'deletion_conflict',
        key,
        missing: !remoteValue ? 'gmib' : 'inventory',
      });
      continue;
    }
    const remoteChanged = !equalHost(prior, remoteValue);
    const inventoryChanged = !equalHost(prior, inventoryValue);
    if (remoteChanged && inventoryChanged && !equalHost(remoteValue, inventoryValue)) {
      const chosen = selectConflict(conflict, remoteValue, inventoryValue, conflicts, key);
      if (chosen) {
        target.set(key, chosen.host);
        actions.push({ kind: 'resolve', key, from: chosen.from });
      }
      continue;
    }
    if (remoteChanged && !inventoryChanged) actions.push({ kind: 'propagate', key, from: 'gmib' });
    if (inventoryChanged && !remoteChanged)
      actions.push({ kind: 'propagate', key, from: 'inventory' });
    target.set(key, remoteChanged ? remoteValue : inventoryValue);
  }
  if (conflicts.length) {
    throw new GmibInventoryError('Требуется явное разрешение конфликтов inventory sync', {
      code: 'sync_conflict',
      conflicts,
    });
  }
  return { hosts: [...target.values()], actions };
};

const observedForBaseline = hosts =>
  [...hosts]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map(host => ({ ...savedComparable(host), key: host.key }));

const baselineFor = (baseUrl, group, hosts, aliases, inventoryObserved = hosts, overlayOnly = []) => ({
  kind: 'gmib-inventory-baseline',
  version: SCHEMA_VERSION,
  baseUrl,
  group,
  saved: [...hosts]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map(host => ({ ...savedComparable(host), key: host.key, alias: aliases.get(host.key) })),
  inventoryObserved: observedForBaseline(inventoryObserved),
  overlayOnly: [...overlayOnly].sort(),
});

const nextInventoryObservation = (hosts, inventory, baseline) => {
  const supplied = mapByKey(inventory);
  const prior = mapByKey(baseline?.saved ?? []);
  const priorOverlayOnly = new Set(baseline?.overlayOnly ?? []);
  const observed = [];
  const overlayOnly = [];
  for (const host of hosts) {
    const value = supplied.get(host.key);
    const old = prior.get(host.key);
    if (!value || (priorOverlayOnly.has(host.key) && old && equalHost(value, old))) {
      overlayOnly.push(host.key);
    } else {
      observed.push(value);
    }
  }
  return { observed, overlayOnly };
};

const parseBaseline = (value, { baseUrl, group }) => {
  if (
    !isObject(value) ||
    value.kind !== 'gmib-inventory-baseline' ||
    value.version !== SCHEMA_VERSION ||
    value.baseUrl !== baseUrl ||
    value.group !== group ||
    !Array.isArray(value.saved) ||
    (value.inventoryObserved !== undefined && !Array.isArray(value.inventoryObserved)) ||
    (value.overlayOnly !== undefined && !Array.isArray(value.overlayOnly))
  ) {
    fail('Baseline не принадлежит этому GMIB origin и group', 'invalid_baseline');
  }
  const saved = value.saved.map(host => {
    const { alias, ...record } = host;
    const normalized = normalizeSavedHost(record, { requireKey: true });
    if (typeof alias !== 'string' || !alias) fail('Baseline содержит неверный alias', 'invalid_baseline');
    return { ...normalized, alias };
  });
  if (new Set(saved.map(host => host.key)).size !== saved.length) fail('Baseline повторяет key', 'invalid_baseline');
  const inventoryObserved = (value.inventoryObserved ?? value.saved).map(host => {
    const { alias, ...record } = host;
    return normalizeSavedHost(record, { requireKey: true });
  });
  if (new Set(inventoryObserved.map(host => host.key)).size !== inventoryObserved.length) {
    fail('Baseline повторяет observed key', 'invalid_baseline');
  }
  const overlayOnly = value.overlayOnly ?? [];
  if (
    overlayOnly.some(key => typeof key !== 'string' || !saved.some(host => host.key === key)) ||
    new Set(overlayOnly).size !== overlayOnly.length
  ) {
    fail('Baseline содержит неверный overlay-only key', 'invalid_baseline');
  }
  return { saved, inventoryObserved, overlayOnly, aliases: new Map(saved.map(host => [host.key, host.alias])) };
};

const managedMarker = (output, contents, { baseUrl, group }) => ({
  kind: 'gmib-inventory-overlay-marker',
  version: SCHEMA_VERSION,
  output: resolve(output),
  sha256: sha256(contents),
  baseUrl,
  group,
});

const readJson = async (filename, code) => {
  let raw;
  try {
    raw = await readFile(filename, 'utf8');
  } catch {
    fail('Не удалось прочитать JSON input', code);
  }
  try {
    return JSON.parse(raw);
  } catch {
    fail('JSON input имеет неверный формат', code);
  }
};

const exists = async filename => {
  try {
    await lstat(filename);
    return true;
  } catch {
    return false;
  }
};

const validateParent = async filename => {
  try {
    await access(dirname(filename), fsConstants.W_OK);
  } catch {
    fail('Каталог output/baseline недоступен', 'output_parent_unavailable');
  }
};

const resolvedPath = async filename => {
  const absolute = resolve(filename);
  try {
    return await realpath(absolute);
  } catch {
    try {
      return join(await realpath(dirname(absolute)), basename(absolute));
    } catch {
      return absolute;
    }
  }
};

const rejectSymlink = async filename => {
  try {
    if ((await lstat(filename)).isSymbolicLink()) {
      fail('output и baseline не могут быть symbolic link', 'unsafe_paths');
    }
  } catch (error) {
    if (error instanceof GmibInventoryError) throw error;
  }
};

const withApplyLock = async (output, action) => {
  const lock = `${output}.gmib-apply.lock`;
  try {
    await writeFile(lock, `${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
  } catch (error) {
    if (error?.code === 'EEXIST') fail('Другой inventory apply уже работает с этим output', 'sync_locked');
    fail('Не удалось создать inventory apply lock', 'sync_lock_error');
  }
  try {
    return await action();
  } finally {
    await rm(lock, { force: true }).catch(() => {});
  }
};

const readJournal = async output => {
  const filename = `${output}${JOURNAL_SUFFIX}`;
  if (!(await exists(filename))) return undefined;
  const value = await readJson(filename, 'invalid_output_journal');
  if (!isObject(value) || value.kind !== 'gmib-inventory-write-journal' || value.version !== SCHEMA_VERSION) {
    fail('Managed output journal имеет неверный формат', 'invalid_output_journal');
  }
  return value;
};

const journalMatches = (journal, { output, baseUrl, group, overlayContents }) =>
  Boolean(
    journal &&
      journal.output === resolve(output) &&
      journal.baseUrl === baseUrl &&
      journal.group === group &&
      (overlayContents === undefined || journal.overlayContents === overlayContents),
  );

const ensureManagedOutput = async (output, context) => {
  const markerPath = `${output}${MANAGED_SUFFIX}`;
  const journal = await readJournal(output);
  const outputExists = await exists(output);
  const markerExists = await exists(markerPath);
  if (!outputExists && markerExists) fail('Output marker не соответствует output', 'invalid_output_marker');
  if (!outputExists && !journal) return { aliases: new Map(), raw: undefined, markerRaw: undefined };
  if (!outputExists) {
    if (!journalMatches(journal, { output, ...context })) {
      fail('Незавершенный managed output принадлежит другому sync source', 'invalid_output_journal');
    }
    return { aliases: new Map(), raw: undefined, markerRaw: undefined, journal };
  }
  if (!markerExists && !journal) fail('Отказано в перезаписи unmanaged output', 'unmanaged_output');
  const raw = await readFile(output, 'utf8').catch(() => fail('Не удалось прочитать output', 'output_read_error'));
  const recoverableJournal = journalMatches(journal, { output, ...context, overlayContents: raw });
  let markerRaw;
  if (markerExists && !recoverableJournal) {
    markerRaw = await readFile(markerPath, 'utf8').catch(() => fail('Не удалось прочитать output marker', 'output_read_error'));
    const marker = await readJson(markerPath, 'invalid_output_marker');
    if (
      !isObject(marker) ||
      marker.kind !== 'gmib-inventory-overlay-marker' ||
      marker.version !== SCHEMA_VERSION ||
      marker.output !== resolve(output) ||
      marker.baseUrl !== context.baseUrl ||
      marker.group !== context.group ||
      marker.sha256 !== sha256(raw)
    ) {
      fail('Managed output был изменен вне helper или принадлежит другому sync source', 'invalid_output_marker');
    }
  } else if (!markerExists && !recoverableJournal) {
    fail('Незавершенный managed output нельзя безопасно перезаписать', 'invalid_output_journal');
  }
  try {
    return { aliases: aliasesFromOverlay(JSON.parse(raw), context.group), raw, markerRaw, journal };
  } catch (error) {
    if (error instanceof GmibInventoryError) throw error;
    fail('Managed output имеет неверный inventory JSON', 'invalid_output');
  }
};

const writeAtomic = async (filename, contents) => {
  const temporary = `${filename}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporary, contents, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await rename(temporary, filename);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
};

const managedWrite = ({ output, overlay, baselinePath, baseline, baseUrl, group }) => {
  const overlayContents = `${JSON.stringify(overlay, null, 2)}\n`;
  const markerContents = `${JSON.stringify(managedMarker(output, overlayContents, { baseUrl, group }), null, 2)}\n`;
  const baselineContents = baselinePath && baseline ? `${JSON.stringify(baseline, null, 2)}\n` : undefined;
  return {
    overlayContents,
    markerContents,
    baselineContents,
    journal: {
      kind: 'gmib-inventory-write-journal',
      version: SCHEMA_VERSION,
      output: resolve(output),
      baseUrl,
      group,
      overlayContents,
      markerContents,
      ...(baselinePath ? { baselinePath, baselineContents } : {}),
    },
  };
};

const assertJournalMatches = (journal, desired) => {
  if (journal && stableJson(journal) !== stableJson(desired.journal)) {
    fail('Незавершенная предыдущая запись имеет другой desired state', 'invalid_output_journal');
  }
};

export const writeManagedFiles = async ({
  output,
  overlay,
  baselinePath,
  baseline,
  baseUrl,
  group,
  savedApplied,
  revision,
  journal,
}) => {
  const desired = managedWrite({ output, overlay, baselinePath, baseline, baseUrl, group });
  const { overlayContents, markerContents, baselineContents, journal: nextJournal } = desired;
  assertJournalMatches(journal, desired);
  const partial = {
    savedApplied,
    revision,
    outputPath: output,
    ...(baselinePath ? { baselinePath } : {}),
  };
  try {
    if (!journal) await writeAtomic(`${output}${JOURNAL_SUFFIX}`, `${JSON.stringify(nextJournal, null, 2)}\n`);
    await writeAtomic(output, overlayContents);
    await writeAtomic(`${output}${MANAGED_SUFFIX}`, markerContents);
    if (baselineContents) await writeAtomic(baselinePath, baselineContents);
    await rm(`${output}${JOURNAL_SUFFIX}`, { force: true });
  } catch {
    throw new GmibInventoryError('GMIB saved hosts обновлены, но managed files записаны не полностью', {
      code: 'managed_file_partial',
      partial: true,
      ...partial,
    });
  }
};

export const managedFilesChanged = ({ outputState, output, overlay, baselinePath, baseline, baseUrl, group }) => {
  const { overlayContents, markerContents, baselineContents } = managedWrite({
    output,
    overlay,
    baselinePath,
    baseline,
    baseUrl,
    group,
  });
  return (
    Boolean(outputState.journal) ||
    outputState.raw !== overlayContents ||
    outputState.markerRaw !== markerContents ||
    (baselinePath && outputState.baselineRaw !== baselineContents)
  );
};

const getHosts = async client => {
  const result = await client.request('/api/manage/v1/hosts');
  return normalizeSnapshot(result.data);
};

const putHosts = async (client, snapshot, hosts, { dryRun }) => {
  try {
    const result = await client.request(`/api/manage/v1/hosts${dryRun ? '?dryRun=true' : ''}`, {
      method: 'PUT',
      body: { revision: snapshot.revision, hosts: sortedHosts(hosts) },
    });
    if (!isObject(result.data) || typeof result.data.changed !== 'boolean' || result.data.dryRun !== dryRun) {
      fail('GMIB вернул некорректный PUT hosts response', 'invalid_hosts_response');
    }
    const returned = normalizeSnapshot({
      revision: result.data.revision,
      saved: result.data.saved,
      discovered: [],
    });
    if (stableJson(sortedHosts(returned.saved)) !== stableJson(sortedHosts(hosts))) {
      fail('GMIB не подтвердил примененный saved hosts state', 'apply_unconfirmed');
    }
    return { ...result.data, revision: returned.revision, saved: returned.saved };
  } catch (error) {
    if (error instanceof GmibApiError && error.status === 412) {
      throw new GmibInventoryError('Saved hosts изменились параллельно; перечитайте snapshot и повторите', {
        code: 'hosts_revision_stale',
        status: 412,
      });
    }
    throw error;
  }
};

export const runImport = async (client, inventory, { check = false } = {}) => {
  const snapshot = await getHosts(client);
  const plan = importPlan(snapshot.saved, inventory);
  if (!plan.actions.length) return { changed: false, actions: [], revision: snapshot.revision };
  const result = await putHosts(client, snapshot, plan.hosts, { dryRun: check });
  return {
    changed: Boolean(result.changed),
    ...(check ? { checkMode: true } : {}),
    revision: result.revision,
    actions: plan.actions,
  };
};

export const runSync = async (
  client,
  inventory,
  baseline,
  {
    check = false,
    conflict = 'fail',
    output,
    group,
    baseUrl,
    aliases = new Map(),
    occupiedAliases = new Map(),
    journal,
    writeFiles,
    filesChanged = async () => true,
  } = {},
) => {
  const snapshot = await getHosts(client);
  const plan = syncPlan(snapshot.saved, inventory, baseline, { conflict });
  const changedSaved = stableJson(sortedHosts(snapshot.saved)) !== stableJson(sortedHosts(plan.hosts));
  const effectiveAliases = aliasesFor(plan.hosts, aliases, occupiedAliases);
  const overlay = overlayFor(plan.hosts, group, effectiveAliases);
  const observation = nextInventoryObservation(plan.hosts, inventory, baseline);
  const nextBaseline = baselineFor(
    baseUrl,
    group,
    plan.hosts,
    effectiveAliases,
    observation.observed,
    observation.overlayOnly,
  );
  const localChanged = await filesChanged({ overlay, baseline: nextBaseline });
  if (localChanged) {
    assertJournalMatches(
      journal,
      managedWrite({
        output,
        overlay,
        baselinePath: baseline?.path,
        baseline: nextBaseline,
        baseUrl,
        group,
      }),
    );
  }
  if (check) {
    const dryRun = changedSaved ? await putHosts(client, snapshot, plan.hosts, { dryRun: true }) : undefined;
    return {
      changed: changedSaved || localChanged,
      checkMode: true,
      revision: dryRun?.revision ?? snapshot.revision,
      actions: plan.actions,
    };
  }
  const persisted = changedSaved ? await putHosts(client, snapshot, plan.hosts, { dryRun: false }) : snapshot;
  if (!localChanged) {
    return { changed: changedSaved, revision: persisted.revision, actions: plan.actions };
  }
  try {
    await writeFiles({
      output,
      overlay,
      baselinePath: baseline?.path,
      baseline: nextBaseline,
      baseUrl,
      group,
      savedApplied: changedSaved,
      revision: persisted.revision,
      journal,
    });
  } catch (error) {
    if (error instanceof GmibInventoryError) throw error;
    throw new GmibInventoryError('GMIB saved hosts обновлены, но managed files записаны не полностью', {
      code: 'managed_file_partial',
      partial: true,
      savedApplied: changedSaved,
      revision: persisted.revision,
      outputPath: output,
      ...(baseline?.path ? { baselinePath: baseline.path } : {}),
    });
  }
  return { changed: changedSaved || localChanged, revision: persisted.revision, actions: plan.actions };
};

const readInventoryInput = async options => {
  const fromJson = options['inventory-json'];
  const fromInventory = options.inventory;
  if (Boolean(fromJson) === Boolean(fromInventory?.length)) {
    fail('Укажите ровно один --inventory-json или --inventory', 'invalid_arguments');
  }
  if (fromJson) return { value: await readJson(fromJson, 'inventory_read_error'), source: resolve(fromJson) };
  try {
    const inventoryArgs = fromInventory.flatMap(filename => ['-i', filename]);
    const { stdout } = await execFileAsync('ansible-inventory', ['--list', ...inventoryArgs], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      timeout: 30_000,
    });
    return { value: JSON.parse(stdout), source: fromInventory.map(filename => resolve(filename)) };
  } catch {
    fail('Не удалось получить ansible-inventory JSON; сохраните snapshot и используйте --inventory-json', 'inventory_command_failed');
  }
};

const booleanOptions = new Set(['apply', 'check', 'help', 'password-stdin']);
const valueOptions = new Set([
  'base-url',
  'baseline',
  'client-id',
  'conflict',
  'group',
  'inventory',
  'inventory-json',
  'output',
  'password-env',
  'password-file',
  'timeout-ms',
]);

const parseArgs = argv => {
  const [command, ...rest] = argv;
  const options = {};
  const seen = new Set();
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) fail(`Неожиданный аргумент: ${token}`, 'invalid_arguments');
    const name = token.slice(2);
    if (!booleanOptions.has(name) && !valueOptions.has(name)) fail(`Неизвестная опция: --${name}`, 'invalid_arguments');
    if (seen.has(name) && name !== 'inventory') fail(`Опция --${name} указана несколько раз`, 'invalid_arguments');
    seen.add(name);
    if (booleanOptions.has(name)) options[name] = true;
    else {
      const value = rest[index + 1];
      if (!value || value.startsWith('--')) fail(`Не задано значение --${name}`, 'invalid_arguments');
      if (name === 'inventory') options[name] = [...(options[name] ?? []), value];
      else options[name] = value;
      index += 1;
    }
  }
  return { command, options };
};

const readProtectedFile = async filename => {
  let stat;
  try {
    stat = await lstat(filename);
  } catch {
    fail('Не удалось открыть файл пароля', 'password_file_error');
  }
  if (!stat.isFile() || (stat.mode & 0o077) !== 0) {
    fail('Файл пароля должен быть обычным и недоступным группе/другим', 'unsafe_password_file');
  }
  try {
    return await readFile(filename, 'utf8');
  } catch {
    fail('Не удалось прочитать файл пароля', 'password_file_error');
  }
};

let stdinPromise;
let stdinConsumer;
const readStdin = consumer => {
  if (stdinConsumer && stdinConsumer !== consumer) fail('stdin можно использовать только один раз', 'stdin_conflict');
  stdinConsumer = consumer;
  stdinPromise ??= new Promise((resolve, reject) => {
    let value = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      value += chunk;
    });
    process.stdin.once('end', () => resolve(value));
    process.stdin.once('error', reject);
  });
  return stdinPromise;
};

const readPassword = async options => {
  const sources = [
    options['password-env'] && ['env', options['password-env']],
    options['password-file'] && ['file', options['password-file']],
    options['password-stdin'] && ['stdin'],
  ].filter(Boolean);
  if (sources.length > 1) fail('Укажите один источник --password-*', 'invalid_arguments');
  const [kind, value] = sources[0] ?? ['env', 'GMIB_PASSWORD'];
  const password =
    kind === 'env' ? (process.env[value] ?? '') : kind === 'file' ? await readProtectedFile(value) : await readStdin('password');
  const normalized = password.replace(/\r?\n$/, '');
  if (!normalized) fail('Пароль не задан', 'password_required');
  return normalized;
};

const writeResult = value => process.stdout.write(`${JSON.stringify(value)}\n`);

export const errorResult = error => {
  const known = error instanceof GmibApiError ? error : undefined;
  return {
    ok: false,
    error: {
      code: known?.code ?? 'internal_error',
      message: known?.message ?? 'Внутренняя ошибка inventory helper',
      ...(known?.status ? { status: known.status } : {}),
      ...(known?.partial ? { partial: true } : {}),
      ...(known?.savedApplied !== undefined ? { savedApplied: known.savedApplied } : {}),
      ...(known?.revision !== undefined ? { revision: known.revision } : {}),
      ...(known?.outputPath ? { outputPath: known.outputPath } : {}),
      ...(known?.baselinePath ? { baselinePath: known.baselinePath } : {}),
      ...(known?.conflicts ? { conflicts: known.conflicts } : {}),
    },
  };
};

export const prepareMutationPaths = async ({ output, baseline, source, baseUrl, group }) => {
  if (!output) fail('--output обязателен', 'invalid_arguments');
  const resolvedOutput = resolve(output);
  const resolvedBaseline = baseline ? resolve(baseline) : undefined;
  const sources = Array.isArray(source) ? source : [source];
  await validateParent(resolvedOutput);
  if (resolvedBaseline) await validateParent(resolvedBaseline);
  await rejectSymlink(resolvedOutput);
  if (resolvedBaseline) await rejectSymlink(resolvedBaseline);
  const outputCanonical = await resolvedPath(resolvedOutput);
  const baselineCanonical = resolvedBaseline && (await resolvedPath(resolvedBaseline));
  const markerCanonical = await resolvedPath(`${resolvedOutput}${MANAGED_SUFFIX}`);
  const journalCanonical = await resolvedPath(`${resolvedOutput}${JOURNAL_SUFFIX}`);
  if (
    outputCanonical === baselineCanonical ||
    baselineCanonical === markerCanonical ||
    baselineCanonical === journalCanonical
  ) {
    fail('output, baseline и input должны быть разными файлами', 'unsafe_paths');
  }
  const outputState = await ensureManagedOutput(resolvedOutput, { baseUrl, group });
  const sourceCanonical = await Promise.all(sources.filter(Boolean).map(resolvedPath));
  for (let index = 0; index < sourceCanonical.length; index += 1) {
    const current = sourceCanonical[index];
    if (current === baselineCanonical || current === markerCanonical || current === journalCanonical) {
      fail('output, baseline и input должны быть разными файлами', 'unsafe_paths');
    }
    if (current === outputCanonical && !outputState.raw) {
      fail('Managed output должен быть проверен перед использованием как input', 'unsafe_paths');
    }
  }
  const baselineRaw = resolvedBaseline && (await exists(resolvedBaseline)) ? await readFile(resolvedBaseline, 'utf8') : undefined;
  if (baselineRaw) await readBaseline(resolvedBaseline, { baseUrl, group });
  return {
    output: resolvedOutput,
    baseline: resolvedBaseline,
    outputState: { ...outputState, baselineRaw },
    sourceCanonical,
    outputCanonical,
  };
};

export const main = async (argv = process.argv.slice(2)) => {
  const { command, options } = parseArgs(argv);
  if (options.help || command === '--help' || !command) {
    process.stdout.write(HELP);
    return;
  }
  if (!['list', 'export', 'import', 'sync'].includes(command)) fail('Неизвестная команда', 'invalid_arguments');
  if (options.apply && options.check) fail('--apply и --check несовместимы', 'invalid_arguments');
  const mutates = ['export', 'import', 'sync'].includes(command);
  if (mutates && !options.apply && !options.check) fail('Для mutation укажите --apply или --check', 'apply_required');
  const group = options.group ?? DEFAULT_GROUP;
  const password = await readPassword(options);
  const client = new GmibApiClient({
    baseUrl: options['base-url'] ?? process.env.GMIB_BASE_URL,
    clientId: options['client-id'] ?? process.env.GMIB_CLIENT_ID,
    password,
    timeoutMs: Number(options['timeout-ms'] ?? 10_000),
  });
  const baseUrl = normalizeOrigin(options['base-url'] ?? process.env.GMIB_BASE_URL);
  try {
    const execute = async () => {
    if (command === 'list') {
      const snapshot = await getHosts(client);
      writeResult({ ok: true, revision: snapshot.revision, saved: snapshot.saved, discovered: snapshot.discovered });
      return;
    }
    if (command === 'export') {
      const paths = await prepareMutationPaths({
        output: options.output,
        source: '',
        baseline: options.baseline,
        baseUrl,
        group,
      });
      const snapshot = await getHosts(client);
      const aliases = aliasesFor(snapshot.saved, paths.outputState.aliases);
      const overlay = overlayFor(snapshot.saved, group, aliases);
      const baseline = paths.baseline ? baselineFor(baseUrl, group, snapshot.saved, aliases) : undefined;
      const localChanged = managedFilesChanged({
        outputState: paths.outputState,
        output: paths.output,
        overlay,
        baselinePath: paths.baseline,
        baseline,
        baseUrl,
        group,
      });
      if (options.check) {
        writeResult({ ok: true, changed: localChanged, checkMode: true, revision: snapshot.revision, actions: localChanged ? [{ kind: 'export' }] : [] });
        return;
      }
      if (localChanged) {
        await writeManagedFiles({
          output: paths.output,
          overlay,
          baselinePath: paths.baseline,
          baseline,
          baseUrl,
          group,
          savedApplied: false,
          revision: snapshot.revision,
          journal: paths.outputState.journal,
        });
      }
      writeResult({ ok: true, changed: localChanged, revision: snapshot.revision, actions: localChanged ? [{ kind: 'export' }] : [] });
      return;
    }
    const input = await readInventoryInput(options);
    const inputContext = inventoryAliasContext(input.value, group);
    const records = inputContext.records;
    if (command === 'import') {
      const result = await runImport(client, records, { check: Boolean(options.check) });
      writeResult({ ok: true, ...result });
      return;
    }
    const paths = await prepareMutationPaths({
      output: options.output,
      baseline: options.baseline,
      source: input.source,
      baseUrl,
      group,
    });
    if (!paths.baseline) fail('--baseline обязателен для sync', 'invalid_arguments');
    if (Array.isArray(input.source) && paths.outputState.raw) {
      if (paths.sourceCanonical[0] !== paths.outputCanonical) {
        fail('Повторный sync требует --inventory OUTPUT первым источником', 'inventory_overlay_order');
      }
    }
    const baseline = (await exists(paths.baseline))
      ? { ...(await readBaseline(paths.baseline, { baseUrl, group })), path: paths.baseline }
      : { saved: [], inventoryObserved: [], overlayOnly: [], aliases: new Map(), path: paths.baseline };
    const result = await runSync(client, records, baseline, {
      check: Boolean(options.check),
      conflict: options.conflict ?? 'fail',
      output: paths.output,
      group,
      baseUrl,
      aliases: new Map([
        ...baseline.aliases,
        ...paths.outputState.aliases,
        ...inputContext.aliases,
      ]),
      occupiedAliases: inputContext.occupied,
      journal: paths.outputState.journal,
      writeFiles: writeManagedFiles,
      filesChanged: ({ overlay, baseline: nextBaseline }) =>
        managedFilesChanged({
          outputState: paths.outputState,
          output: paths.output,
          overlay,
          baselinePath: paths.baseline,
          baseline: nextBaseline,
          baseUrl,
          group,
        }),
    });
    writeResult({ ok: true, ...result });
    };
    if (options.apply && (command === 'export' || command === 'sync')) {
      if (!options.output) fail('--output обязателен', 'invalid_arguments');
      return await withApplyLock(resolve(options.output), execute);
    }
    return await execute();
  } finally {
    client.clearSession();
  }
};

const readBaseline = async (filename, context) => parseBaseline(await readJson(filename, 'baseline_read_error'), context);

const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (invokedDirectly) {
  main().catch(error => {
    const result = errorResult(error);
    writeResult(result);
    process.stderr.write(`gmib-api-inventory: ${result.error.code}\n`);
    process.exitCode = error instanceof GmibApiError && error.status === 401 ? 3 : 2;
  });
}
