import { describe, expect, it } from 'vitest';

import { areSameRemoteHost } from '../src/remoteHost';

const remote = {
  name: 'gmib',
  version: '1.0.0',
  address: '192.168.0.10',
  port: 9001,
  platform: 'win32',
  arch: 'x64',
  osVersion: '10.0.26100',
};

describe('remote host comparison', () => {
  it('recognizes repeated service announcements', () => {
    expect(areSameRemoteHost(remote, { ...remote })).toBe(true);
  });

  it('keeps logging meaningful service changes', () => {
    expect(areSameRemoteHost(remote, { ...remote, address: '192.168.0.11' })).toBe(false);
    expect(areSameRemoteHost(remote, { ...remote, version: '1.1.0' })).toBe(false);
  });
});
