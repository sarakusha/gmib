import { Box, Typography } from '@mui/material';
import getScreenLocation from '@novastar/screen/getScreenLocation';
import groupBy from 'lodash/groupBy';
import React, { useEffect, useMemo, useState } from 'react';

import { useToolbar } from '../providers/ToolbarProvider';
import { useSelector } from '../store';
import { selectCurrentTab, selectNovastarTelemetry } from '../store/selectors';

import { noop, NovastarSelector } from '/@common/helpers';

import ModuleInfo from './ModuleInfo';
import TelemetryToolbar from './TelemetryToolbar';

import type { Novastar } from '/@common/novastar';
import { useCancelTelemetryMutation, useStartTelemetryMutation } from '../api/novastar';

// const useStyles = makeStyles(theme => ({
//   grid: {
//     display: 'grid',˝˝
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
  const [startTelemetry] = useStartTelemetryMutation();
  const [cancelTelemetry] = useCancelTelemetryMutation();
  // const [loading, setLoading] = useState(false);
  const isBusy = !device || device.isBusy;
  const { path, screens = [] } = device ?? {};
  const locations = screens.map(({ info }) => info && getScreenLocation(info));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { isLoading, telemetry: cabinets = [] } =
    useSelector(state => selectNovastarTelemetry(state, path ?? '')) ?? {};
  const telemetryToolbar = useMemo(
    () => (
      <TelemetryToolbar
        properties={NovastarSelector}
        selectors={selectors}
        onSelectorChanged={setSelectors}
        loading={isLoading}
        isBusy={isBusy}
        start={path ? () => startTelemetry({ path, selectors: [...selectors] }) : undefined}
        cancel={path ? () => cancelTelemetry(path) : undefined}
      />
    ),
    [selectors, isLoading, isBusy, path, startTelemetry, cancelTelemetry],
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
