import { createTheme, ThemeProvider } from '@mui/material/styles';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ConfigurationButtons, { configurationError } from './ConfigurationButtons';

const state = vi.hoisted(() => ({
  version: String('5.6.9'),
  remote: true,
  exportRequest: vi.fn(),
  importRequest: vi.fn(),
  enqueueSnackbar: vi.fn(),
}));
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
vi.mock('/@common/remote', () => ({
  get version() {
    return state.version;
  },
  get isRemoteSession() {
    return state.remote;
  },
}));
vi.mock('../api/configuration', () => ({
  useExportConfigurationMutation: () => [state.exportRequest],
  useImportConfigurationMutation: () => [state.importRequest],
}));
vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: state.enqueueSnackbar }) }));
const render = () =>
  renderToStaticMarkup(
    <ThemeProvider theme={createTheme()}>
      <ConfigurationButtons />
    </ThemeProvider>,
  );

beforeEach(() => {
  state.version = '5.6.9';
  state.remote = true;
  state.exportRequest.mockReset();
  state.importRequest.mockReset();
  state.enqueueSnackbar.mockReset();
});

const configuration = JSON.stringify({
  format: 'gmib-player-configuration',
  version: 1,
  players: [{ settings: { name: 'Test player' }, mappings: [] }],
});

const mount = () => {
  state.remote = false;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() =>
    root.render(
      <ThemeProvider theme={createTheme()}>
        <ConfigurationButtons />
      </ThemeProvider>,
    ),
  );
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

const selectFile = async (container: HTMLElement, file: File) => {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error('File input was not rendered');
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
  });
};

const jsonFile = (contents: string): File =>
  ({
    name: 'players.json',
    size: new TextEncoder().encode(contents).length,
    text: () => Promise.resolve(contents),
  }) as File;

describe('configuration toolbar', () => {
  it.each([
    ['5.6.9', false],
    ['5.6.10', true],
    ['5.7.0', true],
    [undefined, true],
  ] as const)('gates controls for remote %s', (version, available) => {
    state.version = version ?? '';
    expect(render().includes('Выгрузить конфигурации всех плееров')).toBe(available);
    expect(state.exportRequest).not.toHaveBeenCalled();
    expect(state.importRequest).not.toHaveBeenCalled();
  });
  it('keeps local controls available', () => {
    state.remote = false;
    expect(render()).toContain('Загрузить конфигурации плееров');
  });
  it('explains missing remote endpoints', () => {
    expect(configurationError({ status: 404 })).toContain('5.6.10');
    expect(configurationError({ status: 'PARSING_ERROR', originalStatus: 404 })).toContain(
      '5.6.10',
    );
  });

  it('previews a selected file and posts only after Add is pressed', async () => {
    state.importRequest.mockReturnValue({
      unwrap: () => Promise.resolve({ playerIds: [42], mappingCount: 0 }),
    });
    const mounted = mount();
    try {
      await selectFile(mounted.container, jsonFile(configuration));
      expect(document.body.textContent).toContain('Будут добавлены новые плееры: 1');
      expect(state.importRequest).not.toHaveBeenCalled();

      const add = Array.from(document.body.querySelectorAll('button')).find(button =>
        button.textContent?.includes('Добавить плееры'),
      );
      expect(add).toBeTruthy();
      await act(async () => {
        add?.click();
        await Promise.resolve();
      });
      expect(state.importRequest).toHaveBeenCalledTimes(1);
      expect(state.importRequest).toHaveBeenCalledWith({
        format: 'gmib-player-configuration',
        version: 1,
        players: [{ settings: { name: 'Test player' }, mappings: [] }],
      });
      expect(state.enqueueSnackbar).toHaveBeenCalledWith(
        'Добавлено плееров: 1, областей вывода: 0.',
        { variant: 'success' },
      );
    } finally {
      mounted.unmount();
    }
  });

  it('does not post when the preview is canceled', async () => {
    const mounted = mount();
    try {
      await selectFile(mounted.container, jsonFile(configuration));
      const cancel = Array.from(document.body.querySelectorAll('button')).find(button =>
        button.textContent?.includes('Отмена'),
      );
      expect(cancel).toBeTruthy();
      act(() => cancel?.click());
      expect(state.importRequest).not.toHaveBeenCalled();
    } finally {
      mounted.unmount();
    }
  });

  it.each([
    ['malformed JSON', jsonFile('{not json'), /Не удалось прочитать JSON/],
    [
      'oversized file',
      { name: 'large.json', size: 5 * 1024 * 1024 + 1, text: vi.fn() } as unknown as File,
      /Размер файла не должен превышать 5 МиБ/,
    ],
  ])('rejects %s without posting', async (_label, file, message) => {
    const mounted = mount();
    try {
      await selectFile(mounted.container, file);
      expect(state.importRequest).not.toHaveBeenCalled();
      expect(state.enqueueSnackbar).toHaveBeenCalledWith(expect.stringMatching(message), {
        variant: 'error',
      });
    } finally {
      mounted.unmount();
    }
  });
});
