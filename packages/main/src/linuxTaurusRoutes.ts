import { execFile, type ExecFileOptionsWithStringEncoding } from 'node:child_process';
import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { matchesGlob, posix } from 'node:path';

import type { WindowsTaurusAdapter, WindowsTaurusRouteStatus } from '/@common/windowsTaurusRoutes';

const commandOptions = {
  encoding: 'utf8',
  timeout: 5000,
  maxBuffer: 1024 * 1024,
  env: { PATH: '/usr/sbin:/usr/bin:/sbin:/bin', LC_ALL: 'C.UTF-8' },
} satisfies ExecFileOptionsWithStringEncoding;

function run(
  file: string,
  args: string[],
  options: ExecFileOptionsWithStringEncoding,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout) => {
      if (error) reject(Object.assign(new Error(error.message), { code: error.code }));
      else resolve(stdout);
    });
  });
}
const rndisDriver = 'rndis_host';
const taurusUsbVendor = '2207';
const taurusUsbProduct = '0013';
const deviceIdPrefix = `usb:${taurusUsbVendor}:${taurusUsbProduct}:`;

type RndisInterface = {
  name: string;
  permanentMac?: string;
};

type LinuxRndisAdapter = RndisInterface & {
  serialNumber: string;
  interfaceIndex: number;
};

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matchGlob(value: string, pattern: unknown): boolean | undefined {
  // Limit matching to the subset with shared shell glob and Node.js semantics.
  if (typeof pattern !== 'string' || !/^[a-zA-Z0-9_.:*?-]+$/.test(pattern)) {
    return undefined;
  }
  return matchesGlob(value, pattern);
}

function matchEthernet(
  id: string,
  config: Record<string, unknown>,
  adapter: RndisInterface,
): boolean | undefined {
  const match = config.match;
  if (match === undefined) return id === adapter.name;
  if (!isMapping(match)) return undefined;

  const conditions = Object.entries(match).map(([field, pattern]) => {
    switch (field) {
      case 'driver': {
        const drivers = Array.isArray(pattern) ? pattern : [pattern];
        const matches = drivers.map(driver => matchGlob(rndisDriver, driver));
        return matches.includes(true) || (matches.includes(undefined) ? undefined : false);
      }
      case 'name':
        return matchGlob(adapter.name, config['set-name'] ?? pattern);
      case 'macaddress':
        return typeof pattern === 'string' && adapter.permanentMac
          ? adapter.permanentMac.toLowerCase() === pattern.toLowerCase()
          : undefined;
      default:
        return undefined;
    }
  });

  if (config['set-name'] !== undefined && match.name === undefined) {
    conditions.push(matchGlob(adapter.name, config['set-name']));
  }
  if (conditions.includes(false)) return false;
  return conditions.includes(undefined) ? undefined : true;
}

export function classifyLinuxTaurusProtection(
  config: unknown,
  adapter: RndisInterface,
): WindowsTaurusAdapter['protection'] {
  if (!isMapping(config)) return 'unknown';
  if (config.network === undefined) return 'missing';
  const network = config.network;
  if (!isMapping(network)) return 'unknown';
  const ethernets = network.ethernets ?? {};
  if (!isMapping(ethernets)) return 'unknown';

  // Netplan generates 10-netplan-<id>.network files. networkd selects the
  // first matching file in lexical order, including the extension.
  const ids = Object.keys(ethernets).filter(id => id !== 'renderer');
  if (ids.some(id => !/^[a-zA-Z0-9_.~-]+$/.test(id))) return 'unknown';
  const definitions = ids
    .map(id => ({ id, file: `${id}.network`, definition: ethernets[id] }))
    .sort((left, right) => (left.file < right.file ? -1 : 1));

  let result: WindowsTaurusAdapter['protection'] = 'missing';
  for (const { id, definition } of definitions) {
    if (!isMapping(definition)) return 'unknown';
    const matches = matchEthernet(id, definition, adapter);
    if (matches === false) continue;
    const renderer = definition.renderer ?? ethernets.renderer ?? network.renderer ?? 'networkd';
    if (matches === undefined || renderer !== 'networkd') return 'unknown';
    const overrides = definition['dhcp4-overrides'];
    result =
      definition.dhcp4 === true &&
      isMapping(overrides) &&
      overrides['use-routes'] === false &&
      overrides['use-dns'] === false
        ? 'enabled'
        : 'missing';
    break;
  }
  // A matching NetworkManager profile can compete with the networkd
  // configuration irrespective of the ordering of the generated files.
  if (
    definitions.some(
      ({ id, definition }) =>
        isMapping(definition) &&
        (definition.renderer ?? ethernets.renderer ?? network.renderer ?? 'networkd') !==
          'networkd' &&
        matchEthernet(id, definition, adapter) !== false,
    )
  ) {
    return 'unknown';
  }
  return result;
}

