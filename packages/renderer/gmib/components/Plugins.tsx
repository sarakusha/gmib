import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import LaunchIcon from '@mui/icons-material/Launch';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {
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

import type { PluginPermission, PluginStatus } from '/@common/plugins';

const permissionLabels: Record<PluginPermission, string> = {
  'http.routes': 'HTTP',
  'output.pages': 'Вывод',
  realtime: 'События',
  storage: 'Хранилище',
};

const Plugins: React.FC = () => {
  const [plugins, setPlugins] = useState<PluginStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [restartAfterRemoval, setRestartAfterRemoval] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const load = useCallback(async () => {
    try {
      setPlugins(await window.plugins.list());
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : String(error), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    void load();
  }, [load]);

  const restartRequired = useMemo(
    () => restartAfterRemoval || plugins.some(plugin => plugin.restartRequired),
    [plugins, restartAfterRemoval],
  );

  const install = async () => {
    setBusyId('install');
    try {
      const result = await window.plugins.install();
      if (result.status === 'installed') {
        enqueueSnackbar(
          `${result.updated ? 'Обновлён' : 'Установлен'} плагин «${result.plugin.manifest.name}». Перезапустите gmib.`,
          { variant: 'success' },
        );
        await load();
      }
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : String(error), { variant: 'error' });
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
      enqueueSnackbar(error instanceof Error ? error.message : String(error), { variant: 'error' });
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
        await load();
      }
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : String(error), { variant: 'error' });
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
            Установка расширений gmib из архивов .gmib-plugin
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => void install()}
          disabled={busyId !== undefined}
          startIcon={
            busyId === 'install' ? <CircularProgress size={18} /> : <ExtensionOutlinedIcon />
          }
        >
          Установить
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
                                enqueueSnackbar(
                                  error instanceof Error ? error.message : String(error),
                                  { variant: 'error' },
                                );
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
                            <Stack direction="row" spacing={0.75}>
                              {manifest.permissions?.map(permission => (
                                <Chip
                                  key={permission}
                                  size="small"
                                  label={permissionLabels[permission]}
                                />
                              ))}
                            </Stack>
                          )}
                          {plugin.error && (
                            <Alert severity="error" sx={{ py: 0 }}>
                              {plugin.error}
                            </Alert>
                          )}
                        </Stack>
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
