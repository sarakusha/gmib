import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';

// os.version() describes the kernel on Unix, not the installed OS release.
const clean = (value: string): string =>
  // OS metadata is displayed as a single line and sent in the existing bounded field.
  value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, 500);

export const parseOsRelease = (source: string): string | undefined => {
  const fields = new Map<string, string>();
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(PRETTY_NAME|NAME|VERSION|VERSION_ID)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith('"')) {
      if (!value.endsWith('"') || value.length < 2) continue;
      value = value.slice(1, -1).replace(/\\(["\\$`])/g, '$1');
    } else if (value.startsWith("'")) {
      if (!value.endsWith("'") || value.length < 2) continue;
      value = value.slice(1, -1);
    }
    // Read assignments as data; never source this file or expand shell expressions.
    fields.set(match[1], clean(value));
  }
  const prettyName = fields.get('PRETTY_NAME');
  if (prettyName) return prettyName;
  const name = fields.get('NAME');
  if (!name) return undefined;
  return clean([name, fields.get('VERSION') || fields.get('VERSION_ID')].filter(Boolean).join(' '));
};

export const collectOperatingSystem = (
  platform: NodeJS.Platform = process.platform,
  kernelVersion: () => string = os.version,
  readRelease: (path: string) => string = path => readFileSync(path, 'utf8'),
  readMacVersion: () => string = () =>
    execFileSync('/usr/bin/sw_vers', ['-productVersion'], {
      encoding: 'utf8',
      timeout: 1000,
      maxBuffer: 4096,
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
): string => {
  try {
    if (platform === 'darwin') {
      const version = readMacVersion().trim();
      if (/^\d+(?:\.\d+){1,3}$/.test(version)) return clean(`macOS ${version}`);
    } else if (platform === 'linux') {
      let source: string;
      try {
        source = readRelease('/etc/os-release');
      } catch (error) {
        // os-release gives /etc precedence; do not merge it with vendor metadata.
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        source = readRelease('/usr/lib/os-release');
      }
      const release = parseOsRelease(source);
      if (release) return release;
    }
  } catch {
    // Optional metadata must not prevent activation or periodic registration.
  }
  return clean(kernelVersion());
};

let operatingSystem: string | undefined;

export const getOperatingSystem = (): string => {
  operatingSystem ??= collectOperatingSystem();
  return operatingSystem;
};
