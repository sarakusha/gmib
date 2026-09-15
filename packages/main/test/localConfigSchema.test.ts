import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Store from 'electron-store';
import { afterEach, describe, expect, it } from 'vitest';

import type { LocalConfig } from '/@common/helpers';
import { localConfigSchema } from '../src/localConfigSchema';

const directories: string[] = [];

afterEach(() => {
  directories
    .splice(0)
    .forEach(directory => fs.rmSync(directory, { recursive: true, force: true }));
});

describe('local configuration schema', () => {
  it.each(['damaged', null, []])(
    'preserves adjacent settings when the signed document is %j',
    signedLicense => {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gmib-local-config-'));
      directories.push(cwd);
      fs.writeFileSync(
        path.join(cwd, 'gmib-local.json'),
        JSON.stringify({
          hosts: [{ address: '192.0.2.10', port: 9001 }],
          signedLicense,
        }),
      );

      const store = new Store<LocalConfig>({
        cwd,
        name: 'gmib-local',
        schema: localConfigSchema,
        clearInvalidConfig: true,
      });

      expect(store.get('hosts')).toEqual([{ address: '192.0.2.10', port: 9001 }]);
      expect(store.get('signedLicense')).toEqual(signedLicense);
    },
  );
});