export function getLinuxTaurusDefaultRoutes(
  routes: unknown[],
  name: string,
): WindowsTaurusAdapter['defaultRoutes'] {
  return routes.flatMap(route => {
    if (
      !isMapping(route) ||
      (route.dst !== 'default' && route.dst !== '0.0.0.0/0') ||
      (route.type !== undefined && route.type !== 'unicast')
    ) {
      return [];
    }

    const nexthops = Array.isArray(route.nexthops) ? route.nexthops : [route];
    return nexthops.flatMap(nextHop =>
      isMapping(nextHop) && nextHop.dev === name
        ? [
            {
              nextHop: typeof nextHop.gateway === 'string' ? nextHop.gateway : '0.0.0.0',
              metric: typeof route.metric === 'number' ? route.metric : 0,
              table:
                typeof route.table === 'string' || typeof route.table === 'number'
                  ? String(route.table)
                  : 'main',
            },
          ]
        : [],
    );
  });
}

async function readAttribute(directory: string, attribute: string): Promise<string> {
  return readFile(posix.join(directory, attribute), 'utf8')
    .then(value => value.trim())
    .catch(() => '');
}

async function readPhysicalTaurusSerial(device: string): Promise<string> {
  if (!device.startsWith('/sys/devices/')) return '';
  const parent = posix.dirname(device);
  const [iface, physical, vendor, product, serial] = await Promise.all([
    readAttribute(device, 'uevent'),
    readAttribute(parent, 'uevent'),
    readAttribute(parent, 'idVendor'),
    readAttribute(parent, 'idProduct'),
    readAttribute(parent, 'serial'),
  ]);
  // rndis_host binds to a USB interface whose direct parent is the physical
  // USB device. Never walk above this parent and mistake a hub for Taurus.
  return iface.split('\n').includes('DEVTYPE=usb_interface') &&
    physical.split('\n').includes('DEVTYPE=usb_device') &&
    vendor === taurusUsbVendor &&
    product === taurusUsbProduct
    ? serial
    : '';
}

async function listRndisInterfaces(): Promise<LinuxRndisAdapter[]> {
  const sysNet = '/sys/class/net';
  const names = await readdir(sysNet);
  const adapters = await Promise.all(
    names.sort().map(async name => {
      const entry = posix.join(sysNet, name);
      const device = await realpath(posix.join(entry, 'device')).catch(() => '');
      if (!device) return undefined;
      const driver = await realpath(posix.join(device, 'driver')).catch(() => '');
      if (posix.basename(driver) !== rndisDriver) return undefined;

      const [index, serialNumber, address, addressType] = await Promise.all([
        readAttribute(entry, 'ifindex'),
        readPhysicalTaurusSerial(device),
        readAttribute(entry, 'address'),
        readAttribute(entry, 'addr_assign_type'),
      ]);
      const interfaceIndex = Number(index);
      if (!serialNumber || !Number.isInteger(interfaceIndex) || interfaceIndex <= 0)
        return undefined;
      return {
        name,
        interfaceIndex,
        serialNumber,
        permanentMac: addressType === '0' ? address : undefined,
      };
    }),
  );
  return adapters.filter(adapter => adapter !== undefined);
}

async function readNetplanConfig(): Promise<unknown> {
  // "netplan get" is read-only and takes care of Netplan's file precedence.
  // Keep YAML and command errors inside this diagnostic. The YAML can contain secrets.
  const script = [
    'import json, subprocess, yaml',
    'result = subprocess.run(["netplan", "get"], capture_output=True, check=True, timeout=4)',
    'if b"permission denied" in result.stderr.lower(): raise SystemExit(1)',
    'print(json.dumps(yaml.safe_load(result.stdout) or {}))',
  ].join('\n');
  const stdout = await run('/usr/bin/python3', ['-I', '-c', script], commandOptions);
  return JSON.parse(stdout) as unknown;
}

