/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { IconButton, Tooltip } from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import Filter1 from '@mui/icons-material/Filter1';
import Filter2 from '@mui/icons-material/Filter2';
import Filter3 from '@mui/icons-material/Filter3';
import Filter4 from '@mui/icons-material/Filter4';
import Filter5 from '@mui/icons-material/Filter5';
import Filter6 from '@mui/icons-material/Filter6';
import Filter7 from '@mui/icons-material/Filter7';
import StartIcon from '@mui/icons-material/Refresh';
import React, { useCallback, useState } from 'react';
import PropertySelectorDialog, { getEnumValues } from '../dialogs/PropertySelectorDialog';
import { noop } from '../util/helpers';
import BusyButton from './BusyButton';

// const useStyles = makeStyles(theme => ({
//   fabProgress: {
//     color: theme.palette.secondary.light,
//     position: 'absolute',
//     pointerEvents: 'none',
//     top: 0,
//     left: 0,
//     zIndex: 1,
//   },
//   wrapper: {
//     position: 'relative',
//   },
// }));

const icons = [Filter1, Filter2, Filter3, Filter4, Filter5, Filter6, Filter7] as const;

type Props = {
  start?: () => void;
  cancel?: () => void;
  loading?: boolean;
  isBusy?: boolean;
  selectors?: Set<number>;
  onSelectorChanged?: (selectors: Set<number>) => void;
  properties?: Record<string, number | string>;
};

const TelemetryToolbar: React.FC<Props> = ({
  start = noop,
  cancel = noop,
  loading = false,
  onSelectorChanged = noop,
  isBusy = 0,
  properties,
  selectors = new Set(properties && getEnumValues(properties)),
}) => {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const openSelectorHandler = useCallback(() => setSelectorOpen(true), []);
  const closeSelectorHandler = (value: Set<number>): void => {
    onSelectorChanged(value);
    setSelectorOpen(false);
  };
  const FilterIcon = icons[Math.max(selectors.size - 1, 0)];
  return (
    <>
      {properties && (
        <Tooltip title="Задать переменные">
          <IconButton color="inherit" onClick={openSelectorHandler} size="large">
            <FilterIcon />
          </IconButton>
        </Tooltip>
      )}
      {loading || isBusy ? (
        <BusyButton
          icon={<CancelIcon />}
          title={'Отменить опрос'}
          onClick={cancel}
          isBusy={isBusy > 0 || loading}
          disabled={!loading}
        />
      ) : (
        <Tooltip title="Запустить опрос модулей" enterDelay={500}>
          <IconButton onClick={start} color="inherit" size="large">
            <StartIcon />
          </IconButton>
        </Tooltip>
      )}
      {properties && (
        <PropertySelectorDialog
          properties={properties}
          open={selectorOpen}
          onClose={closeSelectorHandler}
          initial={selectors}
        />
      )}
    </>
  );
};

export default React.memo(TelemetryToolbar);
