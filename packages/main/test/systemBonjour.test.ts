import { describe, expect, it } from 'vitest';

import {
  isBonjourServiceRunning,
  parseBrowseLine,
  parseDnsSdTxt,
  parseResolveLine,
} from '../src/systemBonjour';

describe('system Bonjour output parsing', () => {
  it('requires the Bonjour service to be running', () => {
    expect(isBonjourServiceRunning('STATE              : 4  RUNNING')).toBe(true);
    expect(isBonjourServiceRunning('STATE              : 1  STOPPED')).toBe(false);
    expect(isBonjourServiceRunning('The specified service does not exist')).toBe(false);
  });

  it('parses browse additions and removals', () => {
    expect(
      parseBrowseLine(
        '18:09:17.548  Add     2  9 local. _nibus._tcp. gmib-device1234',
        '_nibus._tcp',
      ),
    ).toEqual({ event: 'up', name: 'gmib-device1234', domain: 'local.' });
    expect(
      parseBrowseLine(
        '18:09:18.548  Rmv     0  9 local. _nibus._tcp. gmib-device1234',
        '_nibus._tcp',
      ),
    ).toEqual({ event: 'down', name: 'gmib-device1234', domain: 'local.' });
  });

  it('parses resolved host, port and escaped TXT values', () => {
    expect(
      parseResolveLine(
        '18:09:17.548 gmib-device1234._nibus._tcp.local. can be reached at rmb1.local.:9001 (interface 9)',
      ),
    ).toEqual({ host: 'rmb1.local.', port: 9001 });
    expect(parseDnsSdTxt('version=5.3.5 original=rmb1 osVersion=Windows\\ 10\\ Pro')).toEqual({
      version: '5.3.5',
      original: 'rmb1',
      osversion: 'Windows 10 Pro',
    });
  });
});
