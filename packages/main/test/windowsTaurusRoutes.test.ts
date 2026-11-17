import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  buildTaurusAutomaticCommand,
  buildTaurusRouteCommand,
  createWindowsTaurusRoutes,
  validateTaurusUsbId,
} from '../src/windowsTaurusRoutes';

const id = 'USB\\VID_2207&PID_0013\\26707A000004040';
const powershell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
let hasPowerShell = false;
try {
  execFileSync(powershell, ['-NoProfile', '-Command', 'exit 0'], { stdio: 'ignore' });
  hasPowerShell = true;
} catch {
  /* Optional on non-Windows CI. */
}

describe('Taurus route commands', () => {
  it('rejects aliases, interface indices and command injection', () => {
    for (const bad of [
      47,
      'Ethernet 47',
      `${id}'; exit`,
      'USB\\VID_2207&PID_0013\\6&generated',
      undefined,
    ]) {
      expect(() => validateTaurusUsbId(bad)).toThrow();
    }
    expect(validateTaurusUsbId(id.toLowerCase())).toBe(id);
  });
  it('uses the same re-resolving script for repair and copy, and propagates failures', async () => {
    const run = vi.fn().mockRejectedValue(new Error('Access denied'));
    const service = createWindowsTaurusRoutes(run);
    await expect(service.repair(id)).rejects.toThrow('Access denied');
    expect(run).toHaveBeenCalledWith(service.commands(id));
    expect(buildTaurusRouteCommand(id)).toContain(`Repair-GmibTaurusRoute '${id}'`);
  });

  it('keeps the inline event action below the Windows command-line limit', () => {
    const command = buildTaurusAutomaticCommand(`USB\\VID_2207&PID_0013\\${'X'.repeat(64)}`, true);
    const payload = command.match(/\$true '([A-Za-z0-9+/=]+)'/)?.[1];
    expect(payload).toBeDefined();
    expect(payload!.length + 300).toBeLessThan(32_767);
  });
});

describe.skipIf(!hasPowerShell)(
  'actual PowerShell remediation with mocked Windows providers',
  () => {
    const scenario = (name: string, generated?: string) => {
      const folder =
        generated === undefined ? undefined : mkdtempSync(path.join(tmpdir(), 'gmib-taurus-'));
      try {
        const args = [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-File',
          path.join(import.meta.dirname, 'windowsTaurusRoutes.fixture.ps1'),
          '-Source',
          path.join(import.meta.dirname, '../src/windowsTaurusRoutes.ps1'),
          '-Scenario',
          name,
        ];
        if (folder && generated !== undefined) {
          const scriptPath = path.join(folder, 'command.ps1');
          writeFileSync(scriptPath, generated);
          args.push('-AutomaticScript', scriptPath);
        }
        return JSON.parse(execFileSync(powershell, args, { encoding: 'utf8', timeout: 15_000 }));
      } finally {
        if (folder) rmSync(folder, { recursive: true, force: true });
      }
    };

    it('resolves the new name/index, protects it, and preserves internet/subnet routes', () => {
      const result = scenario('renamed');
      expect(result.failure).toBeNull();
      expect(result.writes).toEqual(['protect:47', 'remove:47:0.0.0.0/0']);
      expect(result.routes).toHaveLength(2);
      expect(result.status.adapters[0]).toMatchObject({
        interfaceAlias: 'Ethernet 47',
        protection: 'enabled',
        defaultRoutes: [],
        dnsServers: ['192.169.110.254'],
      });
    });
    it.each(['no-admin', 'disconnected', 'ambiguous', 'unrelated-usb', 'location-id'])(
      'fails closed for %s',
      name => {
        const result = scenario(name);
        expect(result.failure).toBeTruthy();
        expect(result.writes).toEqual([]);
      },
    );
    it('does not mutate when a copied command no longer has a default route to remove', () => {
      expect(scenario('no-default')).toMatchObject({ failure: null, writes: [] });
    });
    it.each(['permission-error', 'replug-during-repair'])('stops before deletion on %s', name => {
      const result = scenario(name);
      expect(result.failure).toBeTruthy();
      expect(result.writes).toEqual(['protect:47']);
    });
    it('reports failure if the default route persists', () => {
      expect(scenario('route-persists').failure).toContain('Could not verify');
    });

    it('rejects route deletion when an interface changes during the route query', () => {
      expect(scenario('replug-during-route-query')).toMatchObject({
        writes: ['protect:47'],
        failure: expect.stringContaining('USB adapter changed'),
      });
    });

    it('creates a protected SYSTEM task with startup and connected events only', () => {
      const result = scenario('enable-auto', buildTaurusAutomaticCommand(id, true));
      expect(result.failure).toBeNull();
      expect(result.writes).toEqual(['register-task', 'enabled:True', 'run-task']);
      expect(result.registration).toMatchObject({
        name: 'GMIB-Taurus-26707A000004040',
        flags: 18,
        user: 'S-1-5-18',
        logon: 5,
        sddl: 'O:SYG:SYD:P(A;;FA;;;SY)(A;;FA;;;BA)(A;;FR;;;BU)',
      });
      expect(result.registration.xml).toContain('<BootTrigger>');
      expect(result.registration.xml).toContain('<EventTrigger>');
      expect(result.registration.xml).toContain('Microsoft-Windows-NetworkProfile/Operational');
      expect(result.registration.xml).toContain('EventID=10000');
      expect(result.registration.xml).not.toMatch(/<TimeTrigger|<CalendarTrigger|<Repetition/);
      expect(result.status.adapters[0].autoEnabled).toBe(true);
    });

    it('disables the verified task before stopping and deleting it', () => {
      const result = scenario('disable-auto', buildTaurusAutomaticCommand(id, false));
      expect(result.failure).toBeNull();
      expect(result.writes).toEqual(['enabled:False', 'stop-task', 'delete-task']);
      expect(result.status.adapters[0].autoEnabled).toBe(false);
    });

    it.each(['collision-description', 'collision-owner', 'collision-dacl', 'cannot-read-task'])(
      'does not touch an unrelated or unreadable task: %s',
      name => {
        for (const enabled of [true, false]) {
          const result = scenario(name, buildTaurusAutomaticCommand(id, enabled));
          expect(result.failure).toBeTruthy();
          expect(result.writes).toEqual([]);
          expect(result.status.adapters[0]).not.toHaveProperty('autoEnabled');
        }
      },
    );

    it('does not overwrite a task that appears after the initial lookup', () => {
      const result = scenario(
        'collision-during-registration',
        buildTaurusAutomaticCommand(id, true),
      );
      expect(result.failure).toContain('Task already exists');
      expect(result.registration.flags & 4).toBe(0);
      expect(result.writes).toEqual([]);
    });

    it('leaves a newly registered task disabled if its ACL does not match', () => {
      const result = scenario('unexpected-new-acl', buildTaurusAutomaticCommand(id, true));
      expect(result.failure).toContain('Could not verify the new task permissions');
      expect(result.writes).toEqual(['register-task']);
    });

    it('waits briefly for IPv4 and protects the adapter before DHCP adds a default', () => {
      const command = buildTaurusAutomaticCommand(id, true);
      const payload = command.match(/\$true '([A-Za-z0-9+/=]+)'/)?.[1];
      const automatic = Buffer.from(payload!, 'base64').toString('utf16le');
      expect(scenario('event-delayed', automatic)).toMatchObject({
        failure: null,
        sleeps: 2,
        writes: ['protect:47'],
      });
      expect(scenario('event-disconnected', automatic)).toMatchObject({
        failure: null,
        sleeps: 5,
        writes: [],
      });
    });
  },
);