function isOpaqueDefaultRoute(route: unknown): boolean {
  return (
    isMapping(route) &&
    (route.dst === 'default' || route.dst === '0.0.0.0/0') &&
    (route.type === undefined || route.type === 'unicast') &&
    route.nhid !== undefined &&
    !route.dev &&
    (!Array.isArray(route.nexthops) || route.nexthops.length === 0)
  );
}

async function readRoutes(): Promise<unknown[]> {
  const stdout = await run('ip', ['-j', '-4', 'route', 'show', 'table', 'all'], commandOptions);
  const routes: unknown = JSON.parse(stdout);
  if (!Array.isArray(routes)) throw new Error('Invalid ip route response');
  const result: unknown[] = routes;
  return result;
}

export async function inspectLinuxTaurusRoutes(): Promise<WindowsTaurusRouteStatus> {
  const status: WindowsTaurusRouteStatus = {
    supported: true,
    platform: 'linux',
    elevated: process.getuid?.() === 0,
    adapters: [],
  };
  const adapters = await listRndisInterfaces().catch(() => undefined);
  if (!adapters) {
    return {
      ...status,
      routeInspectionComplete: false,
      diagnostic: 'Не удалось прочитать сетевые интерфейсы Linux.',
    };
  }
  if (!adapters.length) return status;

  const [routes, config, automatic] = await Promise.all([
    readRoutes().catch(() => undefined),
    readNetplanConfig().catch(() => undefined),
    readAutomaticState(),
  ]);
  const routeInspectionComplete = routes !== undefined && !routes.some(isOpaqueDefaultRoute);
  const diagnostic = [
    !routeInspectionComplete ? 'Не удалось полностью проверить текущие IPv4-маршруты.' : '',
    config === undefined ? 'Не удалось прочитать конфигурацию Netplan.' : '',
    automatic === true
      ? 'Правило Netplan сохранено. Для применения перезагрузите компьютер. До применения DHCP может вернуть маршрут.'
      : '',
  ]
    .filter(Boolean)
    .join(' ');
  return {
    ...status,
    diagnostic: diagnostic || undefined,
    routeInspectionComplete,
    adapters: adapters.map(({ serialNumber, name, interfaceIndex, permanentMac }) => ({
      deviceId: deviceIdPrefix + serialNumber,
      serialNumber,
      interfaceAlias: name,
      interfaceIndex,
      interfaceGuid: '',
      defaultRoutes: getLinuxTaurusDefaultRoutes(routes ?? [], name),
      dnsServers: [],
      autoEnabled: automatic,
      automaticSupported: isPolicyRendererSupported(config),
      protection: classifyLinuxTaurusProtection(config, { name, permanentMac }),
    })),
  };
}

const usbIdentityScript = String.raw`
sys_net = pathlib.Path('/sys/class/net')

def read(path):
    try:
        return path.read_text().strip()
    except OSError:
        return ''

def selected_adapter():
    matches = []
    for entry in sys_net.iterdir():
        device = (entry / 'device').resolve()
        driver = (device / 'driver').resolve()
        if driver.name != 'rndis_host' or not str(device).startswith('/sys/devices/'):
            continue
        if 'DEVTYPE=usb_interface' not in read(device / 'uevent').splitlines():
            continue
        parent = device.parent
        if (
            'DEVTYPE=usb_device' in read(parent / 'uevent').splitlines()
            and read(parent / 'idVendor') == vendor
            and read(parent / 'idProduct') == product
            and read(parent / 'serial') == serial
        ):
            index = read(entry / 'ifindex')
            if index.isdecimal() and int(index) > 0:
                matches.append((entry.name, int(index), parent))
    if len(matches) != 1:
        sys.exit(11)
    return matches[0]

`;

