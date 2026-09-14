import SaveAltIcon from '@mui/icons-material/SaveAlt';
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';

import {
  useApplyTaurusCalibrationMutation,
  useInspectTaurusCalibrationMutation,
} from '../api/novastar';

import type {
  TaurusCalibrationProgress,
  TaurusScreenConfiguration,
} from '/@common/taurusConfiguration';

const errorText = (error: unknown): string | undefined => {
  if (!error) return undefined;
  if (typeof error === 'object' && 'data' in error) return String(error.data);
  return error instanceof Error ? error.message : 'Не удалось выполнить операцию';
};

const stageText = {
  checking: 'Проверка плат',
  loading: 'Загрузка с плат',
  saving: 'Сохранение в A10s',
};

const TaurusCalibration: React.FC<{
  path: string;
  configuration?: TaurusScreenConfiguration;
  disabled: boolean;
  progress?: TaurusCalibrationProgress;
}> = ({ path, configuration, disabled, progress }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allowPartial, setAllowPartial] = useState(false);
  const [inspect, inspection] = useInspectTaurusCalibrationMutation();
  const [apply, operation] = useApplyTaurusCalibrationMutation();
  const cards = useMemo(
    () => [
      ...new Map(
        (configuration?.screens.flatMap(screen => screen.receivingCards) ?? []).map(card => [
          `${card.port}:${card.connection}`,
          { port: card.port, receivingCard: card.connection },
        ]),
      ).entries(),
    ],
    [configuration],
  );
  const targets = cards.filter(([key]) => selected.has(key)).map(([, card]) => card);
  const busy = disabled || inspection.isLoading || operation.isLoading;
  const result = operation.data ?? inspection.data;
  const error = errorText(operation.error) ?? errorText(inspection.error);
  const reset = () => {
    inspection.reset();
    operation.reset();
    setAllowPartial(false);
  };
  const missing = inspection.data?.cards.some(card => card.modules.some(module => !module.present));
  const hasModules = inspection.data?.cards.every(card =>
    card.modules.some(module => module.present),
  );

  return (
    <Stack spacing={1.5}>
      <Typography variant="h6">Коррекция с плат индикации</Typography>
      <Typography variant="body2">
        Загрузить обычные коэффициенты коррекции из памяти плат и сохранить их в принимающих картах.
        Сначала примените подходящие параметры NCP и проверьте подключение плат.
      </Typography>
      <Stack direction="row" sx={{ flexWrap: 'wrap' }}>
        {cards.map(([key, card]) => (
          <FormControlLabel
            key={key}
            label={`Порт ${card.port + 1}, карта ${card.receivingCard + 1}`}
            control={
              <Checkbox
                checked={selected.has(key)}
                disabled={busy}
                onChange={event => {
                  const next = new Set(selected);
                  if (event.target.checked) next.add(key);
                  else next.delete(key);
                  setSelected(next);
                  reset();
                }}
              />
            }
          />
        ))}
      </Stack>
      <Button
        disabled={busy || !targets.length}
        onClick={() => {
          operation.reset();
          setAllowPartial(false);
          void inspect({ path, targets })
            .unwrap()
            .catch(() => undefined);
        }}
      >
        Проверить платы
      </Button>
      {result?.cards.map(card => (
        <Alert
          key={`${card.port}:${card.receivingCard}`}
          severity={card.modules.every(module => module.present) ? 'info' : 'warning'}
        >
          Порт {card.port + 1}, карта {card.receivingCard + 1}: память плат найдена у{' '}
          {card.modules.filter(module => module.present).length} из {card.modules.length} модулей.
          {card.modules
            .filter(module => module.present)
            .map(module => (
              <Typography key={module.index} variant="body2">
                Модуль {module.index + 1}: {module.width}×{module.height} @ {module.x}, {module.y}
              </Typography>
            ))}
        </Alert>
      ))}
      {missing && (
        <FormControlLabel
          control={
            <Checkbox
              checked={allowPartial}
              disabled={busy}
              onChange={event => setAllowPartial(event.target.checked)}
            />
          }
          label="Подтверждаю загрузку при неполном наборе плат. Коррекция всего кабинета не гарантируется."
        />
      )}
      {(inspection.isLoading || operation.isLoading) && (
        <>
          <LinearProgress />
          <Typography variant="body2">
            {progress
              ? `${stageText[progress.stage]}: порт ${progress.target.port + 1}, карта ${progress.target.receivingCard + 1}. Завершено ${progress.completed}/${progress.total}`
              : 'Подготовка…'}
          </Typography>
        </>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      {operation.data && (
        <Alert severity="success">
          Сохранено в принимающих картах: {operation.data.completed}/{operation.data.total}.
          Проверьте изображение на подключённых платах.
        </Alert>
      )}
      <Button
        variant="contained"
        color="warning"
        startIcon={<SaveAltIcon />}
        disabled={
          busy ||
          !targets.length ||
          !hasModules ||
          (missing && !allowPartial) ||
          Boolean(operation.data)
        }
        onClick={() => {
          if (
            !window.confirm(
              `Загрузить коррекцию с плат и заменить сохранённые коэффициенты в выбранных принимающих картах (${targets.length})?${allowPartial ? '\nПодключён неполный набор плат.' : ''}\nНе отключайте питание до завершения.`,
            )
          )
            return;
          void apply({ path, targets, allowPartial })
            .unwrap()
            .catch(() => undefined);
        }}
      >
        Загрузить с плат и сохранить
      </Button>
    </Stack>
  );
};

export default TaurusCalibration;
