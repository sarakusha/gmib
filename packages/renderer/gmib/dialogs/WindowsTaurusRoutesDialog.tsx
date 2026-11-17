import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';

import { isRemoteSession } from '/@common/remote';
import type { WindowsTaurusAdapter, WindowsTaurusRouteStatus } from '/@common/windowsTaurusRoutes';

const localApi = () => (isRemoteSession ? undefined : window.windowsTaurusRoutes);

export const canCheckTaurusRoutes = () => Boolean(localApi()?.isSupportedPlatform);

const routeWarnings = (status: WindowsTaurusRouteStatus) =>
  status.adapters.filter(
    adapter =>
      adapter.defaultRoutes.length > 0 ||
      (status.platform === 'linux' && adapter.protection === 'missing'),
  );

const adapterInterface = (adapter: WindowsTaurusAdapter) =>
  adapter.interfaceGuid || adapter.interfaceIndex;

const signature = (adapter: WindowsTaurusAdapter): string =>
  JSON.stringify([
    adapter.deviceId,
    adapterInterface(adapter),
    adapter.protection,
    adapter.confirmedTaurus,
    adapter.defaultRoutes
      .map(route => JSON.stringify([route.nextHop, route.metric, route.table]))
      .sort(),
  ]);

type RouteAction =
  | { kind: 'check' }
  | {
      kind: 'repair';
      adapter: WindowsTaurusAdapter;
      platform: WindowsTaurusRouteStatus['platform'];
    }
  | {
      kind: 'copy';
      adapter: WindowsTaurusAdapter;
      showCommands: (commands: string) => void;
      automatic?: boolean;
    }
  | {
      kind: 'automatic';
      adapter: WindowsTaurusAdapter;
      enabled: boolean;
      platform: WindowsTaurusRouteStatus['platform'];
    };

type AdapterProps = {
  adapter: WindowsTaurusAdapter;
  platform: WindowsTaurusRouteStatus['platform'];
  routeInspectionComplete: boolean;
  elevated: boolean;
  disabled: boolean;
  run: (action: RouteAction) => void;
};

