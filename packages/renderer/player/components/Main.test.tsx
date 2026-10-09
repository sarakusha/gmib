import { createTheme, ThemeProvider } from '@mui/material/styles';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Main from './Main';

const state = vi.hoisted(() => ({
  version: '5.6.2',
  remote: true,
  statistics: vi.fn<() => React.ReactNode>(() => 'Statistics content'),
  dispatch: vi.fn(),
  tab: 'statistics',
  mounts: vi.fn(),
  unmounts: vi.fn(),
}));
vi.mock('/@common/remote', () => ({
  get version() {
    return state.version;
  },
  get isRemoteSession() {
    return state.remote;
  },
}));
vi.mock('../store', () => ({
  useDispatch: () => state.dispatch,
  useSelector: () => state.tab,
}));
vi.mock('../store/selectors', () => ({ selectCurrentTab: vi.fn() }));
vi.mock('./MediaTab', () => ({ default: () => null }));
vi.mock('./PlaylistsTab', () => ({ default: () => null }));
vi.mock('./SchedulerTab', () => ({ default: () => null }));
vi.mock('./SettingsTab', () => ({ default: () => null }));
vi.mock('./StatisticsTab', () => ({ default: state.statistics }));

describe('playback statistics remote version support', () => {
  beforeEach(() => {
    state.statistics.mockClear();
    state.statistics.mockImplementation(() => 'Statistics content');
    state.remote = true;
    state.tab = 'statistics';
    state.mounts.mockClear();
    state.unmounts.mockClear();
  });

  it.each([
    ['5.6.2', false],
    ['5.6.3', true],
    ['5.7.0', true],
  ])('gates the tab and its API-owning component for remote %s', (version, supported) => {
    state.version = version;
    const html = renderToStaticMarkup(
      <ThemeProvider theme={createTheme()}>
        <Main />
      </ThemeProvider>,
    );
    expect(html.includes('Статистика')).toBe(supported);
    expect(state.statistics).toHaveBeenCalledTimes(supported ? 1 : 0);
  });

  it('keeps statistics available for a local development build', () => {
    state.version = '5.6.2';
    state.remote = false;
    expect(
      renderToStaticMarkup(
        <ThemeProvider theme={createTheme()}>
          <Main />
        </ThemeProvider>,
      ),
    ).toContain('Статистика');
    expect(state.statistics).toHaveBeenCalledOnce();
  });

  it('keeps the statistics component and its local selection across tab switches', () => {
    state.version = '5.6.3';
    state.tab = 'player';
    state.statistics.mockImplementation(() => {
      const [period, setPeriod] = React.useState('7 дней');
      React.useEffect(() => {
        state.mounts();
        return () => {
          state.unmounts();
        };
      }, []);
      return <button onClick={() => setPeriod('Период')}>{period}</button>;
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const render = () =>
      root.render(
        <ThemeProvider theme={createTheme()}>
          <Main />
        </ThemeProvider>,
      );

    act(render);
    expect(state.mounts).not.toHaveBeenCalled();
    state.tab = 'statistics';
    act(render);
    expect(state.mounts).toHaveBeenCalledOnce();
    const period = container.querySelector<HTMLButtonElement>('[role="tabpanel"] button');
    expect(period?.textContent).toBe('7 дней');
    act(() => period?.click());
    state.tab = 'player';
    act(render);
    expect(period?.isConnected).toBe(true);
    expect(state.unmounts).not.toHaveBeenCalled();
    state.tab = 'statistics';
    act(render);
    expect(period?.textContent).toBe('Период');
    expect(state.mounts).toHaveBeenCalledOnce();

    act(() => root.unmount());
    container.remove();
  });
});
