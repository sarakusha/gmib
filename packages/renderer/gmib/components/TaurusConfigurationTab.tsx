import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import RestoreIcon from '@mui/icons-material/Restore';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';

import {
  useApplyTaurusScreenConfigurationMutation,
  useGetTaurusScreenConfigurationQuery,
  useInspectTaurusScreenConfigurationMutation,
  useRestoreTaurusScreenConfigurationMutation,
} from '../api/novastar';

import type { Novastar } from '/@common/novastar';
import type { TaurusScreenConfiguration } from '/@common/taurusConfiguration';

import FilenameEllipsis from './FilenameEllipsis';
import TaurusNcpConfiguration from './TaurusNcpConfiguration';

const errorMessage = (error: unknown): string | undefined => {
  if (!error) return undefined;
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const { data } = error as { data?: unknown };
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object' && 'error' in data) return String(data.error);
  }
  return error instanceof Error ? error.message : 'Неизвестная ошибка';
};

const totalSize = (configuration?: TaurusScreenConfiguration): string => {
  if (!configuration?.screens.length) return '—';
  const width = Math.max(
    ...configuration.screens.map(screen => screen.offset.x + screen.size.width),
  );
  const height = Math.max(
    ...configuration.screens.map(screen => screen.offset.y + screen.size.height),
  );
  return `${width}×${height}`;
};

const cardCount = (configuration?: TaurusScreenConfiguration): number =>
  configuration?.screens.reduce((count, screen) => count + screen.receivingCards.length, 0) ?? 0;

const usedPorts = (screen: TaurusScreenConfiguration['screens'][number]): string =>
  [...new Set(screen.receivingCards.map(card => card.port))]
    .sort((left, right) => left - right)
    .map(port => port + 1)
    .join(', ');

