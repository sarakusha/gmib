import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { Alert, Backdrop, Box, CircularProgress, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';

import type { SessionStatus } from '../store/sessionSlice';

export const CONNECTION_LOSS_GRACE_MS = 3000;

interface Props {
  online: boolean;
  loading: boolean;
  status: SessionStatus;
  error?: string;
}

const ConnectionFeedback: React.FC<Props> = ({ online, loading, status, error }) => {
  const [wasReady, setWasReady] = useState(false);
  const [lossConfirmed, setLossConfirmed] = useState(false);
  const closed = status === 'closed';

  useEffect(() => {
    if (online && !loading) setWasReady(true);
  }, [loading, online]);

  useEffect(() => {
    setLossConfirmed(false);
    if (online || !wasReady || closed) return;
    const timer = setTimeout(() => setLossConfirmed(true), CONNECTION_LOSS_GRACE_MS);
    return () => clearTimeout(timer);
  }, [closed, online, wasReady]);

  const reconnecting = !online && wasReady && !closed;
  const failed = closed || (!wasReady && status === 'failed');
  const blocking = loading || (!online && (!reconnecting || lossConfirmed));
  const message = failed
    ? closed
      ? 'Соединение закрыто. Подключитесь заново.'
      : 'Не удалось подключиться.'
    : reconnecting
      ? 'Связь прервалась. Ожидаем восстановления…'
      : online
        ? 'Загружаем настройки…'
        : 'Подключаемся…';

  return (
    <>
      <Backdrop open={blocking} sx={{ zIndex: theme => theme.zIndex.drawer + 10, color: '#fff' }}>
        <Box role="status" aria-live="polite" sx={{ textAlign: 'center', maxWidth: 480, p: 3 }}>
          {failed ? <HighlightOffIcon fontSize="large" /> : <CircularProgress color="inherit" />}
          <Typography sx={{ mt: 2 }}>{message}</Typography>
          {failed && error && <Typography sx={{ mt: 1 }}>{error}</Typography>}
        </Box>
      </Backdrop>
      {reconnecting && !blocking && (
        <Alert
          severity="warning"
          role="status"
          sx={{
            position: 'fixed',
            top: 72,
            right: 16,
            maxWidth: 'calc(100% - 32px)',
            zIndex: theme => theme.zIndex.drawer + 10,
            pointerEvents: 'none',
          }}
        >
          Связь нестабильна. Ожидаем ответа…
        </Alert>
      )}
    </>
  );
};

export default ConnectionFeedback;
