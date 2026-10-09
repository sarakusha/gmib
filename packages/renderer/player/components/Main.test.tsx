import { createTheme, ThemeProvider } from '@mui/material/styles';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Main from './Main';

const state = vi.hoisted(() => ({
  version: '5.6.2',
  remote: true,
  statistics: vi.fn(() => 'Statistics content'),
  dispatch: vi.fn(),
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
  useSelector: () => 'statistics',
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
    state.remote = true;
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
});