const repairScript = String.raw`
import ipaddress, json, os, pathlib, re, subprocess, sys

if os.geteuid() != 0:
    sys.exit(10)

serial, vendor, product = sys.argv[1:]
${usbIdentityScript}

def ip(*args):
    return subprocess.run(
        ['ip', *args], check=True, capture_output=True, timeout=2,
        env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LC_ALL': 'C'},
    ).stdout

def route_deletions(name):
    result = []
    for route in json.loads(ip('-j', '-4', 'route', 'show', 'table', 'all')):
        if route.get('dst') not in ('default', '0.0.0.0/0') or route.get('type', 'unicast') != 'unicast':
            continue
        # Never remove a route shared by more than one interface or routed
        # through a nexthop group that this command cannot fully identify.
        if 'nexthops' in route or 'nhid' in route:
            next_hops = route.get('nexthops', [])
            if route.get('dev') == name or any(hop.get('dev') == name for hop in next_hops):
                sys.exit(12)
            if 'nhid' in route and not next_hops and not route.get('dev'):
                sys.exit(12)
            continue
        if route.get('dev') != name:
            continue
        table = str(route.get('table', 'main'))
        metric = route.get('metric', 0)
        gateway = route.get('gateway')
        if not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.-]*', table) or type(metric) is not int or metric < 0:
            sys.exit(12)
        if gateway is not None:
            gateway = str(ipaddress.IPv4Address(gateway))
        # Require a gateway so an omitted via argument cannot match an
        # unrelated gateway installed after the read.
        if not gateway or gateway == '0.0.0.0':
            sys.exit(12)
        result.append(('default', 'table', table, 'via', gateway, 'dev', name, 'metric', str(metric)))
    return result

try:
    adapter = selected_adapter()
    name = adapter[0]
    if name.startswith('-'):
        sys.exit(12)
    for route in route_deletions(name):
        current_routes = route_deletions(name)
        if selected_adapter() != adapter:
            sys.exit(11)
        if route in current_routes:
            ip('-4', 'route', 'del', *route)
    remaining = route_deletions(name)
    if selected_adapter() != adapter:
        sys.exit(11)
    if remaining:
        sys.exit(13)
    print('Taurus IPv4 default route: removed or already absent. DHCP may restore it.')
except (OSError, ValueError, subprocess.SubprocessError):
    sys.exit(14)
`;

async function requireUniqueLinuxTaurusSerial(deviceId: string): Promise<string> {
  const adapters = await listRndisInterfaces();
  const matches = adapters.filter(adapter => deviceIdPrefix + adapter.serialNumber === deviceId);
  if (matches.length !== 1) {
    throw new Error(
      'Не удалось однозначно определить подключённый USB-адаптер по серийному номеру.',
    );
  }
  return matches[0].serialNumber;
}

function repairArguments(serial: string): string[] {
  return ['-I', '-c', repairScript, serial, taurusUsbVendor, taurusUsbProduct];
}

function quoteLinuxTaurusCommandArgument(argument: string): string {
  return "'" + argument.replaceAll("'", "'\\''") + "'";
}

export async function buildLinuxTaurusRouteCommand(deviceId: string): Promise<string> {
  const serial = await requireUniqueLinuxTaurusSerial(deviceId);
  return (
    'sudo /usr/bin/python3 ' +
    repairArguments(serial).map(quoteLinuxTaurusCommandArgument).join(' ')
  );
}

export async function repairLinuxTaurusRoutes(deviceId: string): Promise<void> {
  if (process.getuid?.() !== 0) {
    throw new Error('Для удаления маршрута нужны права root.');
  }
  const serial = await requireUniqueLinuxTaurusSerial(deviceId);
  try {
    await run('/usr/bin/python3', repairArguments(serial), {
      ...commandOptions,
      timeout: 15000,
    });
  } catch (error) {
    if (isMapping(error)) {
      switch (error.code) {
        case 11:
          throw new Error('USB-адаптер отключён, изменился или его серийный номер неоднозначен.');
        case 12:
          throw new Error('Не удалось однозначно определить маршрут для удаления.');
        case 13:
          throw new Error('После удаления у USB-адаптера остался маршрут по умолчанию.');
      }
    }
    throw new Error('Не удалось удалить или проверить текущий IPv4-маршрут.');
  }
}

