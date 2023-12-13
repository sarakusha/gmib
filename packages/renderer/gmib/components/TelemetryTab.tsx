import { Box, Paper, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useToolbar } from '../providers/ToolbarProvider';
import { useDevice, useSelector } from '../store';

import type { IModuleInfo, Minihost2Info, Minihost3Info } from '/@common/helpers';
import {
  calcMaxValue,
  getEnumValues,
  getStatesAsync,
  isPositiveNumber,
  Minihost3Selector,
  noop,
  XMAX,
  YMAX,
} from '/@common/helpers';

import { selectCurrentDeviceId, selectCurrentTab } from '../store/selectors';

import ModuleInfo from './ModuleInfo';
import Range from './Range';
import type { MinihostTabProps } from './TabContainer';
import TelemetryToolbar from './TelemetryToolbar';

const HRange = styled(Range)(({ theme }) => ({
  gridArea: 'hRange',
  width: '34ch',
  marginBottom: theme.spacing(2),
  marginTop: theme.spacing(2),
  marginLeft: theme.spacing(2),
}));

const VRange = styled(Range)(({ theme }) => ({
  gridArea: 'vRange',
  marginTop: theme.spacing(2),
  marginLeft: theme.spacing(2),
  marginRight: theme.spacing(2),
  height: '40ch',
}));

const TelemetryTab: React.FC<MinihostTabProps> = ({ id, selected = false }) => {
  const { mib, props = {}, isBusy = 0 } = useDevice(id) ?? {};
  const { hres, vres, moduleHres, moduleVres, maxModulesH, maxModulesV } = props ?? {};
  const [[xMin, xMax], setX] = useState([0, XMAX - 1]);
  const [[yMin, yMax], setY] = useState([0, YMAX - 1]);
  const [selectors, setSelectors] = useState(new Set(getEnumValues(Minihost3Selector)));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setX([
      0,
      calcMaxValue(hres, moduleHres, isPositiveNumber(maxModulesH) ? maxModulesH.value : XMAX) - 1,
    ]);
    setY([
      0,
      calcMaxValue(vres, moduleVres, isPositiveNumber(maxModulesV) ? maxModulesV.value : YMAX) - 1,
    ]);
  }, [hres, vres, moduleHres, moduleVres, maxModulesH, maxModulesV]);

  const [dirv, dirh] =
    mib === 'minihost3'
      ? [props.dirv?.value, props.dirh?.value]
      : [props.vinvert?.value, props.hinvert?.value];
  const [modules, setModules] = useState<IModuleInfo<Minihost2Info | Minihost3Info>[]>([]);
  const telemetry = window.nibus.telemetry(id); // useMemo(() => window.nibus.telemetry(id), [id]);
  const start = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const [[xMin, xMax], [yMin, yMax], selectors] = await getStatesAsync(setX, setY, setSelectors);
    setLoading(true);
    await telemetry.start(
      {
        xMin,
        yMin,
        xMax,
        yMax,
        selectors: [...selectors],
      },
      setModules,
    );
    setLoading(false);
  }, [telemetry]);
  const [, setToolbar] = useToolbar();
  const tab = useSelector(selectCurrentTab);
  const active = useSelector(selectCurrentDeviceId) === id && selected && tab === 'devices';
  const telemetryToolbar = useMemo(
    () => (
      <TelemetryToolbar
        properties={mib === 'minihost3' ? Minihost3Selector : undefined}
        selectors={selectors}
        onSelectorChanged={setSelectors}
        loading={loading}
        isBusy={isBusy > 0}
        start={start}
        cancel={() => telemetry.cancel()}
      />
    ),
    [mib, selectors, loading, isBusy, start, telemetry],
  );
  useEffect(() => {
    if (active) {
      setToolbar(telemetryToolbar);
      return () => setToolbar(null);
    }
    return noop;
  }, [active, setToolbar, telemetryToolbar]);

  return (
    <Paper
      sx={{
        display: selected ? 'grid' : 'none',
        mb: 1,
        width: 1,
        height: 1,
        gridTemplateColumns: 'auto 1fr',
        gridTemplateRows: 'auto 1fr',
        gridTemplateAreas: `
      "corner hRange"
      "vRange main"
    `,
      }}
    >
      <Paper
        sx={{
          gridArea: 'corner',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          bgcolor: 'grey.100',
          color: 'grey.500',
          m: 0.5,
          '& > *': {
            padding: '2px',
            textAlign: 'center',
          },
          lineHeight: 1,
        }}
      >
        <Box
          sx={{
            borderBottom: 1,
            borderColor: 'white',
          }}
        >
          <Typography variant="caption" color="inherit">
            <b>
              {xMin}..{xMax}
            </b>
          </Typography>
        </Box>
        <div>
          <Typography variant="caption" color="inherit">
            <b>
              {yMin}..{yMax}
            </b>
          </Typography>
        </div>
      </Paper>
      <HRange
        min={0}
        max={((maxModulesH?.value as number) ?? XMAX) - 1}
        value={[xMin, xMax]}
        valueLabelDisplay="auto"
        onChange={(_, x) => setX(x as [number, number])}
        size="small"
        reverse={!dirh}
      />
      <VRange
        min={0}
        max={YMAX - 1}
        value={[yMin, yMax]}
        valueLabelDisplay="auto"
        onChange={(_, y) => setY(y as [number, number])}
        orientation="vertical"
        size="small"
        reverse={!!dirv}
      />
      <Box
        sx={{
          gridArea: 'main',
          display: 'flex',
          overflow: 'auto',
        }}
      >
        <div>
          <Box
            sx={{
              display: 'grid',
              gridAutoFlow: 'column',
              gap: 1,
              gridTemplateRows: `repeat(${yMax - yMin + 1}, 1fr)`,
            }}
          >
            {modules.map(moduleProps => (
              <ModuleInfo key={`${moduleProps.y}:${moduleProps.x}`} {...moduleProps} />
            ))}
          </Box>
        </div>
      </Box>
    </Paper>
  );
};

export default React.memo(TelemetryTab);