const TopologyTable: React.FC<{ configuration: TaurusScreenConfiguration }> = ({
  configuration,
}) => (
  <Table size="small">
    <TableHead>
      <TableRow>
        <TableCell>Экран</TableCell>
        <TableCell>Холст</TableCell>
        <TableCell>Смещение</TableCell>
        <TableCell>Порты</TableCell>
        <TableCell>Карты</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {configuration.screens.map(screen => (
        <TableRow key={screen.id}>
          <TableCell>{screen.id + 1}</TableCell>
          <TableCell>
            {screen.size.width}×{screen.size.height}
          </TableCell>
          <TableCell>
            {screen.offset.x}, {screen.offset.y}
          </TableCell>
          <TableCell>{usedPorts(screen)}</TableCell>
          <TableCell>{screen.receivingCards.length}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

const TaurusConfigurationTab: React.FC<{
  device: Novastar | undefined;
  selected?: boolean;
}> = ({ device, selected = false }) => {
  const path = device?.path ?? '';
  const authenticated = Boolean(device?.taurus?.authenticated);
  const passwordRequired = Boolean(device?.taurus?.passwordRequired);
  const { enqueueSnackbar } = useSnackbar();
  const [filename, setFilename] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const {
    data: state,
    error: stateError,
    isFetching,
  } = useGetTaurusScreenConfigurationQuery(path, {
    skip: !selected || !path || !authenticated,
  });
  const [inspect, inspectionState] = useInspectTaurusScreenConfigurationMutation();
  const [apply, applyState] = useApplyTaurusScreenConfigurationMutation();
  const [restore, restoreState] = useRestoreTaurusScreenConfigurationMutation();
  const inspection = inspectionState.data;
  const resetInspection = inspectionState.reset;
  const previousPath = useRef<string | undefined>(undefined);
  const busy =
    !authenticated ||
    isFetching ||
    inspectionState.isLoading ||
    applyState.isLoading ||
    restoreState.isLoading;

  useEffect(() => {
    if (previousPath.current === path) return;
    previousPath.current = path;
    setFilename('');
    setConfirmed(false);
    resetInspection();
  }, [path, resetInspection]);

  const selectFile = useCallback(() => {
    const [selectedFile] =
      window.dialogs.showOpenDialogSync({
        title: 'Выбор конфигурации экрана NovaLCT',
        filters: [{ name: 'NovaLCT screen configuration', extensions: ['scr'] }],
        properties: ['openFile'],
      }) ?? [];
    if (!selectedFile || !path) return;
    setFilename(selectedFile);
    setConfirmed(false);
    void inspect({ path, filename: selectedFile })
      .unwrap()
      .catch(() => undefined);
  }, [inspect, path]);

  const applyConfiguration = useCallback(() => {
    if (!path || !filename || !inspection) return;
    if (!window.confirm(`Заменить топологию Taurus на ${totalSize(inspection.target)}?`)) return;
    void apply({ path, filename })
      .unwrap()
      .then(() => {
        enqueueSnackbar('Конфигурация экрана Taurus записана и проверена', {
          variant: 'success',
        });
        resetInspection();
        setConfirmed(false);
      })
      .catch(() => undefined);
  }, [apply, enqueueSnackbar, filename, inspection, path, resetInspection]);

  const restoreConfiguration = useCallback(() => {
    if (!path || !window.confirm('Восстановить топологию, сохранённую перед последней записью?')) {
      return;
    }
    void restore(path)
      .unwrap()
      .then(() =>
        enqueueSnackbar('Предыдущая топология Taurus восстановлена', { variant: 'success' }),
      )
      .catch(() => undefined);
  }, [enqueueSnackbar, path, restore]);

  if (!selected) return null;
  if (!authenticated && passwordRequired) {
    return <Alert severity="info">Сначала войдите в Taurus на вкладке «Свойства».</Alert>;
  }

  const operationError =
    errorMessage(stateError) ??
    errorMessage(inspectionState.error) ??
    errorMessage(applyState.error) ??
    errorMessage(restoreState.error);
  const warningsConfirmed = !inspection?.warnings.length || confirmed;

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        {!authenticated && <Alert severity="info">Переподключение к Taurus…</Alert>}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilenameEllipsis
            filename={filename}
            placeholder="Выберите файл топологии (*.scr)"
            sx={{ flexGrow: 1 }}
          />
          <IconButton aria-label="Выбрать SCR" onClick={selectFile} disabled={busy}>
            <FolderOpenIcon />
          </IconButton>
        </Box>

        {operationError && <Alert severity="error">{operationError}</Alert>}
        {busy && <CircularProgress size={28} />}

        {state?.current && (
          <Box>
            <Typography variant="subtitle1">
              Текущая топология: {totalSize(state.current)}, карт: {cardCount(state.current)}
            </Typography>
            <TopologyTable configuration={state.current} />
          </Box>
        )}

        {inspection && (
          <Box>
            <Typography variant="subtitle1">
              SCR версии {inspection.scrVersion}: {totalSize(inspection.target)}, карт:{' '}
              {cardCount(inspection.target)}
            </Typography>
            <TopologyTable configuration={inspection.target} />
          </Box>
        )}

        {inspection?.warnings.map(warning => (
          <Alert severity="warning" key={warning}>
            {warning}
          </Alert>
        ))}

        {Boolean(inspection?.warnings.length) && (
          <FormControlLabel
            control={
              <Checkbox
                checked={confirmed}
                onChange={event => setConfirmed(event.target.checked)}
              />
            }
            label="Я проверил размеры, количество карт и порядок подключения"
          />
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button
            startIcon={<RestoreIcon />}
            disabled={busy || !state?.backupAvailable}
            onClick={restoreConfiguration}
          >
            Восстановить
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveAltIcon />}
            disabled={busy || !inspection || !warningsConfirmed || device?.isBusy}
            onClick={applyConfiguration}
          >
            Применить SCR
          </Button>
        </Box>

        <Divider />
        <TaurusNcpConfiguration path={path} disabled={!authenticated} />
      </Stack>
    </Paper>
  );
};

export default memo(TaurusConfigurationTab);
