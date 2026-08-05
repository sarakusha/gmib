import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import LaunchIcon from '@mui/icons-material/Launch';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import semver from 'semver';

import type { PluginCatalogEntry, PluginPermission, PluginStatus } from '/@common/plugins';

const permissionLabels: Record<PluginPermission, string> = {
  'http.routes': 'HTTP',
  'output.pages': 'Вывод',
  realtime: 'События',
  storage: 'Хранилище',
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const PluginDescription: React.FC<{
  manifest: PluginCatalogEntry['manifest'];
  extra?: React.ReactNode;
}> = ({ manifest, extra }) => (
  <Stack spacing={1} sx={{ mt: 0.75 }}>
    {manifest.description && (
      <Typography variant="body2" color="text.secondary">
        {manifest.description}
      </Typography>
    )}
    <Typography variant="caption" color="text.secondary">
      {manifest.id} · Plugin API {manifest.gmibApi}
    </Typography>
    {(manifest.permissions?.length ?? 0) > 0 && (
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
        {manifest.permissions?.map(permission => (
          <Chip key={permission} size="small" label={permissionLabels[permission]} />
        ))}
      </Stack>
    )}
    {extra}
  </Stack>
);

const Plugins: React.FC = () => {
  const [plugins, setPlugins] = useState<PluginStatus[]>([]);
  const [catalog, setCatalog] = useState<PluginCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();
  const [restartAfterRemoval, setRestartAfterRemoval] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const loadInstalled = useCallback(async () => {
    try {
      setPlugins(await window.plugins.list());
    } catch (error) {
      enqueueSnackbar(errorMessage(error), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(undefined);
    try {
      setCatalog(await window.plugins.catalog());
    } catch (error) {
      setCatalogError(errorMessage(error));
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInstalled();
    void loadCatalog();
  }, [loadCatalog, loadInstalled]);

  const restartRequired = useMemo(
    () => restartAfterRemoval || plugins.some(plugin => plugin.restartRequired),
    [plugins, restartAfterRemoval],
  );

  const installFromFile = async () => {
    setBusyId('file');
    try {
      const result = await window.plugins.install();
      if (result.status === 'installed') {
        enqueueSnackbar(
          `${result.updated ? 'Обновлён' : 'Установлен'} плагин «${result.plugin.manifest.name}». Перезапустите gmib.`,
          { variant: 'success' },
        );
        await loadInstalled();
      }
    } catch (error) {
      enqueueSnackbar(errorMessage(error), { variant: 'error' });
    } finally {
      setBusyId(undefined);
    }
  };

  const installOfficial = async (entry: PluginCatalogEntry) => {
    setBusyId(`catalog:${entry.manifest.id}`);
    try {
      const result = await window.plugins.installOfficial(entry.manifest.id);
      if (result.status === 'installed') {
        enqueueSnackbar(
          `${result.updated ? 'Обновлён' : 'Установлен'} официальный плагин «${result.plugin.manifest.name}». Перезапустите gmib.`,
          { variant: 'success' },
        );
        await loadInstalled();
      }
    } catch (error) {
      enqueueSnackbar(errorMessage(error), { variant: 'error' });
    } finally {
      setBusyId(undefined);
    }
  };

  const setEnabled = async (plugin: PluginStatus, enabled: boolean) => {
    setBusyId(plugin.manifest.id);
    try {
      const updated = await window.plugins.setEnabled(plugin.manifest.id, enabled);
      setPlugins(current =>
        current.map(item => (item.manifest.id === plugin.manifest.id ? updated : item)),
      );
    } catch (error) {
      enqueueSnackbar(errorMessage(error), { variant: 'error' });
    } finally {
      setBusyId(undefined);
    }
  };

  const uninstall = async (plugin: PluginStatus) => {
    setBusyId(plugin.manifest.id);
    try {
      if (await window.plugins.uninstall(plugin.manifest.id)) {
        if (plugin.loaded) setRestartAfterRemoval(true);
        enqueueSnackbar(
          `Плагин «${plugin.manifest.name}» удалён${plugin.loaded ? '. Перезапустите gmib' : ''}`,
          { variant: 'success' },
        );
        await loadInstalled();
      }
    } catch (error) {
      enqueueSnackbar(errorMessage(error), { variant: 'error' });
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <Box sx={{ width: 1, height: 1, overflow: 'auto', p: 3 }}>
      <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center' }}>
        <ExtensionOutlinedIcon color="primary" fontSize="large" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">Плагины</Typography>
          <Typography color="text.secondary">
            Официальный каталог и локальные расширения gmib
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => void installFromFile()}
          disabled={busyId !== undefined}
          startIcon={busyId === 'file' ? <CircularProgress size={18} /> : <ExtensionOutlinedIcon />}
        >
          Установить из файла
        </Button>
      </Stack>

      {restartRequired && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<RestartAltIcon />}
              onClick={() => void window.plugins.restart()}
            >
              Перезапустить
            </Button>
          }
        >
          Изменения состава плагинов вступят в силу после перезапуска gmib.
        </Alert>
      )}

      <Accordion
        disableGutters
        elevation={0}
        sx={{
          mb: 3,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">Официальные плагины</Typography>
            <Typography variant="body2" color="text.secondary">
              Расширения из проверенного каталога gmib
            </Typography>
          </Box>
          {catalogLoading ? (
            <CircularProgress size={20} sx={{ mr: 1 }} />
          ) : catalogError ? (
            <Chip size="small" color="warning" label="Ошибка загрузки" sx={{ mr: 1 }} />
          ) : (
            <Chip size="small" label={catalog.length} sx={{ mr: 1 }} />
          )}
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0, borderTop: 1, borderColor: 'divider' }}>
          <Stack direction="row" sx={{ px: 2, py: 1, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              Доступны установка и обновление совместимых версий
            </Typography>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => void loadCatalog()}
              disabled={catalogLoading || busyId !== undefined}
            >
              Обновить каталог
            </Button>
          </Stack>
          {catalogError ? (
            <Alert
              severity="warning"
              sx={{ mx: 2, mb: 2 }}
              action={
                <Button color="inherit" size="small" onClick={() => void loadCatalog()}>
                  Повторить
                </Button>
              }
            >
              {catalogError}
            </Alert>
          ) : catalogLoading ? (
            <Stack sx={{ p: 4, alignItems: 'center' }}>
              <CircularProgress />
            </Stack>
          ) : catalog.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>
              В официальном каталоге пока нет совместимых плагинов
            </Typography>
          ) : (
            <List disablePadding>
              {catalog.map(entry => {
                const { manifest } = entry;
                const installed = plugins.find(plugin => plugin.manifest.id === manifest.id);
                const updateAvailable = Boolean(
                  installed && semver.gt(manifest.version, installed.manifest.version),
                );
                const installedCurrent = Boolean(installed && !updateAvailable);
                const busy = busyId === `catalog:${manifest.id}`;
                return (
                  <React.Fragment key={manifest.id}>
                    <Divider />
                    <ListItem
                      alignItems="flex-start"
                      secondaryAction={
                        <Button
                          variant={updateAvailable ? 'contained' : 'outlined'}
                          disabled={busyId !== undefined || installedCurrent}
                          onClick={() => void installOfficial(entry)}
                          startIcon={busy ? <CircularProgress size={18} /> : undefined}
                        >
                          {installedCurrent
                            ? 'Установлен'
                            : updateAvailable
                              ? 'Обновить'
                              : 'Установить'}
                        </Button>
                      }
                      sx={{ pr: 19, py: 2 }}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <Typography sx={{ fontWeight: 500 }}>{manifest.name}</Typography>
                            <Chip size="small" label={manifest.version} variant="outlined" />
                            <Chip size="small" color="success" label="Официальный" />
                            {Boolean(manifest.main) && (
                              <Chip size="small" color="warning" label="Доверенный" />
                            )}
                          </Stack>
                        }
                        secondary={
                          <PluginDescription
                            manifest={manifest}
                            extra={
                              <Typography variant="caption" color="text.secondary">
                                Издатель: {entry.publisher.name}
                              </Typography>
                            }
                          />
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </AccordionDetails>
      </Accordion>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Установленные плагины
      </Typography>
      <Paper variant="outlined">
        {loading ? (
          <Stack sx={{ p: 5, alignItems: 'center' }}>
            <CircularProgress />
          </Stack>
        ) : plugins.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>
            Установленных плагинов нет
          </Typography>
        ) : (
          <List disablePadding>
            {plugins.map((plugin, index) => {
              const { manifest } = plugin;
              const busy = busyId === manifest.id;
              return (
                <React.Fragment key={manifest.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    alignItems="flex-start"
                    secondaryAction={
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        {manifest.control && (
                          <Button
                            size="small"
                            startIcon={<LaunchIcon />}
                            disabled={!plugin.loaded || busy}
                            onClick={() =>
                              void window.plugins.openControl(manifest.id).catch(error => {
                                enqueueSnackbar(errorMessage(error), { variant: 'error' });
                              })
                            }
                          >
                            {manifest.control.title ?? 'Управление'}
                          </Button>
                        )}
                        <FormControlLabel
                          control={
                            <Switch
                              checked={plugin.enabled}
                              disabled={busy}
                              onChange={(_, checked) => void setEnabled(plugin, checked)}
                            />
                          }
                          label={plugin.enabled ? 'Включён' : 'Выключен'}
                        />
                        <Button
                          color="error"
                          size="small"
                          startIcon={<DeleteOutlineIcon />}
                          disabled={busy}
                          onClick={() => void uninstall(plugin)}
                        >
                          Удалить
                        </Button>
                      </Stack>
                    }
                    sx={{ pr: 43, py: 2 }}
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Typography sx={{ fontWeight: 500 }}>{manifest.name}</Typography>
                          <Chip size="small" label={manifest.version} variant="outlined" />
                          {Boolean(manifest.main) && (
                            <Chip size="small" color="warning" label="Доверенный" />
                          )}
                          {plugin.error && <Chip size="small" color="error" label="Ошибка" />}
                        </Stack>
                      }
                      secondary={
                        <PluginDescription
                          manifest={manifest}
                          extra={
                            plugin.error ? (
                              <Alert severity="error" sx={{ py: 0 }}>
                                {plugin.error}
                              </Alert>
                            ) : undefined
                          }
                        />
                      }
                    />
                  </ListItem>
                </React.Fragment>
              );
            })}
          </List>
        )}
      </Paper>
    </Box>
  );
};

export default Plugins;
