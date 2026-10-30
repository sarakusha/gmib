import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Plugins from './Plugins';

import type { PluginStatus } from '/@common/plugins';

const state = vi.hoisted(() => ({
  version: '5.7.1',
  remote: true,
  plugins: [] as PluginStatus[],
  list: vi.fn(),
  catalog: vi.fn(),
  setEnabled: vi.fn(),
  uninstall: vi.fn(),
  openControl: vi.fn(),
  enqueueSnackbar: vi.fn(),
}));
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
vi.mock('../store', () => ({ useSelector: () => state.version }));
vi.mock('../store/selectors', () => ({ selectSessionVersion: () => state.version }));
vi.mock('/@common/remote', () => ({
  host: '192.0.2.10',
  port: 9001,
  // Deliberately stale: compatibility must use the Redux session version.
  version: '5.0.0',
  get isRemoteSession() {
    return state.remote;
  },
}));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: state.enqueueSnackbar }) }));

const mount = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<Plugins />);
    await Promise.resolve();
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

const button = (container: HTMLElement, label: string) => {
  const found = [...container.querySelectorAll('button')].find(item => item.textContent === label);
  if (!found) throw Error(`Button not found: ${label}`);
  return found;
};

beforeEach(() => {
  vi.clearAllMocks();
  state.version = '5.7.1';
  state.remote = true;
  state.plugins = [
    {
      manifest: {
        id: 'test-plugin',
        name: 'Тест',
        version: '1.0.0',
        gmibApi: '^1.2.0',
        permissions: ['player.control'],
        localOnly: true,
        control: { path: 'control.html', title: 'Пульт' },
      },
      enabled: true,
      loaded: true,
      runningEnabled: true,
      restartRequired: false,
    },
  ];
  state.list.mockImplementation(() => Promise.resolve(state.plugins));
  state.catalog.mockResolvedValue([]);
  state.setEnabled.mockImplementation(() =>
    Promise.resolve({ ...state.plugins[0], enabled: false }),
  );
  state.uninstall.mockResolvedValue(false);
  state.openControl.mockResolvedValue(undefined);
  Object.defineProperty(window, 'plugins', {
    configurable: true,
    value: {
      list: state.list,
      catalog: state.catalog,
      setEnabled: state.setEnabled,
      uninstall: state.uninstall,
      openControl: state.openControl,
    },
  });
});

describe('remote plugins', () => {
  it('does not request plugins from an unsupported remote host', async () => {
    state.version = '5.7.0';
    const view = await mount();
    expect(view.container.textContent).toContain('обновите GMIB до 5.7.1');
    expect(state.list).not.toHaveBeenCalled();
    expect(state.catalog).not.toHaveBeenCalled();
    view.unmount();
  });

  it('uses the actual session version and labels the target host', async () => {
    const view = await mount();
    expect(state.list).toHaveBeenCalledOnce();
    expect(view.container.textContent).toContain('192.0.2.10:9002');
    expect(button(view.container, 'Пульт').disabled).toBe(true);
    expect(view.container.textContent).toContain('только на компьютере с этим плагином');
    expect(state.openControl).not.toHaveBeenCalled();
    view.unmount();
  });

  it('allows disabling and removing a remote local-only plugin', async () => {
    const view = await mount();
    const enabled = view.container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(enabled?.disabled).toBe(false);
    await act(async () => {
      enabled?.click();
      await Promise.resolve();
    });
    expect(state.setEnabled).toHaveBeenCalledWith('test-plugin', false);
    const remove = button(view.container, 'Удалить');
    expect(remove.disabled).toBe(false);
    await act(async () => {
      remove.click();
      await Promise.resolve();
    });
    expect(state.uninstall).toHaveBeenCalledWith('test-plugin');
    view.unmount();
  });

  it('keeps local-only controls available locally with an older session version', async () => {
    state.remote = false;
    state.version = '5.7.0';
    const view = await mount();
    expect(button(view.container, 'Пульт').disabled).toBe(false);
    await act(async () => {
      button(view.container, 'Пульт').click();
      await Promise.resolve();
    });
    expect(state.openControl).toHaveBeenCalledWith('test-plugin');
    view.unmount();
  });
});