const policyFilename = '90-gmib-taurus-rndis.yaml';
const policyId = '00-gmib-taurus-rndis';
const policyPath = `/etc/netplan/${policyFilename}`;
const netplanPolicy = `# Managed by GMIB
network:
  version: 2
  ethernets:
    ${policyId}:
      match:
        driver: rndis_host
      dhcp4: true
      link-local: [ipv4, ipv6]
      dhcp4-overrides:
        use-routes: false
        use-dns: false
      optional: true
`;

function isPolicyRendererSupported(config: unknown): boolean | undefined {
  if (!isMapping(config) || !isMapping(config.network)) return undefined;
  const renderer = config.network.renderer;
  if (renderer !== undefined && renderer !== 'networkd') return false;
  const ethernets = config.network.ethernets;
  if (
    isMapping(ethernets) &&
    ethernets.renderer !== undefined &&
    ethernets.renderer !== 'networkd'
  ) {
    return false;
  }
  return undefined;
}

async function readAutomaticState(): Promise<boolean | undefined> {
  try {
    const metadata = await lstat(policyPath);
    if (!metadata.isFile() || metadata.uid !== 0 || (metadata.mode & 0o777) !== 0o600) {
      return undefined;
    }
    try {
      return (await readFile(policyPath, 'utf8')) === netplanPolicy || undefined;
    } catch (error) {
      if (isMapping(error) && error.code === 'EACCES') return true;
      return undefined;
    }
  } catch (error) {
    return isMapping(error) && error.code === 'ENOENT' ? false : undefined;
  }
}

const automaticScript = String.raw`
import fcntl, fnmatch, os, pathlib, re, shutil, stat, subprocess, sys, tempfile, yaml

if os.geteuid() != 0:
    sys.exit(10)
serial, vendor, product, enabled, repair = sys.argv[1:]
if enabled not in ('yes', 'no'):
    sys.exit(15)
${usbIdentityScript}

netplan_directory = pathlib.Path('/etc/netplan')
policy = netplan_directory / '${policyFilename}'
policy_id = '${policyId}'
contents = ${JSON.stringify(netplanPolicy)}.encode()
environment = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LC_ALL': 'C.UTF-8'}

def command(*args):
    return subprocess.run(
        list(args), check=True, capture_output=True, timeout=8, env=environment,
    ).stdout

def owns_policy():
    try:
        metadata = policy.lstat()
    except FileNotFoundError:
        return False
    if (
        not stat.S_ISREG(metadata.st_mode)
        or metadata.st_uid != 0
        or stat.S_IMODE(metadata.st_mode) != 0o600
        or policy.read_bytes() != contents
    ):
        sys.exit(15)
    return True

def matching_rndis(profile):
    match = profile.get('match', {})
    drivers = match.get('driver', []) if isinstance(match, dict) else []
    if isinstance(drivers, str):
        drivers = [drivers]
    return not drivers or any(fnmatch.fnmatchcase('rndis_host', driver) for driver in drivers)

def verify_renderer(index, owned):
    # Check both the merged configuration and the actual network manager.
    network = yaml.safe_load(command('netplan', 'get')).get('network', {})
    ethernets = network.get('ethernets', {})
    renderer = ethernets.get('renderer', network.get('renderer', 'networkd'))
    if renderer != 'networkd':
        sys.exit(16)
    if policy_id in ethernets and not owned:
        sys.exit(15)
    for profile in ethernets.values():
        if isinstance(profile, dict) and matching_rndis(profile) and profile.get('renderer', renderer) != 'networkd':
            sys.exit(16)
    status = command('networkctl', '--no-pager', '--lines=0', 'status', str(index)).decode()
    network_file = re.search(r'^\s*Network File:\s+(/run/systemd/network/10-netplan-[^\s]+\.network)', status, re.M)
    if not network_file:
        sys.exit(16)
    # Earlier Netplan rules would keep precedence over the added profile.
    if not owned and pathlib.Path(network_file.group(1)).name < '10-netplan-' + policy_id + '.network':
        sys.exit(16)

def validate_staged():
    with tempfile.TemporaryDirectory(prefix='gmib-netplan-') as temporary:
        root = pathlib.Path(temporary)
        for scope in ('lib', 'etc', 'run'):
            source = pathlib.Path('/') / scope / 'netplan'
            target = root / scope / 'netplan'
            target.mkdir(parents=True)
            for original in source.glob('*.yaml'):
                if original == policy:
                    continue
                if original.name == policy.name:
                    sys.exit(15)
                copied = target / original.name
                shutil.copyfile(original, copied)
                copied.chmod(0o600)
        if enabled == 'yes':
            staged_policy = root / 'etc/netplan' / policy.name
            staged_policy.write_bytes(contents)
            staged_policy.chmod(0o600)
        command('netplan', 'generate', '--root-dir', str(root))
        if enabled == 'yes':
            generated = root / 'run/systemd/network' / ('10-netplan-' + policy_id + '.network')
            result = generated.read_text()
            if not all(line in result.splitlines() for line in ('Driver=rndis_host', 'UseRoutes=false', 'UseDNS=false')):
                sys.exit(16)

def install_policy():
    with tempfile.NamedTemporaryFile(dir=netplan_directory, delete=False) as temporary:
        path = pathlib.Path(temporary.name)
        temporary.write(contents)
        os.fchmod(temporary.fileno(), 0o600)
    try:
        # The destination must remain absent. Never replace an existing file.
        os.link(path, policy, follow_symlinks=False)
    finally:
        path.unlink(missing_ok=True)

try:
    adapter = selected_adapter()
    directory = os.open(netplan_directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        metadata = os.fstat(directory)
        if metadata.st_uid != 0 or metadata.st_mode & 0o022:
            sys.exit(15)
        fcntl.flock(directory, fcntl.LOCK_EX | fcntl.LOCK_NB)
        owned = owns_policy()
        if enabled == 'yes':
            verify_renderer(adapter[1], owned)
        if enabled == 'yes' or owned:
            validate_staged()
            if selected_adapter() != adapter:
                sys.exit(11)
        if enabled == 'yes' and not owned:
            install_policy()
        elif enabled == 'no' and owned:
            policy.unlink()
    finally:
        os.close(directory)
except (OSError, ValueError, TypeError, AttributeError, subprocess.SubprocessError, yaml.YAMLError):
    sys.exit(14)

if enabled == 'yes':
    print('GMIB Netplan policy saved. Reboot to apply it.')
    try:
        command('/usr/bin/python3', '-I', '-c', repair, serial, vendor, product)
    except (OSError, subprocess.SubprocessError):
        sys.exit(17)
    print('Current Taurus IPv4 default route removed or already absent. DHCP may restore it before reboot.')
else:
    print('GMIB Netplan policy removed. Reboot to apply the remaining Netplan configuration.')
`;

