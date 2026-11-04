import type { App } from 'electron';
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { installGmibProtocol, parseGmibLink, createGmibLinkOpener } from '../src/gmibProtocol';

const setup = (argv: string[] = [], kiosk = false, isPackaged = true) => {
  const application = Object.assign(new EventEmitter(), {
    isPackaged,
    setAsDefaultProtocolClient: vi.fn(() => true),
  });
  const open = vi.fn();
  const activate = vi.fn();
  const onError = vi.fn();
  const protocol = installGmibProtocol(application as unknown as App, {
    argv,
    kiosk,
    open,
    activate,
    onError,
  });
  return { application, protocol, open, activate, onError };
};

describe('GMIB links', () => {
  it.each([
    ['gmib://192.168.1.10', '192.168.1.10', 9001],
    ['gmib://Host.Example:1234/', 'host.example', 1234],
    ['GMIB://host:65534', 'host', 65534],
  ])('parses %s', (link, host, port) => {
    expect(parseGmibLink(link as string)).toEqual({ host, port });
  });
  it.each([
    'http://example.com',
    'gmib://',
    'gmib://user@host',
    'gmib://user:pass@host',
    'gmib://host/path',
    'gmib://host?command=quit',
    'gmib://host#fragment',
    'gmib://host:0',
    'gmib://host:65535',
    'gmib://host:99999',
    'gmib://999.1.1.1',
    'gmib://127.1',
    'gmib://host\\evil',
    'gmib://host\n',
    'gmib://%61.com',
    'gmib://-host',
    'gmib://host..com',
    'gmib://[::1]',
    'gmib://host:abc',
  ])('rejects %s', link => {
    expect(parseGmibLink(link)).toBeUndefined();
  });
  it('queues cold launch, mac open-url and second-instance until bootstrap completes', () => {
    const { application, protocol, open } = setup(['app', 'gmib://192.168.1.10']);
    const event = { preventDefault: vi.fn() };
    application.emit('open-url', event, 'gmib://host:1234');
    application.emit('second-instance', {}, ['app', 'gmib://other']);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    protocol.ready();
    expect(open.mock.calls).toEqual([
      [{ host: '192.168.1.10', port: 9001 }],
      [{ host: 'host', port: 1234 }],
      [{ host: 'other', port: 9001 }],
    ]);
    protocol.ready();
    expect(open).toHaveBeenCalledTimes(3);
  });
  it('deduplicates pending links and opens later links immediately', () => {
    const { application, protocol, open } = setup(['gmib://host', 'gmib://host:9001']);
    protocol.ready();
    expect(open).toHaveBeenCalledOnce();
    application.emit('second-instance', {}, ['gmib://host:1234']);
    expect(open).toHaveBeenLastCalledWith({ host: 'host', port: 1234 });
  });
  it('defers ordinary second-instance activation until bootstrap', () => {
    const { application, protocol, activate } = setup();
    application.emit('second-instance', {}, ['app']);
    expect(activate).not.toHaveBeenCalled();
    protocol.ready();
    expect(activate).toHaveBeenCalledOnce();
    application.emit('second-instance', {}, ['app']);
    expect(activate).toHaveBeenCalledTimes(2);
  });
  it('ignores links in kiosk mode and does not register a handler', () => {
    const { application, protocol, open } = setup(['gmib://host'], true);
    application.emit('open-url', { preventDefault: vi.fn() }, 'gmib://other');
    protocol.ready();
    application.emit('second-instance', {}, ['gmib://third']);
    expect(open).not.toHaveBeenCalled();
    expect(application.setAsDefaultProtocolClient).not.toHaveBeenCalled();
  });
  it('registers packaged app but does not hijack handler during development', () => {
    expect(setup().application.setAsDefaultProtocolClient).toHaveBeenCalledWith('gmib');
    expect(setup([], false, false).application.setAsDefaultProtocolClient).not.toHaveBeenCalled();
  });
  it('rejects malformed links without exposing their contents or interrupting subsequent requests', () => {
    const { application, protocol, open, onError } = setup(['gmib://user:secret@host']);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls.flat().join()).not.toContain('secret');
    protocol.ready();
    open.mockImplementationOnce(() => {
      throw new Error('failure');
    });
    application.emit('open-url', { preventDefault: vi.fn() }, 'gmib://host');
    application.emit('open-url', { preventDefault: vi.fn() }, 'gmib://other');
    expect(open).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(2);
  });
});

describe('opening link connections', () => {
  const setupWindow = () => {
    const window = {
      show: vi.fn(),
      focus: vi.fn(),
      isDestroyed: vi.fn(() => false),
      once: vi.fn(),
    };
    const options = {
      localPort: 9001,
      activateLocal: vi.fn(),
      find: vi.fn(() => undefined as typeof window | undefined),
      create: vi.fn(() => window),
    };
    return { window, options };
  };
  it('activates local only for the configured NiBUS port', () => {
    const { options } = setupWindow();
    const open = createGmibLinkOpener(options);
    open({ host: 'localhost', port: 9001 });
    expect(options.activateLocal).toHaveBeenCalledOnce();
    expect(options.create).not.toHaveBeenCalled();
    open({ host: 'localhost', port: 1234 });
    expect(options.create).toHaveBeenCalledWith({ host: '127.0.0.1', port: 1234 });
  });
  it('reuses an existing live window and creates a replacement for a destroyed one', () => {
    const { window, options } = setupWindow();
    options.find.mockReturnValue(window);
    createGmibLinkOpener(options)({ host: 'host', port: 1234 });
    expect(options.find).toHaveBeenCalledWith({ host: 'host', port: 1234 });
    expect(options.create).not.toHaveBeenCalled();
    expect(window.show).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledOnce();
    window.isDestroyed.mockReturnValue(true);
    createGmibLinkOpener(options)({ host: 'host', port: 1234 });
    expect(options.create).toHaveBeenCalledWith({ host: 'host', port: 1234 });
  });
});

it('reserves a connecting window synchronously and releases it after closing', () => {
  const window = Object.assign(new EventEmitter(), {
    show: vi.fn(),
    focus: vi.fn(),
    isDestroyed: vi.fn(() => false),
  });
  const options = {
    localPort: 9001,
    activateLocal: vi.fn(),
    find: vi.fn(() => undefined),
    create: vi.fn(() => window),
  };
  const open = createGmibLinkOpener(options);
  open({ host: 'localhost', port: 1234 });
  open({ host: '127.0.0.1', port: 1234 });
  expect(options.create).toHaveBeenCalledOnce();
  expect(window.show).toHaveBeenCalledTimes(2);
  window.emit('closed');
  open({ host: 'localhost', port: 1234 });
  expect(options.create).toHaveBeenCalledTimes(2);
});
