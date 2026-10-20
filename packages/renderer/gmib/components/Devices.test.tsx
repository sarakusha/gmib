import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Devices from './Devices';

const state = vi.hoisted(() => ({
  discover: vi.fn(),
  refetch: vi.fn(),
  reloadNibus: vi.fn(),
  enqueueSnackbar: vi.fn(),
}));

vi.mock('../api/novastar', () => ({
  useNovastars: () => ({ novastars: [], isUninitialized: false, refetch: state.refetch }),
  useDiscoverMutation: () => [state.discover],
}));
vi.mock('../api/screens', () => ({ useGetAddressesQuery: () => ({ data: [] }) }));
vi.mock('../store', () => ({
  useDispatch: () => vi.fn(),
  useSelector: (selector: () => unknown) => selector(),
}));
vi.mock('../store/selectors', () => ({
  filterDevicesByAddress: () => [],
  selectAllDevicesWithParent: () => [],
  selectCurrentDeviceId: () => undefined,
  selectCurrentTab: () => 'devices',
}));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: state.enqueueSnackbar }) }));
vi.mock('./AccordionList', () => ({
  default: ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
    <div>
      {title}
      {children}
    </div>
  ),
}));

describe('Devices refresh', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'nibus', {
      configurable: true,
      value: { reloadDevices: state.reloadNibus },
    });
    state.discover.mockReturnValue({ unwrap: () => Promise.resolve() });
    state.refetch.mockReturnValue({ unwrap: () => Promise.resolve() });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(<Devices />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const refresh = async (container: HTMLElement) => {
    await act(async () => {
      container
        .querySelector('[title="Повторить поиск"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
  };

  it('rereads the existing NovaStar list even without a discovery event', async () => {
    await refresh(container);
    expect(state.reloadNibus).toHaveBeenCalledOnce();
    expect(state.discover).toHaveBeenCalledOnce();
    expect(state.refetch).toHaveBeenCalledOnce();
    expect(state.enqueueSnackbar).not.toHaveBeenCalled();
  });

  it('still rereads the list when discovery fails and reports the failure', async () => {
    state.discover.mockReturnValue({ unwrap: () => Promise.reject(new Error('offline')) });
    await refresh(container);
    expect(state.refetch).toHaveBeenCalledOnce();
    expect(state.enqueueSnackbar).toHaveBeenCalledWith(
      'Не удалось повторить поиск NovaStar/Taurus',
      {
        variant: 'error',
      },
    );
  });

  it('ignores repeated clicks while discovery is in progress', async () => {
    let resolveDiscovery!: () => void;
    state.discover.mockReturnValue({
      unwrap: () =>
        new Promise<void>(resolve => {
          resolveDiscovery = resolve;
        }),
    });
    await refresh(container);
    await refresh(container);
    expect(state.discover).toHaveBeenCalledOnce();
    expect(state.refetch).not.toHaveBeenCalled();
    await act(async () => {
      resolveDiscovery();
      await Promise.resolve();
    });
    expect(state.refetch).toHaveBeenCalledOnce();
  });
});