function automaticArguments(serial: string, enabled: boolean): string[] {
  return [
    '-I',
    '-c',
    automaticScript,
    serial,
    taurusUsbVendor,
    taurusUsbProduct,
    enabled ? 'yes' : 'no',
    enabled ? repairScript : '',
  ];
}

export async function buildLinuxTaurusAutomaticCommand(
  deviceId: string,
  enabled: boolean,
): Promise<string> {
  const serial = await requireUniqueLinuxTaurusSerial(deviceId);
  return (
    'sudo /usr/bin/python3 ' +
    automaticArguments(serial, enabled).map(quoteLinuxTaurusCommandArgument).join(' ')
  );
}

export async function configureLinuxTaurusAutomatic(
  deviceId: string,
  enabled: boolean,
): Promise<void> {
  if (process.getuid?.() !== 0) {
    throw new Error('Для настройки постоянной защиты Netplan нужны права root.');
  }
  const serial = await requireUniqueLinuxTaurusSerial(deviceId);
  try {
    await run('/usr/bin/python3', automaticArguments(serial, enabled), {
      ...commandOptions,
      timeout: 40000,
    });
  } catch (error) {
    if (isMapping(error)) {
      switch (error.code) {
        case 11:
          throw new Error('USB-адаптер отключён, изменился или его серийный номер неоднозначен.');
        case 15:
          throw new Error('Путь или имя правила уже используется другой конфигурацией Netplan.');
        case 16:
          throw new Error(
            'Текущая конфигурация Netplan и systemd-networkd не позволяет применить правило.',
          );
        case 17:
          throw new Error(
            'Правило Netplan сохранено. Перезагрузите компьютер, чтобы применить его. Текущий IPv4-маршрут удалить не удалось.',
          );
      }
    }
    throw new Error('Не удалось изменить правило Netplan для интерфейсов rndis_host.');
  }
}
