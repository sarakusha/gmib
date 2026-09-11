import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import MemoryIcon from '@mui/icons-material/Memory';
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
  useApplyTaurusNcpConfigurationMutation,
  useInspectTaurusNcpConfigurationMutation,
} from '../api/novastar';

import FilenameEllipsis from './FilenameEllipsis';

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

const TaurusNcpConfiguration: React.FC<{ path: string; disabled?: boolean }> = ({
  path,
  disabled = false,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [filename, setFilename] = useState('');
  const [cabinetIndex, setCabinetIndex] = useState(0);
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [inspect, inspectionState] = useInspectTaurusNcpConfigurationMutation();
  const [apply, applyState] = useApplyTaurusNcpConfigurationMutation();
  const inspection = inspectionState.data;
  const resetInspection = inspectionState.reset;
  const previousPath = useRef<string | undefined>(undefined);
  const busy = disabled || inspectionState.isLoading || applyState.isLoading;
  const cabinet = inspection?.cabinets[cabinetIndex];
  const operationError = errorMessage(inspectionState.error) ?? errorMessage(applyState.error);

  useEffect(() => {
    if (previousPath.current === path) return;
    previousPath.current = path;
    setFilename('');
    setCabinetIndex(0);
    setSelectedTargets(new Set());
    setConfirmed(false);
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
    void inspect({ path, filename: selectedFile })
      .unwrap()
      .then(result => {
        const first = result.targets[0];
        setSelectedTargets(new Set(first ? [targetKey(first.port, first.receivingCard)] : []));
      })
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
      {busy && <CircularProgress size={28} />}

      {inspection && cabinet && (
        <>
          {inspection.cabinets.length > 1 && (
            <FormControl fullWidth size="small">
              <InputLabel id="ncp-cabinet-label">Конфигурация</InputLabel>
              <Select
                labelId="ncp-cabinet-label"
                label="Конфигурация"
                value={cabinetIndex}
                onChange={event => setCabinetIndex(Number(event.target.value))}
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
          {cabinet.firmwareFile && (
            <Typography variant="body2" color="text.secondary">
              В пакете есть firmware: {cabinet.firmwareFile}
            </Typography>
          )}

          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={selected.length === inspection.targets.length && selected.length > 0}
                  indeterminate={selected.length > 0 && selected.length < inspection.targets.length}
                  onChange={event =>
                    setSelectedTargets(
                      new Set(
                        event.target.checked
                          ? inspection.targets.map(target =>
                              targetKey(target.port, target.receivingCard),
                            )
                          : [],
                      ),
                    )
                  }
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
                </TableRow>
              </TableHead>
              <TableBody>
                {inspection.targets.map(target => {
                  const key = targetKey(target.port, target.receivingCard);
                  return (
                    <TableRow key={key}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedTargets.has(key)}
                          onChange={event =>
                            setSelectedTargets(previous => {
                              const next = new Set(previous);
                              if (event.target.checked) next.add(key);
                              else next.delete(key);
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
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              color="warning"
              startIcon={<MemoryIcon />}
              disabled={busy || !selected.length || !confirmed}
              onClick={applyConfiguration}
            >
              Применить NCP
            </Button>
          </Box>
        </>
      )}
    </Stack>
  );
};

export default memo(TaurusNcpConfiguration);
