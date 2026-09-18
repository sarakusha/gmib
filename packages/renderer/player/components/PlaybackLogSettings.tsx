import { Box, FormControl, FormHelperText, FormLabel, TextField } from '@mui/material';
import { useSnackbar } from 'notistack';
import * as React from 'react';

import { useGetPlaybackSettingsQuery, useUpdatePlaybackSettingsMutation } from '../api/playback';
import {
  DEFAULT_PLAYBACK_LOG_RETENTION_DAYS,
  isValidPlaybackLogRetentionDays,
  shouldSavePlaybackLogRetentionDays,
} from '../playback/playbackSettings';

const PlaybackLogSettings: React.FC = () => {
  const [value, setValue] = React.useState(String(DEFAULT_PLAYBACK_LOG_RETENTION_DAYS));
  const numericValue = Number(value);
  const valid = isValidPlaybackLogRetentionDays(numericValue);
  const { data, isError: isLoadError } = useGetPlaybackSettingsQuery();
  const [updateSettings, { isLoading }] = useUpdatePlaybackSettingsMutation();
  const { enqueueSnackbar } = useSnackbar();

  React.useEffect(() => {
    if (data) setValue(String(data.logRetentionDays));
  }, [data]);

  const save = (): void => {
    if (shouldSavePlaybackLogRetentionDays(numericValue, data?.logRetentionDays, isLoading)) {
      void updateSettings({ logRetentionDays: numericValue })
        .unwrap()
        .then(() => {
          enqueueSnackbar('Срок хранения журнала сохранён', {
            variant: 'success',
            preventDuplicate: true,
            autoHideDuration: 2000,
          });
        })
        .catch(() => {
          enqueueSnackbar('Не удалось сохранить срок хранения журнала', {
            variant: 'error',
            preventDuplicate: true,
            autoHideDuration: 3000,
          });
        });
    }
  };

  return (
    <Box sx={{ width: 1, height: 1, overflowY: 'auto' }}>
      <FormControl margin="normal" fullWidth error={!valid || isLoadError}>
        <FormLabel>Журнал воспроизведения</FormLabel>
        <TextField
          variant="standard"
          type="number"
          label="Хранить, дней"
          value={value}
          error={!valid || isLoadError}
          disabled={!data || isLoading}
          slotProps={{ htmlInput: { min: 1, max: 365, step: 1 } }}
          onChange={event => setValue(event.target.value)}
          onBlur={save}
          onKeyDown={event => {
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
          }}
        />
        <FormHelperText>
          {isLoadError
            ? 'Не удалось загрузить срок хранения журнала'
            : valid
              ? 'От 1 до 365 дней. По умолчанию 7.'
              : 'Введите целое число от 1 до 365'}
        </FormHelperText>
      </FormControl>
    </Box>
  );
};

export default PlaybackLogSettings;
