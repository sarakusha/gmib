import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';

import type { GmibDiscoveryBlocked } from '../store/currentSlice';

type Props = {
  warning?: GmibDiscoveryBlocked;
  onClose(): void;
};

const WindowsFirewallDialog: React.FC<Props> = ({ warning, onClose }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => setCopied(false), [warning]);
  const copyCommands = useCallback(() => {
    if (!warning) return;
    void navigator.clipboard.writeText(warning.commands).then(() => setCopied(true));
  }, [warning]);

  return (
    <Dialog open={Boolean(warning)} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Возможна блокировка обнаружения GMIB</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          GMIB по адресу {warning?.address} отвечает по HTTP, но не обнаружен через mDNS. Это часто
          означает, что Windows Firewall или другой сетевой фильтр блокирует UDP-порт 5353.
        </Alert>
        <DialogContentText sx={{ mb: 1 }}>
          Проверьте команды ниже и, если они подходят для этого компьютера, выполните их в
          PowerShell от имени администратора. Они заменяют только правила GMIB и ограничены текущим
          исполняемым файлом. После выполнения полностью перезапустите GMIB.
        </DialogContentText>
        <Paper
          component="pre"
          variant="outlined"
          sx={{
            m: 0,
            p: 2,
            overflow: 'auto',
            userSelect: 'text',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
          }}
        >
          {warning?.commands}
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={copyCommands} startIcon={<ContentCopyIcon />} disabled={!warning}>
          {copied ? 'Скопировано' : 'Копировать команды'}
        </Button>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
};

export default WindowsFirewallDialog;
