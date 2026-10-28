import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  type IconButtonProps,
  Tooltip,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React from 'react';

import { supportsFeature } from '/@common/capabilities';
import {
  MAX_PLAYER_CONFIGURATION_BYTES,
  parsePlayerConfiguration,
} from '/@common/playerConfiguration';
import { isRemoteSession, version } from '/@common/remote';

import {
  useExportConfigurationMutation,
  useImportConfigurationMutation,
} from '../api/configuration';

type Configuration = ReturnType<typeof parsePlayerConfiguration>;

export const configurationError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    if (
      ('status' in error && error.status === 404) ||
      ('originalStatus' in error && error.originalStatus === 404)
    )
      return 'Удалённое устройство не поддерживает перенос конфигураций. Обновите GMIB до 5.6.10 или новее.';
    if ('data' in error && error.data && typeof error.data === 'object' && 'message' in error.data)
      return String(error.data.message);
    if ('error' in error) return String(error.error);
  }
  return 'Не удалось выполнить операцию. Проверьте подключение к устройству.';
};

const ConfigurationButtons: React.FC<{ size?: IconButtonProps['size'] }> = ({ size }) => {
  const input = React.useRef<HTMLInputElement>(null);
  const locked = React.useRef(false);
  const [busy, setBusy] = React.useState(false);
  const [pending, setPending] = React.useState<Configuration>();
  const [exportConfiguration] = useExportConfigurationMutation();
  const [importConfiguration] = useImportConfigurationMutation();
  const { enqueueSnackbar } = useSnackbar();
  const available = supportsFeature('playerConfiguration', version, isRemoteSession);
  const run = async (action: () => Promise<void>) => {
    if (!available || locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      enqueueSnackbar(configurationError(error), { variant: 'error' });
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const download = () =>
    run(async () => {
      const data = await exportConfiguration().unwrap();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      if (blob.size > MAX_PLAYER_CONFIGURATION_BYTES)
        throw new Error('Конфигурация превышает допустимый размер 5 МиБ.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gmib-players-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      data.warnings?.forEach(message => enqueueSnackbar(message, { variant: 'warning' }));
    });
  const readFile: React.ChangeEventHandler<HTMLInputElement> = event => {
    const target = event.target;
    const file = target.files?.[0];
    target.value = '';
    if (!file) return;
    void run(async () => {
      if (file.size > MAX_PLAYER_CONFIGURATION_BYTES)
        throw new Error('Размер файла не должен превышать 5 МиБ.');
      let value: unknown;
      try {
        value = JSON.parse(await file.text());
      } catch {
        throw new Error('Не удалось прочитать JSON. Выберите файл конфигурации плееров GMIB.');
      }
      setPending(parsePlayerConfiguration(value));
    });
  };
  const apply = () =>
    run(async () => {
      if (!pending) return;
      // Close before sending: after a network error, inspect the refreshed list before retrying.
      const configuration = pending;
      setPending(undefined);
      try {
        const result = await importConfiguration(configuration).unwrap();
        enqueueSnackbar(
          `Добавлено плееров: ${result.playerIds.length}, областей вывода: ${result.mappingCount}.`,
          { variant: 'success' },
        );
      } catch (error) {
        throw new Error(
          `${configurationError(error)} Перед повторным импортом проверьте список плееров: при потере ответа изменения могли сохраниться.`,
        );
      }
    });
  if (!available) return null;
  return (
    <>
      <Tooltip title="Выгрузить конфигурации всех плееров">
        <span style={{ display: 'inline-flex' }}>
          <IconButton
            color="inherit"
            size={size}
            aria-label="Выгрузить конфигурации всех плееров"
            disabled={busy || !!pending}
            onClick={() => {
              void download();
            }}
          >
            <FileDownloadIcon fontSize="inherit" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Загрузить конфигурации плееров">
        <span style={{ display: 'inline-flex' }}>
          <IconButton
            color="inherit"
            size={size}
            aria-label="Загрузить конфигурации плееров"
            disabled={busy || !!pending}
            onClick={() => input.current?.click()}
          >
            <FileUploadIcon fontSize="inherit" />
          </IconButton>
        </span>
      </Tooltip>
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={readFile} />
      <Dialog
        open={!!pending}
        onClose={() => {
          if (!busy) setPending(undefined);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Загрузить конфигурации плееров</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Будут добавлены новые плееры: {pending?.players.length ?? 0}; области вывода:{' '}
            {pending?.players.reduce((sum, player) => sum + player.mappings.length, 0) ?? 0}.
            Существующие плееры сохранятся. Совпадающие имена получат числовой суффикс.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2 }}>
            Переносятся настройки, геометрия и шейдеры областей вывода. Видео, плейлисты и
            расписания в файл не входят.
          </DialogContentText>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Области вывода будут привязаны к основному и второстепенному дисплеям этого устройства.
            Привязки к остальным или отсутствующим дисплеям нужно настроить вручную после импорта.
            Проверьте размеры и положение областей вывода.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setPending(undefined)}>
            Отмена
          </Button>
          <Button
            disabled={busy || !pending?.players.length}
            onClick={() => {
              void apply();
            }}
          >
            Добавить плееры
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ConfigurationButtons;