function AdapterActions({
  adapter,
  platform,
  routeInspectionComplete,
  elevated,
  disabled,
  run,
}: AdapterProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedRndisScope, setConfirmedRndisScope] = useState(false);
  const [commands, setCommands] = useState('');
  const showCommands = (text: string) => setCommands(text);
  const canChange =
    platform !== 'unsupported' &&
    routeInspectionComplete &&
    Boolean(adapter.deviceId) &&
    adapter.defaultRoutes.length > 0;
  const isTaurus = adapter.confirmedTaurus || confirmed;
  const isLinux = platform === 'linux';
  const alreadyProtected = isLinux && adapter.protection === 'enabled' && !adapter.autoEnabled;
  const canSetAutomatic =
    platform !== 'unsupported' && Boolean(adapter.deviceId) && adapter.automaticSupported !== false;
  const canToggleAutomatic =
    canSetAutomatic && !alreadyProtected && adapter.autoEnabled !== undefined;
  const nextAutomatic = !adapter.autoEnabled;
  const automaticDisabled =
    disabled || (nextAutomatic && (!isTaurus || (isLinux && !confirmedRndisScope)));
  const automaticLabel = nextAutomatic
    ? isLinux
      ? 'Настроить защиту как в gmib-kiosk'
      : 'Включить автоисправление'
    : isLinux
      ? 'Удалить правило GMIB'
      : 'Выключить автоисправление';
  const automaticCopyLabel = nextAutomatic
    ? isLinux
      ? 'Копировать команду настройки'
      : 'Копировать команду включения'
    : isLinux
      ? 'Копировать команду удаления правила GMIB'
      : 'Копировать команду выключения';

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography sx={{ fontWeight: 'bold' }}>{adapter.interfaceAlias}</Typography>
      <Typography>USB-серийный номер — {adapter.serialNumber || 'недоступен'}</Typography>
      {adapter.confirmedTaurus && (
        <Typography>Серийный номер совпадает с обнаруженным Taurus.</Typography>
      )}
      {platform === 'linux' ? (
        <Typography>
          Настройка gmib-kiosk (маршруты и DNS) —{' '}
          {adapter.protection === 'enabled'
            ? 'задана в Netplan'
            : adapter.protection === 'missing'
              ? 'не задана полностью'
              : 'не удалось проверить'}
          .
        </Typography>
      ) : (
        <Typography>
          {adapter.protection === 'enabled' && 'Защита от маршрута по умолчанию включена.'}
          {adapter.protection === 'missing' && 'Защита от маршрута по умолчанию не включена.'}
          {adapter.protection === 'unknown' &&
            'Не удалось определить настройку защиты от маршрута по умолчанию.'}
        </Typography>
      )}
      {routeInspectionComplete && !adapter.defaultRoutes.length && (
        <Typography>Активного маршрута 0.0.0.0/0 через этот адаптер нет.</Typography>
      )}
      {adapter.defaultRoutes.map(({ nextHop, metric, table }) => (
        <Typography key={JSON.stringify([nextHop, metric, table])}>
          Маршрут 0.0.0.0/0 через {nextHop}, метрика {metric}
          {table && `, таблица ${table}`}
        </Typography>
      ))}
      {adapter.dnsServers.length > 0 && (
        <Typography>DNS на адаптере — {adapter.dnsServers.join(', ')}</Typography>
      )}
      {(canChange || (canToggleAutomatic && nextAutomatic)) && !adapter.confirmedTaurus && (
        <FormControlLabel
          control={
            <Checkbox
              checked={confirmed}
              disabled={disabled}
              onChange={(_, checked) => {
                setConfirmed(checked);
                setConfirmedRndisScope(false);
                setCommands('');
              }}
            />
          }
          label="Подтверждаю, что это подключённый Taurus"
        />
      )}
      {canChange && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {elevated && (
            <Button
              variant="contained"
              disabled={disabled || !isTaurus}
              onClick={() => run({ kind: 'repair', adapter, platform })}
            >
              Исправить
            </Button>
          )}
          <Button
            disabled={disabled || !isTaurus}
            onClick={() => {
              setCommands('');
              run({ kind: 'copy', adapter, showCommands });
            }}
          >
            Копировать команды
          </Button>
        </Box>
      )}
      {canSetAutomatic && (
        <Stack spacing={1} sx={{ mt: 2 }}>
          {isLinux ? (
            <>
              <Typography sx={{ fontWeight: 'bold' }}>Постоянная защита USB RNDIS</Typography>
              <Typography>
                {alreadyProtected
                  ? 'Защита уже настроена.'
                  : adapter.autoEnabled === true
                    ? 'Правило Netplan от GMIB сохранено. Оно вступает в силу после перезагрузки.'
                    : adapter.autoEnabled === false
                      ? 'Правило Netplan от GMIB не установлено.'
                      : 'Не удалось проверить наличие правила Netplan от GMIB.'}
              </Typography>
              {!alreadyProtected && (
                <Typography variant="body2">
                  {adapter.autoEnabled
                    ? 'При удалении правила GMIB остальные файлы Netplan сохранятся. Изменение вступит в силу после перезагрузки.'
                    : 'После перезагрузки Netplan будет игнорировать маршруты и DNS, полученные по DHCP через rndis_host.'}
                </Typography>
              )}
              {canToggleAutomatic && nextAutomatic && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={confirmedRndisScope}
                      disabled={disabled || !isTaurus}
                      onChange={(_, checked) => {
                        setConfirmedRndisScope(checked);
                        setCommands('');
                      }}
                    />
                  }
                  label="Правило будет действовать для всех USB RNDIS-адаптеров. Они не будут использоваться для доступа в интернет"
                />
              )}
            </>
          ) : (
            <>
              <Typography sx={{ fontWeight: 'bold' }}>
                Автоматически исправлять для этого Taurus
              </Typography>
              <Typography>
                {adapter.autoEnabled === true
                  ? 'Включено.'
                  : adapter.autoEnabled === false
                    ? 'Выключено.'
                    : 'Не удалось проверить состояние.'}
              </Typography>
              <Typography variant="body2">
                Задача Windows проверяет этот USB-адаптер при запуске системы и при подключении
                сети, в том числе при закрытом GMIB. После события возможны короткие повторные
                проверки. До исправления маршрута интернет или VPN могут ненадолго прерваться.
              </Typography>
            </>
          )}
          {canToggleAutomatic && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {elevated && (
                <Button
                  disabled={automaticDisabled}
                  onClick={() => {
                    setCommands('');
                    run({ kind: 'automatic', adapter, enabled: nextAutomatic, platform });
                  }}
                >
                  {automaticLabel}
                </Button>
              )}
              <Button
                disabled={automaticDisabled}
                onClick={() => {
                  setCommands('');
                  run({ kind: 'copy', adapter, showCommands, automatic: nextAutomatic });
                }}
              >
                {automaticCopyLabel}
              </Button>
            </Box>
          )}
        </Stack>
      )}
      {commands && (
        <>
          <Typography sx={{ mt: 1 }}>
            {platform === 'win32'
              ? 'Выполните команды в PowerShell от имени администратора.'
              : 'Выполните команды в терминале с правами администратора.'}{' '}
            Затем нажмите «Проверить снова».
          </Typography>
          <Paper
            component="pre"
            variant="outlined"
            sx={{
              m: 0,
              mt: 1,
              p: 1,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              userSelect: 'text',
            }}
          >
            {commands}
          </Paper>
        </>
      )}
    </Paper>
  );
}

