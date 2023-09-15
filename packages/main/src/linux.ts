import { app } from 'electron';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import debugFactory from 'debug';
import { config } from 'dotenv';
import { nanoid } from 'nanoid';

import { asyncSerial, delay } from '/@common/helpers';

import localConfig from './localConfig';
import pritunlFetch from './pritunlFetch';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:linux`);

const iconSrc = path.resolve(__dirname, '../../renderer/assets/icon64x64.png');
// const iconDst = path.join(app.getPath('userData'), path.basename(iconSrc));
const appDir = path.dirname(process.env['APPIMAGE'] ?? '');
const iconDst = path.join(appDir, path.basename(iconSrc));

// const envPath = path.join(app.getPath('userData'), 'vpn.env');
const envPath = path.join(appDir, 'vpn.env');
const pritunlClient = '/usr/bin/pritunl-client';

if (process.platform === 'linux') {
  debug(`env: ${envPath}`);
  config({ path: envPath });
}

const getAutostartPath = (): string => {
  const dir = path.join(app.getPath('appData'), 'autostart');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  return path.join(dir, `${app.getName()}.desktop`);
};

const getApplicationsPath = (): string =>
  path.join(app.getPath('home'), '.local/share/applications', `${app.getName()}.desktop`);

const getEntry = (): string => {
  const exe = process.env['APPIMAGE'];
  const name = app.getName();
  const version = app.getVersion();
  return `[Desktop Entry]
Type=Application
Version=${version}
Name=${name}
Exec=${exe} --no-sandbox
Icon=${iconDst}
Categories=Utility;
StartupWMClass=${name}
X-GNOME-Autostart-enabled=true
StartupNotify=false
X-GNOME-Autostart-delay=10
X-MATE-Autostart-delay=10
X-KDE-autostart-after=panel
Terminal=false`;
};

export const linuxAutostart = (autostart: boolean): void => {
  if (process.platform !== 'linux') return;
  const file = getAutostartPath();
  debug(`autostart entry: ${file}`);
  if (!autostart) {
    fs.existsSync(file) && fs.unlinkSync(file);
  } else {
    fs.writeFileSync(file, getEntry());
    fs.chmodSync(file, '644');
  }
};

export const linuxMakeDesktop = (): void => {
  if (process.platform !== 'linux') return;
  const file = getApplicationsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  debug(`desktop entry: ${file}`);
  fs.existsSync(iconDst) || fs.copyFileSync(iconSrc, iconDst);
  fs.writeFileSync(file, getEntry());
  fs.chmodSync(file, '644');
};

app.whenReady().then(linuxMakeDesktop);

type PritunlConnection = {
  id: string;
  name: string;
  state: 'Enabled' | 'Disabled';
  run_state: 'Active' | 'Inactive';
  registration_key: string;
  connected: boolean;
  uptime: number;
  status: 'Disconnected' | string; // '5 hours 46 mins 41 secs',
  server_address: string;
  client_address: string;
};

const getPritunlConnections = () =>
  new Promise<undefined | PritunlConnection[]>(resolve => {
    exec(`${pritunlClient} list -j`, (err, stdout, stderr) => {
      if (err) {
        debug(`error while run pritunl_client: ${(err as Error).message}`);
        resolve(undefined);
        return;
      }
      if (stderr) {
        debug(`stderr: ${stderr}`);
      }
      try {
        const connections = JSON.parse(stdout);
        resolve(connections);
      } catch (error) {
        debug(`error while parse JSON: ${(error as Error).message}`);
        resolve(undefined);
      }
    });
  });

const startPritunlConnection = (id: string) =>
  new Promise<boolean>(resolve => {
    exec(`${pritunlClient} start ${id}`, (err, _, stderr) => {
      if (err) {
        debug(`error while start connection: ${(err as Error).message} (${stderr})`);
      }
      resolve(!err);
    });
  });

const removePritunlConnection = (id: string) =>
  new Promise<boolean>(resolve => {
    exec(`${pritunlClient} remove ${id}`, (err, _, stderr) => {
      if (err) {
        debug(`error while remove connection: ${(err as Error).message} (${stderr})`);
      }
      resolve(!err);
    });
  });

const createPritunlUser = async (orgId: string, name: string): Promise<string | undefined> => {
  const api = `/user/${orgId}`;
  const data = {
    name,
    email: '',
    disabled: false,
    yubico_id: '',
    groups: [],
    pin: '',
    network_links: [],
    bypass_secondary: false,
    client_to_client: false,
    dns_servers: [],
    dns_suffix: '',
    port_forwarding: [],
  };
  const create = await pritunlFetch({ path: api, method: 'POST', data });
  return create?.[0]?.id;
};

const addPritunlProfiles = (url: string) =>
  new Promise<boolean>(resolve => {
    exec(`${pritunlClient} add ${url}`, (err, _, stderr) => {
      if (err) {
        debug(`error while add profile: ${(err as Error).message} (${stderr})`);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });

const initializePritunlClient = async () => {
  if (process.platform !== 'linux' || !fs.existsSync(pritunlClient)) return;
  let connections = await getPritunlConnections();
  if (!connections) return;
  if (connections.length === 0) {
    const orgId = process.env.ORGANIZATION_ID;
    const userPrefix = process.env.USER_PREFIX;
    const mainServer = process.env.MAIN_SERVER;
    if (!orgId || !process.env.PRITUNL_URL) return;
    const pritunlUrl = new URL(process.env.PRITUNL_URL);
    let userId = localConfig.get('pritunlUserId');
    if (!userId) {
      const name = userPrefix ? `${userPrefix}-${nanoid(6)}` : nanoid(8);
      debug(`create pritunl user: ${name}`);
      userId = await createPritunlUser(orgId, name);
      localConfig.set('pritunlUserId', userId);
      await delay(30);
    }
    if (!userId) return;
    const links = await pritunlFetch({ path: `/key/${orgId}/${userId}` });
    if (!links.uri_url) return;
    if (!(await addPritunlProfiles(`pritunl://${pritunlUrl.hostname}${links.uri_url}`))) return;
    connections = await getPritunlConnections();
    if (!connections || connections.length === 0) return;
    if (mainServer && connections.length > 1) {
      const re = new RegExp(`\\(${mainServer}\\)$`);
      const main = connections.find(({ name }) => re.test(name));
      if (main) {
        await asyncSerial(connections, connection =>
          connection !== main ? removePritunlConnection(connection.id) : Promise.resolve(true),
        );
        connections = [main];
      }
    }
  }
  const enabled = connections.filter(({ state }) => state !== 'Disabled');
  const isActive = enabled.reduce((res, { run_state }) => res || run_state === 'Active', false);
  if (!isActive) {
    const [first] = enabled;
    if (first) startPritunlConnection(first.id);
  }
  fs.existsSync(envPath) && fs.unlinkSync(envPath);
};

app.whenReady().then(initializePritunlClient);
