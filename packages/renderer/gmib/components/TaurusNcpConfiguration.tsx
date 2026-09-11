import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import MemoryIcon from '@mui/icons-material/Memory';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  useApplyTaurusFirmwareMutation,
  useApplyTaurusNcpConfigurationMutation,
  useInspectTaurusNcpConfigurationMutation,
} from '../api/novastar';

import FilenameEllipsis from './FilenameEllipsis';

import type { TaurusFirmwareProgress } from '/@common/taurusConfiguration';

const errorMessage = (error: unknown): string | undefined => {
  if (!error) return undefined;
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const { data } = error as { data?: unknown };
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object' && 'error' in data) return String(data.error);
  }
  return error instanceof Error ? error.message : 'Неизвестная ошибка';
};

const targetKey = (port: number, receivingCard: number): string => `${port}:${receivingCard}`;

const TaurusNcpConfiguration: React.FC<{
  path: string;
  disabled?: boolean;
  firmwareProgress?: TaurusFirmwareProgress;
}> = ({ path, disabled = false, firmwareProgress }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [filename, setFilename] = useState('');
  const [cabinetIndex, setCabinetIndex] = useState(0);
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [firmwareConfirmed, setFirmwareConfirmed] = useState(false);
  const [inspect, inspectionState] = useInspectTaurusNcpConfigurationMutation();
  const [apply, applyState] = useApplyTaurusNcpConfigurationMutation();
  const [applyFirmware, firmwareState] = useApplyTaurusFirmwareMutation();
  const inspection = inspectionState.data;
  const resetInspection = inspectionState.reset;
  const previousPath = useRef<string | undefined>(undefined);
  const busy =
    disabled || inspectionState.isLoading || applyState.isLoading || firmwareState.isLoading;
  const cabinet = inspection?.cabinets[cabinetIndex];
  const operationError =
    errorMessage(inspectionState.error) ??
    errorMessage(applyState.error) ??
    errorMessage(firmwareState.error);

  useEffect(() => {
    if (previousPath.current === path) return;
    previousPath.current = path;
    setFilename('');
    setCabinetIndex(0);
    setSelectedTargets(new Set());
    setConfirmed(false);
    setFirmwareConfirmed(false);
    resetInspection();
  }, [path, resetInspection]);

  const selected = useMemo(
    () =>
      inspection?.targets.filter(target =>
        selectedTargets.has(targetKey(target.port, target.receivingCard)),
      ) ?? [],
    [inspection, selectedTargets],
  );

  const selectFile = useCallback(() => {
    const [selectedFile] =
      window.dialogs.showOpenDialogSync({
        title: 'Выбор конфигурации кабинета NovaLCT',
        filters: [{ name: 'NovaLCT cabinet package', extensions: ['ncp'] }],
        properties: ['openFile'],
      }) ?? [];
    if (!selectedFile) return;
    setFilename(selectedFile);
    setCabinetIndex(0);
    setConfirmed(false);
    setFirmwareConfirmed(false);
    void inspect({ path, filename: selectedFile })
      .unwrap()
      .then(() => setSelectedTargets(new Set()))
      .catch(() => setSelectedTargets(new Set()));
  }, [inspect, path]);

  const applyConfiguration = useCallback(() => {
    if (!inspection || !filename || !cabinet || !selected.length || !confirmed) return;
    if (
      !window.confirm(
        `Применить «${cabinet.name}» к выбранным принимающим картам (${selected.length})?`,
      )
    ) {
      return;
    }
    void apply({
      path,
      filename,
      cabinetIndex,
      targets: selected.map(target => ({
        port: target.port,
        receivingCard: target.receivingCard,
      })),
    })
      .unwrap()
      .then(result => {
        enqueueSnackbar(
          `Конфигурация кабинета применена: ${result.completed}/${result.total || selected.length}`,
          { variant: 'success' },
        );
        setConfirmed(false);
      })
      .catch(() => undefined);
  }, [
    apply,
    cabinet,
    cabinetIndex,
    confirmed,
    enqueueSnackbar,
    filename,
    inspection,
    path,
    selected,
  ]);

  const firmware = cabinet?.firmware;
  const availableTargets = useMemo(
    () =>
      inspection?.targets.filter(
        target => target.version?.modelId !== undefined && !target.version.error,
      ) ?? [],
    [inspection],
  );
  const incompatibleFirmwareTargets = useMemo(
    () =>
      firmware
        ? selected.filter(
            target =>
              target.version?.modelId === undefined ||
              target.version.error !== undefined ||
              target.version.modelId !== firmware.modelId,
          )
        : [],
    [firmware, selected],
  );

  const applyFirmwareUpdate = useCallback(() => {
    if (
      !inspection ||
      !filename ||
      !firmware ||
      !selected.length ||
      incompatibleFirmwareTargets.length ||
      !firmwareConfirmed
    ) {
      return;
    }
    const targets = selected
      .map(
        target =>
          `порт ${target.port + 1}, карта ${target.receivingCard + 1} (${target.x}, ${target.y})`,
      )
      .join('\n');
    if (
      !window.confirm(
        `Прошить ${firmware.filename}\n` +
          `Модель: ${firmware.model ?? 'не указана'}, ID ${firmware.modelId}\n` +
          `Выбранные карты:\n${targets}\n\nНе отключайте питание до завершения операции.`,
      )
    ) {
      return;
    }
    void applyFirmware({
      path,
      filename,
      cabinetIndex,
      targets: selected.map(target => ({
        port: target.port,
        receivingCard: target.receivingCard,
      })),
    })
      .unwrap()
      .then(result => {
        enqueueSnackbar(`Firmware принимающих карт обновлён: ${result.completed}/${result.total}`, {
          variant: 'success',
        });
        setFirmwareConfirmed(false);
        void inspect({ path, filename });
      })
      .catch(() => undefined);
  }, [
    applyFirmware,
    cabinetIndex,
    enqueueSnackbar,
    filename,
    firmware,
    firmwareConfirmed,
    incompatibleFirmwareTargets.length,
    inspect,
    inspection,
    path,
    selected,
  ]);

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FilenameEllipsis
          filename={filename}
          placeholder="Выберите конфигурацию кабинета (*.ncp)"
          sx={{ flexGrow: 1 }}
        />
        <IconButton aria-label="Выбрать NCP" onClick={selectFile} disabled={busy}>
          <FolderOpenIcon />
        </IconButton>
      </Box>

      {operationError && <Alert severity="error">{operationError}</Alert>}
      {busy && !firmwareState.isLoading && <CircularProgress size={28} />}
      {firmwareState.isLoading && (
        <Stack spacing={0.5}>
          <LinearProgress
            variant={firmwareProgress ? 'determinate' : 'indeterminate'}
            value={firmwareProgress?.overallProgress}
          />
          <Typography variant="body2">
            {firmwareProgress
              ? `Порт ${firmwareProgress.port + 1}, карта ${firmwareProgress.receivingCard + 1}: ${firmwareProgress.fileLabel || 'подготовка'}, файл ${Math.min(firmwareProgress.fileIndex + 1, firmwareProgress.totalFiles || 1)}/${firmwareProgress.totalFiles || '—'}, ${firmwareProgress.fileProgress}% (всего ${Math.round(firmwareProgress.overallProgress)}%)`
              : 'Подготовка firmware…'}
          </Typography>
        </Stack>
      )}

      {inspection && cabinet && (
        <>
          {inspection.cabinets.length > 1 && (
            <FormControl fullWidth size="small">
              <InputLabel id="ncp-cabinet-label">Конфигурация</InputLabel>
              <Select
                labelId="ncp-cabinet-label"
                label="Конфигурация"
                value={cabinetIndex}
                onChange={event => {
                  setCabinetIndex(Number(event.target.value));
                  setConfirmed(false);
                  setFirmwareConfirmed(false);
                }}
              >
                {inspection.cabinets.map(item => (
                  <MenuItem value={item.index} key={item.index}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Typography>
            {inspection.packageName ?? cabinet.name}:{' '}
            {cabinet.cardModel ?? 'модель карты не указана'}
            {cabinet.icType ? `, ${cabinet.icType}` : ''}
            {cabinet.refreshRate ? `, ${cabinet.refreshRate} Гц` : ''}
          </Typography>
          {firmware && (
            <Alert severity="info">
              Firmware: {firmware.filename}
              {firmware.version ? `; версия манифеста пакета ${firmware.version}` : ''}; модель{' '}
              {firmware.model ?? 'не указана'}, ID {firmware.modelId ?? 'не указан'}.
              {firmware.files.length > 0 && (
                <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                  {firmware.files.map(file => (
                    <Typography
                      component="span"
                      variant="body2"
                      key={file.filename}
                      sx={{ display: 'block' }}
                    >
                      {file.label}: {file.filename}
                      {file.version ? `; Version в манифесте: ${file.version}` : ''}
                    </Typography>
                  ))}
                </Box>
              )}
            </Alert>
          )}

          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={selected.length === availableTargets.length && selected.length > 0}
                  indeterminate={selected.length > 0 && selected.length < availableTargets.length}
                  onChange={event => {
                    setSelectedTargets(
                      new Set(
                        event.target.checked
                          ? availableTargets.map(target =>
                              targetKey(target.port, target.receivingCard),
                            )
                          : [],
                      ),
                    );
                    setConfirmed(false);
                    setFirmwareConfirmed(false);
                  }}
                />
              }
              label="Выбрать все принимающие карты"
            />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>Порт</TableCell>
                  <TableCell>Карта</TableCell>
                  <TableCell>Область</TableCell>
                  <TableCell>Модель ID</TableCell>
                  <TableCell>FPGA</TableCell>
                  <TableCell>MCU</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inspection.targets.map(target => {
                  const key = targetKey(target.port, target.receivingCard);
                  return (
                    <TableRow key={key}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          disabled={
                            target.version?.modelId === undefined || Boolean(target.version.error)
                          }
                          checked={selectedTargets.has(key)}
                          onChange={event =>
                            setSelectedTargets(previous => {
                              const next = new Set(previous);
                              if (event.target.checked) next.add(key);
                              else next.delete(key);
                              setConfirmed(false);
                              setFirmwareConfirmed(false);
                              return next;
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>{target.port + 1}</TableCell>
                      <TableCell>{target.receivingCard + 1}</TableCell>
                      <TableCell>
                        {target.width}×{target.height} @ {target.x}, {target.y}
                      </TableCell>
                      <TableCell>
                        {target.version?.error ? 'недоступна' : (target.version?.modelId ?? '—')}
                      </TableCell>
                      <TableCell>{target.version?.fpgaVersion ?? '—'}</TableCell>
                      <TableCell>{target.version?.mcuVersion ?? '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={confirmed}
                onChange={event => setConfirmed(event.target.checked)}
              />
            }
            label="Я проверил модель кабинета и выбранные принимающие карты"
          />
          {firmware && (
            <>
              {incompatibleFirmwareTargets.length > 0 && (
                <Alert severity="warning">
                  Прошивка заблокирована: модель одной или нескольких выбранных карт не совпадает с
                  firmware.
                </Alert>
              )}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={firmwareConfirmed}
                    onChange={event => setFirmwareConfirmed(event.target.checked)}
                  />
                }
                label="Я проверил модель карт и обеспечил стабильное питание на время прошивки"
              />
            </>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="contained"
              color="warning"
              startIcon={<MemoryIcon />}
              disabled={busy || !selected.length || !confirmed}
              onClick={applyConfiguration}
            >
              Применить NCP
            </Button>
            {firmware && (
              <Button
                variant="contained"
                color="error"
                startIcon={<SystemUpdateAltIcon />}
                disabled={
                  busy ||
                  !selected.length ||
                  incompatibleFirmwareTargets.length > 0 ||
                  !firmwareConfirmed
                }
                onClick={applyFirmwareUpdate}
              >
                Прошить firmware
              </Button>
            )}
          </Box>
        </>
      )}
    </Stack>
  );
};

export default memo(TaurusNcpConfiguration);
