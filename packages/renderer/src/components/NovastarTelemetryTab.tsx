
import { Box, Typography } from '@mui/material';
import getScreenLocation from '@novastar/screen/lib/getScreenLocation';
import groupBy from 'lodash/groupBy';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useToolbar } from '../providers/ToolbarProvider';
import { useSelector } from '../store';
import type { Novastar } from '../store/novastarsSlice';
import { selectCurrentTab } from '../store/selectors';

import type { CabinetInfo } from '/@common/helpers';
import { getStateAsync, noop, NovastarSelector } from '/@common/helpers';

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
  const [, setToolbar] = useToolbar();
  const tab = useSelector(selectCurrentTab);
  const active = selected && tab === 'devices' && device !== undefined;
  const [selectors, setSelectors] = useState(
    new Set([NovastarSelector.Temperature, NovastarSelector.Voltage]),
  );
  const [loading, setLoading] = useState(false);
  const isBusy = !device || device.isBusy > 0;
  const { path, screens = [] } = device ?? {};
  const locations = screens.map(({ info }) => info && getScreenLocation(info));
  const [cabinets, setCabinets] = useState<CabinetInfo[]>([]);
  const telemetry = useMemo(
    () => (path !== undefined ? window.novastar.telemetry(path) : undefined),
    [path],
  );
  const start = useCallback(async () => {
    if (!telemetry) return;
    setLoading(true);
    const current = await getStateAsync(setSelectors);
    await telemetry.start({ selectors: current }, setCabinets);
    setLoading(false);
  }, [telemetry]);
  const telemetryToolbar = useMemo(
    () => (
      <TelemetryToolbar
        properties={NovastarSelector}
        selectors={selectors}
        onSelectorChanged={setSelectors}
        loading={loading}
        isBusy={isBusy}
        start={start}
        cancel={telemetry?.cancel}
      />
    ),
    [selectors, loading, isBusy, start, telemetry?.cancel],
  );
  useEffect(() => {
    if (active) {
      setToolbar(telemetryToolbar);
      return () => setToolbar(null);
    }
    return noop;
  }, [active, setToolbar, telemetryToolbar]);

  const grouped = useMemo(
    () => Object.entries(groupBy(cabinets, cabinet => cabinet.screen)),
    [cabinets],
  );
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
