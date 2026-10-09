import { createTheme, ThemeProvider } from '@mui/material/styles';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OutputVisibilityButton from './OutputVisibilityButton';

const state = vi.hoisted(() => ({
  version: '5.4.0',
  remote: true,
  setOutputVisibility: vi.fn(),
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
vi.mock('../api/player', () => ({
  useSetPlayerOutputVisibilityMutation: () => [state.setOutputVisibility, { isLoading: false }],
}));
vi.mock('../store', () => ({
  useDispatch: () => state.dispatch,
  useSelector: () => false,
}));

const renderButton = () =>
  renderToStaticMarkup(
    <ThemeProvider theme={createTheme()}>
      <OutputVisibilityButton />
    </ThemeProvider>,
  );

describe('remote player output visibility version support', () => {
  beforeEach(() => {
    state.version = '5.4.0';
    state.remote = true;
    state.setOutputVisibility.mockClear();
  });

  it.each([
    ['5.4.0', false],
    ['5.4.1', true],
    ['5.5.0', true],
  ])('gates the output visibility action for remote %s', (version, supported) => {
    state.version = version;
    const html = renderButton();
    expect(html.includes('Скрыть окно вывода')).toBe(supported);
  });

  it('keeps the action available in a local session', () => {
    state.remote = false;
    expect(renderButton()).toContain('Скрыть окно вывода');
  });
});
