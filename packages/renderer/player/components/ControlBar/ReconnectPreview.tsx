import RefreshIcon from '@mui/icons-material/Refresh';
import IconButton from '@mui/material/IconButton';
import * as React from 'react';

const ReconnectPreview: React.FC = () => {
  if (!window.mediaStream.reconnect) return null;
  return (
    <IconButton
      size="small"
      color="inherit"
      title="Переподключить превью"
      onClick={() => window.mediaStream.reconnect?.()}
    >
      <RefreshIcon fontSize="inherit" />
    </IconButton>
  );
};

ReconnectPreview.displayName = 'ReconnectPreview';

export default ReconnectPreview;