type Props = { requestedOpen: boolean; connectionState: string; onClose: () => void };

export default function WindowsTaurusRoutesDialog({
  requestedOpen,
  connectionState,
  onClose,
}: Props) {
  const api = localApi();
  const runAction = useRef<(action: RouteAction) => void>(() => undefined);
  const requestInspection = useRef<() => void>(() => undefined);
  const [status, setStatus] = useState<WindowsTaurusRouteStatus>();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inspectionFailed, setInspectionFailed] = useState(false);
  const [feedback, setFeedback] = useState<{ severity: 'error' | 'success'; message: string }>();

  useEffect(() => {
    if (!api?.isSupportedPlatform) return;
    let stopped = false;
    let running = false;
    let queued = false;
    let scheduled = false;

    const check = async (): Promise<WindowsTaurusRouteStatus> => {
      try {
        const next = await api.inspect();
        if (!stopped) {
          setStatus(next);
          setInspectionFailed(false);
          const current = new Set(routeWarnings(next).map(signature));
          setDismissed(previous => previous.filter(entry => current.has(entry)));
        }
        return next;
      } catch (error) {
        if (!stopped) setInspectionFailed(true);
        throw error;
      }
    };

    const run = async (action?: RouteAction) => {
      if (stopped || running) return;
      running = true;
      setBusy(true);
      if (action) {
        setManualOpen(true);
        setFeedback(undefined);
      }
      try {
        if (action?.kind === 'copy') {
          const commands =
            action.automatic === undefined
              ? await api.commands(action.adapter.deviceId)
              : await api.automaticCommands(action.adapter.deviceId, action.automatic);
          if (stopped) return;
          action.showCommands(commands);
          await navigator.clipboard.writeText(commands);
          if (!stopped) setFeedback({ severity: 'success', message: 'Команды скопированы.' });
        } else if (action?.kind === 'automatic') {
          await api.setAutomatic(action.adapter.deviceId, action.enabled);
          if (stopped) return;
          const next = await check();
          if (
            !next.adapters.some(
              adapter =>
                adapter.deviceId === action.adapter.deviceId &&
                adapter.autoEnabled === action.enabled,
            )
          ) {
            throw new Error(
              action.platform === 'linux'
                ? 'Повторная проверка не подтвердила изменение правила Netplan.'
                : 'Повторная проверка не подтвердила состояние автоисправления.',
            );
          }
          if (!stopped)
            setFeedback({
              severity: 'success',
              message:
                action.platform === 'linux'
                  ? action.enabled
                    ? 'Правило Netplan от GMIB сохранено. Для применения нужна перезагрузка.'
                    : 'Правило Netplan от GMIB удалено. Для применения нужна перезагрузка.'
                  : action.enabled
                    ? 'Автоисправление включено.'
                    : 'Автоисправление выключено.',
            });
        } else if (action?.kind === 'repair') {
          await api.repair(action.adapter.deviceId);
          if (stopped) return;
          const next = await check();
          const repaired = next.adapters.find(
            adapter =>
              adapter.deviceId === action.adapter.deviceId &&
              adapterInterface(adapter) === adapterInterface(action.adapter),
          );
          if (
            !repaired ||
            next.routeInspectionComplete === false ||
            repaired.defaultRoutes.length > 0 ||
            (action.platform === 'win32' && repaired.protection !== 'enabled')
          ) {
            throw new Error('Повторная проверка не подтвердила исправление.');
          }
          if (!stopped) {
            setFeedback({
              severity: 'success',
              message:
                action.platform === 'win32'
                  ? 'Защита включена. Активного маршрута по умолчанию через адаптер нет.'
                  : 'Активный маршрут по умолчанию удалён. DHCP может добавить его снова.',
            });
          }
        } else {
          await check();
        }
      } catch (error) {
        if (!stopped) {
          setFeedback({
            severity: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        running = false;
        if (!stopped) {
          if (queued) {
            queued = false;
            scheduleInspection();
          } else {
            setBusy(false);
          }
        }
      }
    };

    const scheduleInspection = () => {
      if (stopped || scheduled) return;
      if (running) {
        queued = true;
        return;
      }
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        if (running) queued = true;
        else void run();
      });
    };

    runAction.current = action => void run(action);
    requestInspection.current = scheduleInspection;
    const events = ['online', 'offline', 'focus'] as const;
    for (const event of events) window.addEventListener(event, scheduleInspection);
    scheduleInspection();
    return () => {
      stopped = true;
      for (const event of events) window.removeEventListener(event, scheduleInspection);
    };
  }, [api]);

  useEffect(() => requestInspection.current(), [connectionState]);
  useEffect(() => {
    if (requestedOpen) requestInspection.current();
  }, [requestedOpen]);

  if (!api?.isSupportedPlatform) return null;
  const adapters = status?.adapters ?? [];
  const warnings = status ? routeWarnings(status) : [];
  const open =
    requestedOpen ||
    manualOpen ||
    warnings.some(adapter => !dismissed.includes(signature(adapter)));
  const close = () => {
    if (busy) return;
    setDismissed(warnings.map(signature));
    setManualOpen(false);
    setFeedback(undefined);
    onClose();
  };
  const run = (action: RouteAction) => runAction.current(action);

  return (
    <>
      {!open && warnings.length > 0 && (
        <Alert
          severity="warning"
          action={
            <Button
              color="inherit"
              onClick={() => {
                setManualOpen(true);
                requestInspection.current();
              }}
            >
              Подробнее
            </Button>
          }
        >
          {warnings.some(adapter => adapter.defaultRoutes.length > 0)
            ? 'Обнаружен маршрут по умолчанию через USB-адаптер.'
            : 'На USB-адаптере не полностью применена настройка маршрутов и DNS gmib-kiosk.'}
        </Alert>
      )}
      <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle>USB-сеть Taurus</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {status?.diagnostic && <Alert severity="info">{status.diagnostic}</Alert>}
            {warnings.length > 0 && (
              <>
                <DialogContentText>
                  Маршрут по умолчанию через USB-адаптер может нарушить доступ в интернет. Если
                  после его удаления доступ не восстановится, проверьте настройки DNS.
                </DialogContentText>
                {status?.platform === 'linux' && !status.diagnostic && (
                  <Alert severity="info">
                    Сверьте серийный номер Taurus. Включите запрет маршрута по умолчанию в
                    настройках сетевого подключения этого USB-адаптера и нажмите «Проверить снова».
                  </Alert>
                )}
                {warnings.some(adapter => adapter.defaultRoutes.length > 0) &&
                  !status?.elevated && (
                    <Alert severity="info">
                      Для исправления нужны права администратора. Скопируйте команды для запуска
                      {status?.platform === 'win32' ? ' в PowerShell.' : ' в терминале.'}
                    </Alert>
                  )}
              </>
            )}
            {status &&
              (requestedOpen || manualOpen || !warnings.length ? adapters : warnings).map(
                adapter => (
                  <AdapterActions
                    key={signature(adapter)}
                    adapter={adapter}
                    platform={status.platform}
                    routeInspectionComplete={status.routeInspectionComplete !== false}
                    elevated={status.elevated}
                    disabled={busy || inspectionFailed || !status.supported}
                    run={run}
                  />
                ),
              )}
            {!adapters.length &&
              status?.supported &&
              !status.diagnostic &&
              !inspectionFailed &&
              !feedback && (
                <DialogContentText>USB-сетевые адаптеры Taurus не найдены.</DialogContentText>
              )}
            {busy && !status && <DialogContentText>Проверяем USB-сеть…</DialogContentText>}
            {feedback && <Alert severity={feedback.severity}>{feedback.message}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => run({ kind: 'check' })}>
            Проверить снова
          </Button>
          <Button disabled={busy} onClick={close}>
            {warnings.length ? 'Позже' : 'Закрыть'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
