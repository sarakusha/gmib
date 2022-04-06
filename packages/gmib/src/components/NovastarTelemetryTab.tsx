/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Box, Typography } from '@mui/material';
import { getScreenLocation } from '@novastar/screen';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import groupBy from 'lodash/groupBy';
import { useToolbar } from '../providers/ToolbarProvider';
import { useDispatch, useSelector } from '../store';
import { selectCurrentTab } from '../store/currentSlice';
import {
  Novastar,
  getNovastarController,
  novastarBusy,
  novastarReady,
} from '../store/novastarsSlice';
import { getStateAsync, noop } from '../util/helpers';
import NovastarLoader, { CabinetInfo, NovastarSelector } from '../util/NovastarLoader';
import ModuleInfo from './ModuleInfo';
import TelemetryToolbar from './TelemetryToolbar';

// const useStyles = makeStyles(theme => ({
//   grid: {
//     display: 'grid',
//     gap: 2,
//     // alignItems: 'stretch',
//   },
//   header: {
//     marginTop: theme.spacing(1),
//   },
//   item: {},
// }));

const NovastarTelemetryTab: React.FC<{ device: Novastar | undefined; selected?: boolean }> = ({
  device,
  selected = false,
}) => {
  const dispatch = useDispatch();
  const [, setToolbar] = useToolbar();
  const tab = useSelector(selectCurrentTab);
  const active = selected && tab === 'devices' && device !== undefined;
  const [selectors, setSelectors] = useState(
    new Set([NovastarSelector.Temperature, NovastarSelector.Voltage])
  );
  const [loading, setLoading] = useState(false);
  const isBusy = !device || device.isBusy > 0;
  const { path, screens = [] } = device ?? {};
  const locations = screens.map(({ info }) => info && getScreenLocation(info));
  const [cabinets, setCabinets] = useState<CabinetInfo[]>([]);
  const loader = useMemo(() => {
    const controller = path ? getNovastarController(path) : undefined;
    return controller && new NovastarLoader(controller);
  }, [path]);
  const start = useCallback(async () => {
    if (!loader) return;
    const current = await getStateAsync(setSelectors);
    await loader.run({ selectors: current });
  }, [loader]);
  const cancel = useCallback(() => {
    loader?.cancel();
  }, [loader]);
  const telemetryToolbar = useMemo(
    () => (
      <TelemetryToolbar
        properties={NovastarSelector}
        selectors={selectors}
        onSelectorChanged={setSelectors}
        loading={loading}
        isBusy={isBusy}
        start={start}
        cancel={cancel}
      />
    ),
    [selectors, loading, isBusy, start, cancel]
  );
  useEffect(() => {
    if (active) {
      setToolbar(telemetryToolbar);
      return () => setToolbar(null);
    }
    return noop;
  }, [active, setToolbar, telemetryToolbar]);

  useEffect(() => {
    if (!loader || !path) return () => {};
    const startHandler = (): void => {
      setLoading(true);
      setCabinets([]);
      dispatch(novastarBusy(path));
    };
    const finishHandler = (): void => {
      setLoading(false);
      dispatch(novastarReady(path));
    };
    const cabinetHandler = (info: CabinetInfo): void => {
      setCabinets(prev => [...prev, info]);
    };
    loader.on('cabinet', cabinetHandler);
    loader.on('start', startHandler);
    loader.on('finish', finishHandler);
    return () => {
      loader.off('finish', finishHandler);
      loader.off('start', startHandler);
      loader.off('cabinet', cabinetHandler);
    };
  }, [loader, dispatch, path]);
  const grouped = useMemo(() => Object.entries(groupBy(cabinets, cabinet => cabinet.screen)), [
    cabinets,
  ]);
  useEffect(() => setCabinets([]), [path]);
  return (
    <Box display={active ? 'inline-block' : 'none'}>
      {grouped.map(([screen, cabs], index) => (
        <React.Fragment key={screen}>
          <Typography color="inherit">Экран #{Number(screen) + 1}</Typography>
          <Box
            sx={{
              display: 'grid',
              gap: '2px',
              gridTemplateColumns: `repeat(${locations[index]?.cols ?? 0}, 1fr)`,
            }}
          >
            {cabs.map(({ column, row, status, mcuVersion, fpgaVersion }) => {
              const info: Record<string, unknown> = {};
              if (status) {
                const { tempInfoInScanCard, voltageInfoInScanCard } = status;
                if (selectors.has(NovastarSelector.Temperature) && tempInfoInScanCard.IsValid)
                  info.t = tempInfoInScanCard.Value;
                if (selectors.has(NovastarSelector.Voltage) && voltageInfoInScanCard.IsValid)
                  info.v = voltageInfoInScanCard.Value * 1000;
                if (selectors.has(NovastarSelector.MCU_Version) && mcuVersion)
                  info.MCU = mcuVersion;
                if (selectors.has(NovastarSelector.FPGA_Version) && fpgaVersion)
                  info.FPGA = fpgaVersion;
              }
              const error =
                status || mcuVersion != null || fpgaVersion != null ? undefined : 'Timeout';
              return (
                <div
                  key={`${column}:${row}`}
                  style={{
                    gridColumn: column + 1,
                    gridRow: row + 1,
                  }}
                >
                  <ModuleInfo x={column} y={row} info={info} error={error} />
                </div>
              );
            })}
          </Box>
        </React.Fragment>
      ))}
    </Box>
  );
};

export default NovastarTelemetryTab;
