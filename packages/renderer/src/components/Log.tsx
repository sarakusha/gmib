import { Box, Paper } from '@mui/material';
import React, { useEffect } from 'react';

import { useToolbar } from '../providers/ToolbarProvider';
import { useSelector } from '../store';

import { noop } from '/@common/helpers';

import { selectCurrentTab, selectLogLines } from '../store/selectors';

import LogLine from './LogLine';
import LogToolbar from './LogToolbar';

const Log: React.FC = () => {
  const [, setToolbar] = useToolbar();
  const tab = useSelector(selectCurrentTab);
  const logLines = useSelector(selectLogLines);
  useEffect(() => {
    if (tab === 'log') {
      setToolbar(<LogToolbar />);
      return () => setToolbar(null);
    }
    return noop;
  }, [setToolbar, tab]);
  return (
    <Box sx={{ px: 2, py: 1, width: 1, height: 1 }}>
      <Paper
        sx={{
          height: 1,
          overflow: 'auto',
          fontSize: 14,
        }}
      >
        {logLines.map(props => (
          <LogLine key={props.id} {...props} />
        ))}
      </Paper>
    </Box>
  );
};

export default React.memo(Log);
